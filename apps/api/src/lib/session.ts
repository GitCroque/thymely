import { FastifyRequest } from "fastify";
import { User } from "@prisma/client";
import jwt from "jsonwebtoken";
import { getSessionToken } from "./request-token";
import { prisma } from "../prisma";

const REQUEST_SESSION_CACHE_KEY = "__thymelySessionUser";

// Checks session token and returns user object
export async function checkSession(
  request: FastifyRequest
): Promise<User | null> {
  const cachedRequest = request as FastifyRequest & {
    [REQUEST_SESSION_CACHE_KEY]?: User | null;
  };

  if (
    Object.prototype.hasOwnProperty.call(cachedRequest, REQUEST_SESSION_CACHE_KEY)
  ) {
    return cachedRequest[REQUEST_SESSION_CACHE_KEY] ?? null;
  }

  try {
    const token = getSessionToken(request);
    if (!token) {
      cachedRequest[REQUEST_SESSION_CACHE_KEY] = null;
      return null;
    }

    const b64string = process.env.SECRET;
    const secret = Buffer.from(b64string!, "base64");

    try {
      jwt.verify(token, secret);
    } catch {
      await prisma.session.deleteMany({
        where: { sessionToken: token },
      });
      cachedRequest[REQUEST_SESSION_CACHE_KEY] = null;
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });

    if (!session || session.expires < new Date()) {
      if (session) {
        await prisma.session.delete({
          where: { id: session.id },
        });
      }
      cachedRequest[REQUEST_SESSION_CACHE_KEY] = null;
      return null;
    }

    const currentUserAgent = request.headers["user-agent"] || "";

    // User-agent binding is always checked (catches session theft across browsers)
    if (session.userAgent && session.userAgent !== currentUserAgent) {
      await prisma.session.delete({
        where: { id: session.id },
      });
      cachedRequest[REQUEST_SESSION_CACHE_KEY] = null;
      return null;
    }

    // IP binding is opt-in (SESSION_BIND_IP=true) — mobile users change IPs frequently
    const bindIp = process.env.SESSION_BIND_IP === "true";
    if (bindIp && session.ipAddress && session.ipAddress !== request.ip) {
      await prisma.session.delete({
        where: { id: session.id },
      });
      cachedRequest[REQUEST_SESSION_CACHE_KEY] = null;
      return null;
    }

    cachedRequest[REQUEST_SESSION_CACHE_KEY] = session.user;
    return session.user;
  } catch {
    cachedRequest[REQUEST_SESSION_CACHE_KEY] = null;
    return null;
  }
}
