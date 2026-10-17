import { describe, expect, it } from "vitest";
import { authRedirect, isPublicPath } from "./routes";

describe("isPublicPath", () => {
  it("allows the login and email confirmation pages", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });

  it("protects every other page", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/quests")).toBe(false);
    expect(isPublicPath("/auth")).toBe(false);
  });

  it("does not treat look-alike paths as public", () => {
    expect(isPublicPath("/login-admin")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

describe("authRedirect", () => {
  it("sends logged-out users on app pages to login", () => {
    expect(authRedirect("/", false)).toBe("/login");
    expect(authRedirect("/cards", false)).toBe("/login");
  });

  it("lets logged-out users reach login and confirmation", () => {
    expect(authRedirect("/login", false)).toBeNull();
    expect(authRedirect("/auth/confirm", false)).toBeNull();
  });

  it("sends logged-in users away from the login page", () => {
    expect(authRedirect("/login", true)).toBe("/");
  });

  it("lets logged-in users reach app pages", () => {
    expect(authRedirect("/", true)).toBeNull();
    expect(authRedirect("/auth/confirm", true)).toBeNull();
  });
});
