import { describe, it, expect } from "vitest";
import { FastifyRequest } from "fastify";
import { getBearerToken, getSessionCookieToken, getSessionToken } from "../request-token";

function fakeRequest(overrides: {
  authorization?: string;
  cookies?: Record<string, string>;
}): FastifyRequest {
  return {
    headers: {
      authorization: overrides.authorization,
    },
    cookies: overrides.cookies,
  } as unknown as FastifyRequest;
}

describe("request-token", () => {
  describe("getBearerToken", () => {
    it("returns null when no authorization header", () => {
      expect(getBearerToken(fakeRequest({}))).toBeNull();
    });

    it("returns null for non-bearer scheme", () => {
      expect(getBearerToken(fakeRequest({ authorization: "Basic abc123" }))).toBeNull();
    });

    it("extracts bearer token", () => {
      expect(getBearerToken(fakeRequest({ authorization: "Bearer my-jwt-token" }))).toBe("my-jwt-token");
    });

    it("is case-insensitive for scheme", () => {
      expect(getBearerToken(fakeRequest({ authorization: "bearer my-token" }))).toBe("my-token");
      expect(getBearerToken(fakeRequest({ authorization: "BEARER my-token" }))).toBe("my-token");
    });

    it("returns null for empty token after Bearer", () => {
      expect(getBearerToken(fakeRequest({ authorization: "Bearer " }))).toBeNull();
    });

    it('returns null for "null" or "undefined" token values', () => {
      expect(getBearerToken(fakeRequest({ authorization: "Bearer null" }))).toBeNull();
      expect(getBearerToken(fakeRequest({ authorization: "Bearer undefined" }))).toBeNull();
    });

    it("returns null when token has leading spaces (split yields empty segments)", () => {
      // "Bearer   my-token" splits as ["Bearer", "", "", "my-token"]
      // The second element is "" which normalizes to null
      expect(getBearerToken(fakeRequest({ authorization: "Bearer   my-token" }))).toBeNull();
    });
  });

  describe("getSessionCookieToken", () => {
    it("returns null when no cookies", () => {
      expect(getSessionCookieToken(fakeRequest({}))).toBeNull();
    });

    it("returns null when session cookie is empty", () => {
      expect(getSessionCookieToken(fakeRequest({ cookies: { session: "" } }))).toBeNull();
    });

    it("returns the session cookie value", () => {
      expect(getSessionCookieToken(fakeRequest({ cookies: { session: "jwt-from-cookie" } }))).toBe("jwt-from-cookie");
    });

    it('returns null for "null" cookie value', () => {
      expect(getSessionCookieToken(fakeRequest({ cookies: { session: "null" } }))).toBeNull();
    });
  });

  describe("getSessionToken", () => {
    it("prefers bearer token over cookie", () => {
      const req = fakeRequest({
        authorization: "Bearer bearer-token",
        cookies: { session: "cookie-token" },
      });
      expect(getSessionToken(req)).toBe("bearer-token");
    });

    it("falls back to cookie when no bearer", () => {
      const req = fakeRequest({
        cookies: { session: "cookie-token" },
      });
      expect(getSessionToken(req)).toBe("cookie-token");
    });

    it("returns null when neither present", () => {
      expect(getSessionToken(fakeRequest({}))).toBeNull();
    });
  });
});
