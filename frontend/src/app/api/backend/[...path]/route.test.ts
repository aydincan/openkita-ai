import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

function call(method: string, path: string, cookie?: string) {
  const request = new NextRequest(`http://localhost:3000/api/backend/${path}`, {
    method,
    headers: cookie ? { cookie } : undefined,
  });
  return (method === "POST" ? POST : GET)(request, { params: Promise.resolve({ path: path.split("/") }) });
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
});
