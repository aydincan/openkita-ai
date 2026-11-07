import { describe, expect, it } from "vitest";
import { backendTimeoutMs, safeBackendPath } from "./backendProxy";

const DRAFT = "11111111-1111-4111-8111-111111111111";

describe("safeBackendPath", () => {
  it("allows the account and draft routes", () => {
    expect(safeBackendPath(["setup", "status"])).toBe("setup/status");
    expect(safeBackendPath(["auth", "login"])).toBe("auth/login");
    expect(safeBackendPath(["drafts", "parent-communication"])).toBe("drafts/parent-communication");
    expect(safeBackendPath(["drafts", DRAFT, "export", "pdf"])).toBe(`drafts/${DRAFT}/export/pdf`);
  });

  it("rejects traversal and unknown routes", () => {
    expect(safeBackendPath(["..", "etc"])).toBeNull();
    expect(safeBackendPath(["health"])).toBeNull();
    expect(safeBackendPath(["drafts", DRAFT, "send"])).toBeNull();
  });
});

describe("backendTimeoutMs", () => {
  it("gives letter generation the long timeout only", () => {
    expect(backendTimeoutMs("drafts/parent-communication", "POST", 8000, 130000)).toBe(130000);
    expect(backendTimeoutMs("drafts/parent-communication", "GET", 8000, 130000)).toBe(8000);
    expect(backendTimeoutMs("auth/login", "POST", 8000, 130000)).toBe(8000);
  });
});
