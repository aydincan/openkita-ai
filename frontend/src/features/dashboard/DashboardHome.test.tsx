import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getMessages } from "@/lib/i18n";
import { renderWithI18n } from "@/test/render";
import { ModuleCards } from "./DashboardHome";

describe("ModuleCards", () => {
  it("links to parent communication and keeps the other modules honestly unfinished", () => {
    renderWithI18n(<ModuleCards messages={getMessages("de")} />);
    const parent = screen.getByRole("link", { name: "Elternkommunikation" });
    expect(parent).toHaveAttribute("href", "/parent-communication");
    expect(parent.closest("li")).not.toHaveTextContent("In einer späteren Version");
    const exposure = screen.getByRole("link", { name: "Belastung" });
    expect(exposure).toHaveAttribute("href", "/exposure");
    expect(exposure.closest("li")).not.toHaveTextContent("In einer späteren Version");
    expect(screen.getByRole("link", { name: "Verwaltung" }).closest("li")).toHaveTextContent(
      "In einer späteren Version",
    );
    expect(screen.getByRole("link", { name: "Kita-Wissen" }).closest("li")).toHaveTextContent(
      "In einer späteren Version",
    );
  });
});
