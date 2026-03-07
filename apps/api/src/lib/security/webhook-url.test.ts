import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dns/promises pour éviter les vraies résolutions réseau
vi.mock("dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
  lookup: vi.fn(),
}));

import dns from "dns/promises";
import { assertSafeWebhookUrl } from "./webhook-url";

const mockLookup = dns.lookup as ReturnType<typeof vi.fn>;

describe("assertSafeWebhookUrl", () => {
  const originalEnv = process.env.ALLOW_INSECURE_WEBHOOK_URLS;

  beforeEach(() => {
    vi.clearAllMocks();
    // Retour propre : par défaut HTTPS requis
    delete process.env.ALLOW_INSECURE_WEBHOOK_URLS;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ALLOW_INSECURE_WEBHOOK_URLS = originalEnv;
    } else {
      delete process.env.ALLOW_INSECURE_WEBHOOK_URLS;
    }
  });

  // --- Validation de protocole ---

  it("rejette les URLs non-HTTPS quand ALLOW_INSECURE_WEBHOOK_URLS n'est pas défini", async () => {
    await expect(
      assertSafeWebhookUrl("http://example.com/webhook")
    ).rejects.toThrow("Webhook URL must use HTTPS");
  });

  it("rejette le protocole ftp:", async () => {
    await expect(
      assertSafeWebhookUrl("ftp://example.com/webhook")
    ).rejects.toThrow();
  });

  it("rejette le protocole file:", async () => {
    await expect(
      assertSafeWebhookUrl("file:///etc/passwd")
    ).rejects.toThrow();
  });

  it("rejette le protocole javascript:", async () => {
    await expect(
      assertSafeWebhookUrl("javascript:alert(1)")
    ).rejects.toThrow();
  });

  it("rejette une URL malformée", async () => {
    await expect(
      assertSafeWebhookUrl("not-a-url")
    ).rejects.toThrow("Invalid webhook URL");
  });

  // --- IPs privées IPv4 directement dans l'URL ---

  it("rejette 127.0.0.1 (loopback)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://127.0.0.1/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette 10.0.0.1 (RFC 1918 /8)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://10.0.0.1/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette 10.255.255.255 (RFC 1918 /8 limite haute)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://10.255.255.255/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette 192.168.1.1 (RFC 1918 /16)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://192.168.1.1/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette 172.16.0.1 (RFC 1918 /12 limite basse)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://172.16.0.1/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette 172.31.255.255 (RFC 1918 /12 limite haute)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://172.31.255.255/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette 169.254.1.1 (link-local)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://169.254.1.1/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  // --- IPs privées IPv6 directement dans l'URL ---

  it("rejette ::1 (loopback IPv6)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://[::1]/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette fc00:: (ULA IPv6)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://[fc00::1]/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette fd00:: (ULA IPv6)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://[fd00::1]/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  it("rejette fe80:: (link-local IPv6)", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://[fe80::1]/webhook")
    ).rejects.toThrow("Webhook IP address is private or local");
  });

  // --- Hostnames bloqués ---

  it("rejette localhost", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://localhost/webhook")
    ).rejects.toThrow("Webhook hostname is not allowed");
  });

  it("rejette les hostnames *.local", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://myserver.local/webhook")
    ).rejects.toThrow("Webhook hostname is not allowed");
  });

  it("rejette les hostnames *.internal", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("http://api.internal/webhook")
    ).rejects.toThrow("Webhook hostname is not allowed");
  });

  // --- Résolution DNS vers IP privée (SSRF via DNS rebinding) ---

  it("rejette si le hostname résout vers une IP privée", async () => {
    mockLookup.mockResolvedValue([
      { address: "10.0.0.1", family: 4 },
    ]);

    await expect(
      assertSafeWebhookUrl("https://evil-ssrf.example.com/webhook")
    ).rejects.toThrow("Webhook hostname resolves to private or local IP");
  });

  it("rejette si le hostname résout vers 127.0.0.1", async () => {
    mockLookup.mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(
      assertSafeWebhookUrl("https://malicious.com/webhook")
    ).rejects.toThrow("Webhook hostname resolves to private or local IP");
  });

  it("rejette si l'une des IPs résolues est privée (multi-IP)", async () => {
    mockLookup.mockResolvedValue([
      { address: "1.2.3.4", family: 4 },
      { address: "192.168.0.1", family: 4 },
    ]);

    await expect(
      assertSafeWebhookUrl("https://partial-private.example.com/webhook")
    ).rejects.toThrow("Webhook hostname resolves to private or local IP");
  });

  // --- URLs valides ---

  it("accepte une URL HTTPS externe valide", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);

    await expect(
      assertSafeWebhookUrl("https://example.com/webhook")
    ).resolves.toBeUndefined();
  });

  it("accepte une IP publique directe en HTTPS", async () => {
    // 1.1.1.1 n'est pas dans les plages privées
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    await expect(
      assertSafeWebhookUrl("https://1.1.1.1/webhook")
    ).resolves.toBeUndefined();
  });

  it("accepte HTTP quand ALLOW_INSECURE_WEBHOOK_URLS=true", async () => {
    process.env.ALLOW_INSECURE_WEBHOOK_URLS = "true";
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);

    await expect(
      assertSafeWebhookUrl("http://example.com/webhook")
    ).resolves.toBeUndefined();
  });
});
