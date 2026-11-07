import { describe, expect, it } from "vitest";
import { authRedirect } from "./authGate";

describe("authRedirect", () => {
  it("sends anonymous visitors to login and keeps setup open", () => {
    expect(authRedirect("/", false)).toBe("/login");
    expect(authRedirect("/parent-communication", false)).toBe("/login");
    expect(authRedirect("/login", false)).toBeNull();
    expect(authRedirect("/setup", false)).toBeNull();
  });

  it("sends a signed-in visitor away from login and setup", () => {
    expect(authRedirect("/login", true)).toBe("/");
    expect(authRedirect("/setup", true)).toBe("/");
    expect(authRedirect("/", true)).toBeNull();
  });
});
