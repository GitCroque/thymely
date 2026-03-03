import { FastifyRequest } from "fastify";

const INVALID_TOKEN_VALUES = new Set(["", "null", "undefined"]);

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim();
  if (INVALID_TOKEN_VALUES.has(token.toLowerCase())) {
    return null;
  }

  return token.length > 0 ? token : null;
}

export function getBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return normalizeToken(token);
}

export function getSessionCookieToken(request: FastifyRequest): string | null {
  const token = (request as any).cookies?.session;
  return normalizeToken(token);
}

export function getSessionToken(request: FastifyRequest): string | null {
  return getBearerToken(request) ?? getSessionCookieToken(request);
}
