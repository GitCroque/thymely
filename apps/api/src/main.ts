import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { exec } from "child_process";
import "dotenv/config";
import Fastify, { FastifyInstance } from "fastify";
import multer from "fastify-multer";
import fs from "fs";
import util from "util";

import { track } from "./lib/hog";
import { getEmails } from "./lib/imap";
import { backfillEncryptedSecrets } from "./lib/security/backfill";
import { checkSession } from "./lib/session";
import { prisma } from "./prisma";
import { registerRoutes } from "./routes";

const execAsync = util.promisify(exec);

const logFilePath = "./logs.log";
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

const trustProxy = process.env.TRUST_PROXY === "true";

const server: FastifyInstance = Fastify({
  logger: {
    stream: logStream,
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
  throw new Error(
    "CORS_ORIGIN must be configured in production (comma-separated allowlist)."
  );
}

if (isProduction && (!process.env.SECRET || process.env.SECRET.length < 32)) {
  throw new Error(
    "SECRET environment variable must be set and at least 32 characters in production"
  );
}

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
});

server.register(multer.contentParser);

server.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode ?? 500;
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

server.addHook("preHandler", async (request, reply) => {
  const route = request.url.split("?")[0];
  const routeKey = `${request.method.toUpperCase()} ${route}`;

  if (publicRoutes.has(routeKey)) {
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
          },
        },
      },
    },
  },
  async function (_request, response) {
    response.send({ healthy: true });
  }
);

const start = async () => {
  try {
    const { stdout: migrateOut, stderr: migrateErr } = await execAsync(
      "npx prisma migrate deploy"
    );
    console.log(migrateOut);
    if (migrateErr) console.error(migrateErr);

    const { stdout: generateOut, stderr: generateErr } = await execAsync(
      "npx prisma generate"
    );
    console.log(generateOut);
    if (generateErr) console.error(generateErr);

    const { stdout: seedOut, stderr: seedErr } = await execAsync(
      "npx prisma db seed"
    );
    console.log(seedOut);
    if (seedErr) console.error(seedErr);

    await prisma.$connect();
    server.log.info("Connected to Prisma");
    await backfillEncryptedSecrets();

    const port = 5003;

    server.listen(
      { port: Number(port), host: "0.0.0.0" },
      async (err, address) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        const client = track();

        client.capture({
          event: "server_started",
          distinctId: "uuid",
        });

        client.shutdownAsync();
        console.info(`Server listening on ${address}`);
      }
    );

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
