import { describe, it, expect } from "vitest";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./session-cookie";

describe("session cookie constants", () => {
  it("uses 'session' as cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("session");
  });

  it("expires after 8 hours", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
  });
});
