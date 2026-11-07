import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "./route";

const handlers = { GET, POST, PATCH, PUT, DELETE } as const;

function call(
  method: keyof typeof handlers,
  path: string,
  cookie?: string,
  origin: string | null = "http://localhost:3000",
) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (origin !== null && method !== "GET") headers.set("origin", origin);
  const request = new NextRequest(`http://localhost:3000/api/backend/${path}`, { method, headers });
  return handlers[method](request, { params: Promise.resolve({ path: path.split("/") }) });
}

describe("backend proxy", () => {
  it("refuses unknown paths without calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("GET", "../health");
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the session cookie and the backend set-cookie", async () => {
    const fetchMock = vi.fn(async () => {
      const headers = new Headers();
      headers.append("set-cookie", "openkita_session=abc; HttpOnly; Path=/; SameSite=Lax");
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify({ role: "administrator" }), { status: 200, headers });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("GET", "auth/me", "openkita_session=abc");
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("cookie")).toBe("openkita_session=abc");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("forwards a cookieless 204 logout", async () => {
    const fetchMock = vi.fn(async () => {
      const headers = new Headers();
      headers.append("set-cookie", "openkita_session=; HttpOnly; Max-Age=0; Path=/; SameSite=lax");
      return new Response(null, { status: 204, headers });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("POST", "auth/logout", "openkita_session=abc");
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("marks proxied responses no-store so drafts are not cached", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("GET", "drafts", "openkita_session=abc");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("uses a longer timeout for letter generation", async () => {
    const fetchMock = vi.fn(async () => Response.json({ detail: "model_unavailable" }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await call("POST", "drafts/parent-communication");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects a cross-site state-changing request before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("POST", "auth/login", undefined, "https://evil.example");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "cross_site_request" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a state-changing request that omits origin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("PATCH", "facility", "openkita_session=abc", null);
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the configured public origin when it differs from the host", async () => {
    const previous = process.env.PUBLIC_ORIGIN;
    process.env.PUBLIC_ORIGIN = "https://kita.example";
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const response = await call("POST", "auth/login", undefined, "https://kita.example");
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_ORIGIN;
      else process.env.PUBLIC_ORIGIN = previous;
    }
  });
});
