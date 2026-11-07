import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/render";
import type { HealthResponse } from "@/types/health";
import { StatusPanel } from "./StatusPanel";

const healthy: HealthResponse = {
  status: "ok",
  version: "0.1.0",
  environment: "test",
  components: {
    api: { status: "up", detail: null, latency_ms: null },
    database: { status: "up", detail: null, latency_ms: 2 },
    ai: { status: "disabled", detail: "off", latency_ms: null },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("StatusPanel", () => {
  it("shows a loading state, then the success state", async () => {
    let resolve: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));

    renderWithI18n(<StatusPanel />);
    expect(screen.getByRole("status")).toHaveTextContent("Systemstatus wird geladen");

    resolve(jsonResponse(healthy));
    expect(await screen.findByText("Alles in Ordnung")).toBeInTheDocument();
    expect(screen.getByText("Datenbank")).toBeInTheDocument();
    expect(screen.getByText("Deaktiviert")).toBeInTheDocument();
    expect(screen.getByText(/Version 0\.1\.0/)).toBeInTheDocument();
  });

  it("shows component state when the database is down (HTTP 503 with body)", async () => {
    const down: HealthResponse = {
      ...healthy,
      status: "error",
      components: { ...healthy.components, database: { status: "down", detail: "x", latency_ms: null } },
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(down, 503)));

    renderWithI18n(<StatusPanel />);
    expect(await screen.findByText("Störung: Datenbank nicht erreichbar")).toBeInTheDocument();
    expect(screen.getByText("Nicht erreichbar")).toBeInTheDocument();
  });

  it("shows an error state and retry really re-fetches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "backend_unreachable" }, 502))
      .mockResolvedValueOnce(jsonResponse(healthy));
    vi.stubGlobal("fetch", fetchMock);

    renderWithI18n(<StatusPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Status nicht abrufbar");

    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Alles in Ordnung")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("explains how to handle an unreachable optional AI provider, with a single live region", async () => {
    const aiDown: HealthResponse = {
      ...healthy,
      components: { ...healthy.components, ai: { status: "down", detail: "x", latency_ms: null } },
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(aiDown)));
    renderWithI18n(<StatusPanel />);
    expect(await screen.findByText(/AI_PROVIDER=none/)).toBeInTheDocument();
    expect(screen.getByText("Alles in Ordnung")).toBeInTheDocument(); // optional: not a fault
    expect(document.querySelectorAll("[aria-live], [role=status], [role=alert]")).toHaveLength(1);
  });

  it("treats a network failure as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    renderWithI18n(<StatusPanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("renders English when the locale is en", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(healthy)));
    renderWithI18n(<StatusPanel />, "en");
    expect(await screen.findByText("All good")).toBeInTheDocument();
  });
});
