import { FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function isSecureCookie(request: FastifyRequest): boolean {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }

  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;

  return proto ? proto.toLowerCase().includes("https") : true;
}

export function setSessionCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string
) {
  const secure = isSecureCookie(request);

  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(request: FastifyRequest, reply: FastifyReply) {
  const secure = isSecureCookie(request);

  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
}
