import { describe, expect, it } from "vitest";
import { authRedirect } from "./authGate";

describe("authRedirect", () => {
  it("sends anonymous visitors to login and keeps setup open", () => {
    expect(authRedirect("/", false)).toBe("/login");
    expect(authRedirect("/parent-communication", false)).toBe("/login");
    expect(authRedirect("/login", false)).toBeNull();
    expect(authRedirect("/setup", false)).toBeNull();
  });

  it("keeps login and setup reachable when a cookie is already present", () => {
    expect(authRedirect("/login", true)).toBeNull();
    expect(authRedirect("/setup", true)).toBeNull();
    expect(authRedirect("/", true)).toBeNull();
    expect(authRedirect("/parent-communication", true)).toBeNull();
  });
});
