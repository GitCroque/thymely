import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks ---

vi.mock("../../prisma", () => ({
  prisma: {
    config: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// --- Imports (after mocks) ---

import { encryptSecret, decryptSecret } from "../security/secrets";

// 32 random bytes as hex (64 chars)
const TEST_KEY_HEX = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

describe("security/secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cached key between tests by re-importing
    vi.resetModules();
    process.env.DATA_ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  describe("encryptSecret", () => {
    it("returns null/undefined for falsy values", async () => {
      const { encryptSecret } = await import("../security/secrets");
      expect(await encryptSecret(null)).toBeNull();
      expect(await encryptSecret(undefined)).toBeUndefined();
      expect(await encryptSecret("")).toBe("");
    });

    it("encrypts a plaintext value", async () => {
      const { encryptSecret } = await import("../security/secrets");
      const encrypted = await encryptSecret("my-imap-password");
      expect(encrypted).toMatch(/^enc:v1:/);
      // Format: enc:v1:<iv>:<tag>:<data>
      expect(encrypted!.split(":")).toHaveLength(5);
    });

    it("does not double-encrypt an already encrypted value", async () => {
      const { encryptSecret } = await import("../security/secrets");
      const encrypted = await encryptSecret("my-secret");
      const doubleEncrypted = await encryptSecret(encrypted!);
      expect(doubleEncrypted).toBe(encrypted);
    });
  });

  describe("decryptSecret", () => {
    it("returns null/undefined for falsy values", async () => {
      const { decryptSecret } = await import("../security/secrets");
      expect(await decryptSecret(null)).toBeNull();
      expect(await decryptSecret(undefined)).toBeUndefined();
      expect(await decryptSecret("")).toBe("");
    });

    it("returns plaintext values as-is (not encrypted)", async () => {
      const { decryptSecret } = await import("../security/secrets");
      expect(await decryptSecret("plain-password")).toBe("plain-password");
    });

    it("decrypts a previously encrypted value", async () => {
      const { encryptSecret, decryptSecret } = await import("../security/secrets");
      const original = "smtp-password-123!@#";
      const encrypted = await encryptSecret(original);
      const decrypted = await decryptSecret(encrypted!);
      expect(decrypted).toBe(original);
    });

    it("throws on malformed encrypted format", async () => {
      const { decryptSecret } = await import("../security/secrets");
      await expect(decryptSecret("enc:v1:only-three-parts")).rejects.toThrow(
        "Invalid encrypted secret format"
      );
    });

    it("throws on tampered ciphertext", async () => {
      const { encryptSecret, decryptSecret } = await import("../security/secrets");
      const encrypted = await encryptSecret("sensitive-data");
      // Tamper with the data portion (last segment)
      const parts = encrypted!.split(":");
      parts[4] = "AAAA" + parts[4].slice(4);
      const tampered = parts.join(":");
      await expect(decryptSecret(tampered)).rejects.toThrow();
    });
  });

  describe("roundtrip with various values", () => {
    it.each([
      "simple",
      "with spaces and special chars !@#$%^&*()",
      "unicode: accent\u00E9 \u00E9moji \u2764",
      "a".repeat(1000),
      "empty-ish: 0",
    ])("encrypts and decrypts: %s", async (value) => {
      const { encryptSecret, decryptSecret } = await import("../security/secrets");
      const encrypted = await encryptSecret(value);
      const decrypted = await decryptSecret(encrypted!);
      expect(decrypted).toBe(value);
    });
  });
});
