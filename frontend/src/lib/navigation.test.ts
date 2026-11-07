import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./navigation";

describe("navigation", () => {
  it("only links to pages that exist", () => {
    for (const item of NAV_ITEMS) {
      const page = path.join(process.cwd(), "src/app", item.href, "page.tsx");
      expect(existsSync(page), `${item.href} has no page`).toBe(true);
    }
  });

  it("contains the planned entries in order", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual([
      "dashboard",
      "exposure",
      "parentCommunication",
      "administration",
      "knowledge",
      "documents",
      "users",
      "settings",
    ]);
  });
});
