import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const healthy = { status: "ok", version: "0.1.0" };

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("GET /api/health (proxy)", () => {
  it("passes a 200 backend answer through", async () => {
    const fetchMock = mockFetch(async () => Response.json(healthy));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(healthy);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/health");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("passes a 503 (database down) status and body through", async () => {
    const down = { status: "error", version: "0.1.0" };
    mockFetch(async () => Response.json(down, { status: 503 }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(down);
  });

  it("returns 502 backend_unreachable when the connection is refused", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed", { cause: new Error("ECONNREFUSED") });
    });
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "backend_unreachable" });
  });

  it("returns 502 backend_invalid_response for non-JSON answers", async () => {
    mockFetch(async () => new Response("<html>oops</html>", { status: 200 }));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "backend_invalid_response" });
  });

  it("returns 502 backend_invalid_response when JSON is not an object", async () => {
    mockFetch(async () => Response.json(["not", "an", "object"]));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "backend_invalid_response" });
  });

  it("returns 504 backend_timeout on timeout / abort", async () => {
    for (const name of ["TimeoutError", "AbortError"]) {
      mockFetch(async () => {
        throw new DOMException("aborted", name);
      });
      const response = await GET();
      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({ error: "backend_timeout" });
    }
  });

  it("hands fetch a signal that fires after BACKEND_TIMEOUT_MS and maps it to 504", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    // A backend that never answers: the mocked fetch only settles when its signal aborts.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("The operation timed out", "TimeoutError")),
            );
          }),
      ),
    );
    const pending = GET();
    expect(timeout).toHaveBeenCalledWith(8000);
    controller.abort();
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "backend_timeout" });
  });
});
