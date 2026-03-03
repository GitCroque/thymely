import crypto from "crypto";
import { prisma } from "../../prisma";

const ENCRYPTION_PREFIX = "enc:v1";

let cachedKey: Buffer | null = null;

function decodeEnvKey(input: string): Buffer {
  const trimmed = input.trim();

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const asBase64 = Buffer.from(trimmed, "base64");
    if (asBase64.length >= 32) {
      return asBase64;
    }
  } catch {
    // Fallback to utf-8 below.
  }

  return Buffer.from(trimmed, "utf8");
}

function normalizeKey(rawKey: Buffer): Buffer {
  if (rawKey.length === 32) {
    return rawKey;
  }

  return crypto.createHash("sha256").update(rawKey as any).digest();
}

async function resolveEncryptionKey(): Promise<Buffer> {
  if (cachedKey) {
    return cachedKey;
  }

  const envKey = process.env.DATA_ENCRYPTION_KEY;
  if (envKey) {
    cachedKey = normalizeKey(decodeEnvKey(envKey));
    return cachedKey;
  }

  const config = await prisma.config.findFirst({
    select: {
      encryption_key: true,
    },
  });

  if (!config?.encryption_key) {
    throw new Error(
      "Unable to resolve encryption key. Define DATA_ENCRYPTION_KEY or initialize config.encryption_key."
    );
  }

  cachedKey = normalizeKey(Buffer.from(config.encryption_key));
  return cachedKey;
}

function isEncrypted(value: string): boolean {
  return value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

export async function encryptSecret(
  value: string | null | undefined
): Promise<string | null | undefined> {
  if (!value) {
    return value;
  }

  if (isEncrypted(value)) {
    return value;
  }

  const key = await resolveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key as any, iv as any);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8") as any,
    cipher.final() as any,
  ] as any);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString("base64")}:${tag.toString(
    "base64"
  )}:${encrypted.toString("base64")}`;
}

export async function decryptSecret(
  value: string | null | undefined
): Promise<string | null | undefined> {
  if (!value) {
    return value;
  }

  if (!isEncrypted(value)) {
    return value;
  }

  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted secret format");
  }

  const [, , ivB64, tagB64, dataB64] = parts;

  const key = await resolveEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key as any,
    iv as any
  );
  decipher.setAuthTag(tag as any);

  const decrypted = Buffer.concat(
    [decipher.update(data as any) as any, decipher.final() as any] as any
  );
  return decrypted.toString("utf8");
}
