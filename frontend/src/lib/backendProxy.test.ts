import { describe, expect, it } from "vitest";
import { backendTimeoutMs, safeBackendPath, stateChangingOriginAllowed } from "./backendProxy";

const DRAFT = "11111111-1111-4111-8111-111111111111";

describe("safeBackendPath", () => {
  it("allows the account and draft routes", () => {
    expect(safeBackendPath(["setup", "status"])).toBe("setup/status");
    expect(safeBackendPath(["auth", "login"])).toBe("auth/login");
    expect(safeBackendPath(["drafts", "parent-communication"])).toBe("drafts/parent-communication");
    expect(safeBackendPath(["drafts", DRAFT, "export", "pdf"])).toBe(`drafts/${DRAFT}/export/pdf`);
    expect(safeBackendPath(["exposure"])).toBe("exposure");
    expect(safeBackendPath(["exposure", "regions"])).toBe("exposure/regions");
    expect(safeBackendPath(["facility", "region"])).toBe("facility/region");
  });

  it("rejects traversal and unknown routes", () => {
    expect(safeBackendPath(["..", "etc"])).toBeNull();
    expect(safeBackendPath(["health"])).toBeNull();
    expect(safeBackendPath(["drafts", DRAFT, "send"])).toBeNull();
  });
});

describe("stateChangingOriginAllowed", () => {
  it("rejects a missing or foreign origin on state-changing methods", () => {
    expect(stateChangingOriginAllowed("POST", null, "localhost:3000", "")).toBe(false);
    expect(stateChangingOriginAllowed("PATCH", null, "localhost:3000", undefined)).toBe(false);
    expect(stateChangingOriginAllowed("PUT", "null", "localhost:3000", "")).toBe(false);
    expect(stateChangingOriginAllowed("DELETE", "https://evil.example", "localhost:3000", "")).toBe(false);
    expect(stateChangingOriginAllowed("POST", "http://localhost:3000.evil.example", "localhost:3000", "")).toBe(
      false,
    );
  });

  it("allows an origin whose host matches, or the configured public origin", () => {
    expect(stateChangingOriginAllowed("POST", "http://localhost:3000", "localhost:3000", "")).toBe(true);
    expect(stateChangingOriginAllowed("POST", "http://localhost:3000", "LocalHost:3000", "")).toBe(true);
    expect(
      stateChangingOriginAllowed("DELETE", "https://kita.example", "localhost:3000", "https://kita.example"),
    ).toBe(true);
    expect(
      stateChangingOriginAllowed("POST", "http://kita.example", "localhost:3000", "https://kita.example"),
    ).toBe(false);
  });

  it("does not require an origin for safe methods", () => {
    expect(stateChangingOriginAllowed("GET", null, "localhost:3000", "")).toBe(true);
  });
});

describe("backendTimeoutMs", () => {
  it("gives letter generation the long timeout only", () => {
    expect(backendTimeoutMs("drafts/parent-communication", "POST", 8000, 130000)).toBe(130000);
    expect(backendTimeoutMs("drafts/parent-communication", "GET", 8000, 130000)).toBe(8000);
    expect(backendTimeoutMs("auth/login", "POST", 8000, 130000)).toBe(8000);
  });
});
