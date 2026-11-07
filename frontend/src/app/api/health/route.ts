import { NextResponse } from "next/server";
import { BACKEND_INTERNAL_URL, BACKEND_TIMEOUT_MS } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy to the backend /health endpoint (no CORS, backend URL stays private).
 *
 * - backend answers with JSON (200, or 503 when the database is down): passed through unchanged
 * - connection refused / DNS failure: 502 `backend_unreachable`
 * - no answer within BACKEND_TIMEOUT_MS: 504 `backend_timeout`
 * - answers with something that is not a JSON object: 502 `backend_invalid_response`
 */
export async function GET() {
  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_INTERNAL_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name ?? "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json({ error: "backend_timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return NextResponse.json({ error: "backend_invalid_response" }, { status: 502 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "backend_invalid_response" }, { status: 502 });
  }
  return NextResponse.json(body, { status: upstream.status });
}
