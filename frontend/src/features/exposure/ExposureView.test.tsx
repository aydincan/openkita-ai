import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/render";
import type { ExposureReport } from "@/types/exposure";
import { ExposureView } from "./ExposureView";

const sampleTopic: ExposureReport["topics"][number] = {
  topic: "uv",
  source_id: "dwd_uv",
  origin: "synthetic",
  licence: "CC BY 4.0",
  dataset_url: "https://opendata.dwd.de/climate_environment/health/alerts/uvi.json",
  retrieved_at: null,
  source_timestamp: null,
  stale: false,
  place_label: "Beispielgebiet Nordlicht",
  reason: "region_missing",
  sample_label_de: "Beispieldaten, nicht live",
  sample_label_en: "Sample data, not live",
  facts: [{ day: "today", code: "sample_uv", subject: null }],
};

const synthetic: ExposureReport = {
  region_set: false,
  region_code: null,
  region_label: null,
  topics: [sampleTopic],
};

const live: ExposureReport = {
  ...synthetic,
  region_set: true,
  region_code: "50",
  region_label: "Brandenburg und Berlin",
  topics: [
    {
      ...sampleTopic,
      origin: "live",
      stale: true,
      place_label: "Berlin",
      reason: "none",
      sample_label_de: null,
      sample_label_en: null,
      source_timestamp: "2020-01-02T10:00:00Z",
      retrieved_at: "2026-11-07T12:00:00Z",
      facts: [
        { day: "today", code: "7", subject: null },
        { day: "tomorrow", code: "6", subject: null },
      ],
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(report: ExposureReport, role: "administrator" | "educator" = "administrator") {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("auth/me")) return jsonResponse({ role });
    return jsonResponse(report);
  });
}

describe("ExposureView", () => {
  it("labels the sample and offers administrators a way to set the region", async () => {
    vi.stubGlobal("fetch", mockFetch(synthetic, "administrator"));
    renderWithI18n(<ExposureView variant="outlook" />);
    expect(await screen.findByText("Beispieldaten, nicht live")).toBeInTheDocument();
    expect(screen.getByText("Beispielwert: UV-Index 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Region festlegen" })).toHaveAttribute(
      "href",
      "/settings#exposure-region",
    );
    expect(screen.queryByRole("link", { name: "Öffentliche Quelle" })).not.toBeInTheDocument();
  });

  it("keeps a live reading and shows a stale-data warning", async () => {
    vi.stubGlobal("fetch", mockFetch(live));
    renderWithI18n(<ExposureView variant="page" />);
    expect(await screen.findByText("UV-Index 7")).toBeInTheDocument();
    expect(screen.queryByText("Beispieldaten, nicht live")).not.toBeInTheDocument();
    expect(screen.getByText(/älter als 36 Stunden/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Öffentliche Quelle" })).toHaveAttribute(
      "href",
      sampleTopic.dataset_url,
    );
  });

  it("shows an error and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "backend_unreachable" }, 502))
      .mockResolvedValueOnce(jsonResponse({ role: "educator" }))
      .mockResolvedValueOnce(jsonResponse(synthetic))
      .mockResolvedValueOnce(jsonResponse({ role: "educator" }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithI18n(<ExposureView variant="outlook" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Der Server ist nicht erreichbar.");
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Beispieldaten, nicht live")).toBeInTheDocument();
    expect(screen.getByText(/Die Region legt die Administration/)).toBeInTheDocument();
  });
});
