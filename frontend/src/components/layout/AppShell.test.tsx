import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/render";
import { AppShell } from "./AppShell";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    nav.pathname = "/";
  });

  it("renders landmarks, skip link and all planned navigation entries", () => {
    renderWithI18n(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Zum Inhalt springen" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveTextContent("content");
    const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
    expect(nav.querySelectorAll("a")).toHaveLength(7);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("toggles the mobile menu with correct aria state", async () => {
    renderWithI18n(<AppShell>x</AppShell>);
    const toggle = screen.getByRole("button", { name: "Menü öffnen" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Menü schließen" })).toHaveAttribute("aria-expanded", "true");
  });

  it("marks nested routes active but not look-alike prefixes", () => {
    nav.pathname = "/documents/42";
    renderWithI18n(<AppShell>x</AppShell>);
    expect(screen.getByRole("link", { name: /^Dokumente/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("does not treat /documents-archive as /documents", () => {
    nav.pathname = "/documents-archive";
    renderWithI18n(<AppShell>x</AppShell>);
    expect(screen.getByRole("link", { name: /^Dokumente/ })).not.toHaveAttribute("aria-current");
  });

  it("uses a high-contrast badge on the active item", () => {
    nav.pathname = "/knowledge";
    renderWithI18n(<AppShell>x</AppShell>);
    const badge = within(screen.getByRole("link", { name: /^Kita-Wissen/ })).getByText("Bald");
    expect(badge).toHaveClass("bg-white", "text-brand-800");
  });
});
