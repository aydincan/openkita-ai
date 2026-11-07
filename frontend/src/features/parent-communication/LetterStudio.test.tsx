import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/render";
import type { Draft } from "@/types/draft";
import { LetterStudio } from "./LetterStudio";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const draft: Draft = {
  id: "11111111-1111-4111-8111-111111111111",
  facility_id: "22222222-2222-4222-8222-222222222222",
  author_display_name: "Frau Beispiel",
  subject: "Einladung zum Sommerfest",
  body: "Liebe Eltern,\n\nwir laden Familie Beispiel ein.\n",
  language: "de",
  message_type: "invitation",
  tone: "friendly",
  status: "draft",
  ai_generated: true,
  skill: "parent-communication",
  skill_version: "0.1.0",
  requires_human_review: true,
  warnings: [],
  missing_information: [],
  key_facts: [],
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
};

describe("LetterStudio", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("warns that Turkish is experimental before a draft exists", async () => {
    renderWithI18n(<LetterStudio />);
    await userEvent.selectOptions(screen.getByLabelText("Sprache"), "tr");
    expect(screen.getByRole("note")).toHaveTextContent("Experimentell");
    expect(screen.getByRole("note")).toHaveTextContent("Standardmodell");
  });

  it("shows a model-down error and does not invent a letter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "model_unavailable" }, { status: 503 })),
    );
    renderWithI18n(<LetterStudio />);
    await userEvent.type(screen.getByLabelText(/Was sollen die Eltern/), "Sommerfest der Kita Sonnenblume");
    await userEvent.click(screen.getByRole("button", { name: "Entwurf erstellen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Es wurde kein Entwurf gespeichert");
    expect(screen.queryByRole("heading", { name: "KI-Entwurf" })).not.toBeInTheDocument();
  });

  it("labels the draft as AI-generated and does not offer to send it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(draft)));
    renderWithI18n(<LetterStudio />);
    await userEvent.type(screen.getByLabelText(/Was sollen die Eltern/), "Sommerfest der Kita Sonnenblume");
    await userEvent.click(screen.getByRole("button", { name: "Entwurf erstellen" }));
    expect(await screen.findByRole("heading", { name: "KI-Entwurf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Als geprüft markieren" })).toBeInTheDocument();
    expect(screen.getByText(/Der Brief wird nicht versendet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /senden|verschicken|e-mail/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Brief")).toHaveValue(draft.body);
  });
});
