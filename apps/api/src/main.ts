import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import "dotenv/config";
import Fastify, { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";

import { track } from "./lib/hog";
import { getEmails } from "./lib/imap";
import { checkSession } from "./lib/session";
import { prisma } from "./prisma";
import { registerRoutes } from "./routes";

const trustProxy = process.env.TRUST_PROXY === "true";

const server: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
  disableRequestLogging: true,
  trustProxy,
});

const rawCorsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && rawCorsOrigins.length === 0) {
  console.warn(
    "[SECURITY] CORS_ORIGIN is not configured. Defaulting to permissive mode. " +
      "Set CORS_ORIGIN to a comma-separated allowlist for production hardening."
  );
}

if (isProduction && (!process.env.SECRET || process.env.SECRET.length < 32)) {
  throw new Error(
    "SECRET environment variable must be set and at least 32 characters in production"
  );
}

server.register(compress, { threshold: 1024 });
server.register(cookie);

server.register(cors, {
  origin: rawCorsOrigins.length > 0 ? rawCorsOrigins : false,
  credentials: rawCorsOrigins.length > 0,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
});

server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (request) => request.ip,
});

server.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 },
});

server.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode ?? 500;
  if (statusCode === 403 || statusCode === 429) {
    request.log.warn({ security: true, event: statusCode === 429 ? "rate_limit_hit" : "forbidden", ip: request.ip, url: request.url }, "Security event");
  }
  reply.status(statusCode).send({
    success: false,
    message: statusCode === 500 ? "Internal server error" : error.message,
  });
});

server.addHook("onSend", async (request, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return payload;
});

const publicRoutes = new Set([
  "GET /",
  "POST /api/v1/auth/login",
  "POST /api/v1/auth/user/register/external",
  "POST /api/v1/auth/password-reset",
  "POST /api/v1/auth/password-reset/code",
  "POST /api/v1/auth/password-reset/password",
  "GET /api/v1/auth/check",
  "GET /api/v1/auth/oidc/callback",
  "GET /api/v1/auth/oauth/callback",
  "POST /api/v1/ticket/public/create",
  "GET /api/v1/config/authentication/check",
]);

const publicRoutePrefixes = [
  {
    method: "GET",
    prefix: "/api/v1/kb/public/",
  },
];

server.addHook("preHandler", async (request, reply) => {
  const route = request.url.split("?")[0];
  const routeKey = `${request.method.toUpperCase()} ${route}`;

  if (
    publicRoutes.has(routeKey) ||
    publicRoutePrefixes.some(
      (publicRoute) =>
        publicRoute.method === request.method.toUpperCase() &&
        route.startsWith(publicRoute.prefix)
    )
  ) {
    return;
  }

  const user = await checkSession(request);
  if (!user) {
    return reply.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }
});

registerRoutes(server);

server.get(
  "/",
  {
    schema: {
      tags: ["health"],
      description: "Health check endpoint",
      response: {
        200: {
          type: "object",
          properties: {
            healthy: { type: "boolean" },
            version: { type: "string" },
            uptime: { type: "integer" },
          },
        },
      },
    },
  },
  async function (_request, response) {
    response.send({
      healthy: true,
      version: process.env.APP_VERSION || "dev",
      uptime: Math.floor(process.uptime()),
    });
  }
);

const start = async () => {
  try {
    await prisma.$connect();
    server.log.info("Connected to Prisma");

    const port = 5003;

    const address = await server.listen({ port: Number(port), host: "0.0.0.0" });

    const client = track();
    client.capture({
      event: "server_started",
      distinctId: "uuid",
    });
    client.shutdownAsync();
    server.log.info({ address }, "Server listening");

    const BASE_IMAP_INTERVAL = 60000;
    const MAX_IMAP_INTERVAL = 300000;
    let currentImapInterval = BASE_IMAP_INTERVAL;
    let emailSyncInProgress = false;

    function scheduleImapSync() {
      setTimeout(async () => {
        if (emailSyncInProgress) {
          scheduleImapSync();
          return;
        }

        emailSyncInProgress = true;
        try {
          await getEmails();
          currentImapInterval = BASE_IMAP_INTERVAL;
        } catch (error) {
          server.log.error(error, "IMAP sync failed");
          currentImapInterval = Math.min(
            currentImapInterval * 2,
            MAX_IMAP_INTERVAL
          );
        } finally {
          emailSyncInProgress = false;
          scheduleImapSync();
        }
      }, currentImapInterval);
    }

    scheduleImapSync();
  } catch (err) {
    server.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
