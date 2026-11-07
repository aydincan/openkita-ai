import { NextResponse, type NextRequest } from "next/server";
import { BACKEND_GENERATE_TIMEOUT_MS, BACKEND_INTERNAL_URL, BACKEND_TIMEOUT_MS } from "@/lib/config";
import { backendTimeoutMs, safeBackendPath } from "@/lib/backendProxy";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const parts = (await context.params).path;
  const path = safeBackendPath(parts);
  if (path === null || !["GET", "POST", "PATCH"].includes(request.method)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = request.headers.get("content-type");
  if (contentType && request.method !== "GET") headers.set("content-type", contentType);

  const timeout = backendTimeoutMs(path, request.method, BACKEND_TIMEOUT_MS, BACKEND_GENERATE_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_INTERNAL_URL}/${path}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name ?? "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json({ error: "backend_timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  // The API marks every response no-store. Dropping that header lets the browser
  // keep session and draft payloads (user email, letter text) in its HTTP cache.
  responseHeaders.set("cache-control", "no-store");
  for (const cookieHeader of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookieHeader);
  }
  // 204/205/304 must not carry a body. Next.js rejects Response(body, { status: 204 }).
  const empty = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
  return new NextResponse(empty ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
