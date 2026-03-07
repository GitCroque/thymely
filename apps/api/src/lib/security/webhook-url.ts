import dns from "dns/promises";
import net from "net";

const PRIVATE_V4_RANGES: Array<[string, number]> = [
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["0.0.0.0", 8],
];

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .map((part) => Number(part))
    .reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);

  return PRIVATE_V4_RANGES.some(([rangeIp, prefix]) => {
    const rangeInt = ipv4ToInt(rangeIp);
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower === "::"
  );
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  return (
    lower === "localhost" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  );
}

function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);

  if (family === 4) {
    return isPrivateIPv4(ip);
  }

  if (family === 6) {
    return isPrivateIPv6(ip);
  }

  return true;
}

export async function assertSafeWebhookUrl(rawUrl: string) {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  const allowInsecure = process.env.ALLOW_INSECURE_WEBHOOK_URLS === "true";
  if (!allowInsecure && url.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Unsupported webhook protocol");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error("Webhook hostname is not allowed");
  }

  // url.hostname for IPv6 addresses includes brackets: "[::1]" — strip them
  const rawHostname = url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;

  const family = net.isIP(rawHostname);
  if (family !== 0) {
    if (isPrivateAddress(rawHostname)) {
      throw new Error("Webhook IP address is private or local");
    }
    return;
  }

  const records = await dns.lookup(rawHostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new Error("Unable to resolve webhook hostname");
  }

  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new Error("Webhook hostname resolves to private or local IP");
    }
  }
}
