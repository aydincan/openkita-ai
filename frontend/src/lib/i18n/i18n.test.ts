import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, getMessages, resolveLocale } from "./index";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n", () => {
  it("defaults to German", () => {
    expect(DEFAULT_LOCALE).toBe("de");
    expect(resolveLocale(undefined)).toBe("de");
    expect(resolveLocale("fr")).toBe("de");
    expect(resolveLocale("en")).toBe("en");
  });

  it("English and German catalogs have identical keys", () => {
    expect(keyPaths(getMessages("en")).sort()).toEqual(keyPaths(getMessages("de")).sort());
  });

  it("has no empty messages", () => {
    for (const locale of ["de", "en"] as const) {
      const flat = JSON.stringify(getMessages(locale));
      expect(flat).not.toContain('""');
    }
  });
});
