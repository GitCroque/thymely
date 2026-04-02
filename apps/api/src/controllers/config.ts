// Check Github Version
// Add outbound email provider
// Email Verification
// SSO Provider
// Portal Locale
// Feature Flags
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";

import { auditLog } from "../lib/audit";
import { track } from "../lib/hog";
import logger from "../lib/logger";
import { createTransportProvider } from "../lib/nodemailer/transport";
import { invalidateConfigCache, requirePermission } from "../lib/roles";
import { decryptSecret, encryptSecret } from "../lib/security/secrets";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

async function tracking(event: string, properties: Record<string, string>) {
  const client = track();

  client.capture({
    event: event,
    properties: properties,
    distinctId: "uuid",
  });
  client.shutdownAsync();
}

async function ensureConfig(reply: FastifyReply) {
  const config = await prisma.config.findFirst();
  if (!config) {
    reply.code(500).send({
      success: false,
      message: "Configuration not found. Please run the setup wizard.",
    });
    return null;
  }
  return config;
}

export function configRoutes(fastify: FastifyInstance) {
  // Check auth method
  fastify.get(
    "/api/v1/config/authentication/check",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              sso: { type: "boolean" },
              provider: { type: "string" },
            },
            required: ["success", "sso"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = await ensureConfig(reply);
      if (!config) return;

      const { sso_active, sso_provider } = config;

      if (sso_active) {
        return reply.send({
          success: true,
          sso: sso_active,
          provider: sso_provider,
        });
      }

      return reply.send({
        success: true,
        sso: sso_active,
      });
    }
  );

  // Update OIDC Provider
  fastify.post<{
    Body: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      issuer: string;
      jwtSecret: string | undefined;
    };
  }>(
    "/api/v1/config/authentication/oidc/update",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            clientId: { type: "string", maxLength: 500 },
            clientSecret: { type: "string", maxLength: 2000 },
            redirectUri: { type: "string", maxLength: 2000 },
            issuer: { type: "string", maxLength: 2000 },
            jwtSecret: { type: "string", nullable: true, maxLength: 2000 },
          },
          required: ["clientId", "clientSecret", "redirectUri", "issuer"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { clientId, clientSecret, redirectUri, issuer, jwtSecret: _jwtSecret } =
        request.body;
      const encryptedClientSecret = await encryptSecret(clientSecret);

      const conf = await ensureConfig(reply);
      if (!conf) return;

      await prisma.config.update({
        where: { id: conf.id },
        data: {
          sso_active: true,
          sso_provider: "oidc",
        },
      });
      invalidateConfigCache();

      const existingProvider = await prisma.openIdConfig.findFirst();

      if (existingProvider === null) {
        await prisma.openIdConfig.create({
          data: {
            clientId: clientId,
            clientSecret: encryptedClientSecret || null,
            redirectUri: redirectUri,
            issuer: issuer,
          },
        });
      } else {
        await prisma.openIdConfig.update({
          where: { id: existingProvider.id },
          data: {
            clientId: clientId,
            clientSecret: encryptedClientSecret || null,
            redirectUri: redirectUri,
            issuer: issuer,
          },
        });
      }

      await auditLog(request, { action: "config.sso_update", metadata: { provider: "oidc" } });

      await tracking("oidc_provider_updated", {});

      reply.send({
        success: true,
        message: "OIDC config Provider updated!",
      });
    }
  );

  // Update Oauth Provider
  fastify.post<{
    Body: {
      name: string;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      tenantId: string | undefined;
      issuer: string | undefined;
      jwtSecret: string | undefined;
    };
  }>(
    "/api/v1/config/authentication/oauth/update",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 200 },
            clientId: { type: "string", maxLength: 500 },
            clientSecret: { type: "string", maxLength: 2000 },
            redirectUri: { type: "string", maxLength: 2000 },
            tenantId: { type: "string", nullable: true, maxLength: 500 },
            issuer: { type: "string", nullable: true, maxLength: 2000 },
            jwtSecret: { type: "string", nullable: true, maxLength: 2000 },
          },
          required: ["name", "clientId", "clientSecret", "redirectUri"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request, reply) => {
      const {
        name,
        clientId,
        clientSecret,
        redirectUri,
        tenantId: _tenantId,
        issuer: _issuer,
        jwtSecret: _jwtSecret,
      } = request.body;
      const encryptedClientSecret = (await encryptSecret(clientSecret)) || "";

      const conf = await ensureConfig(reply);
      if (!conf) return;

      // Update config to true
      await prisma.config.update({
        where: { id: conf.id },
        data: {
          sso_active: true,
          sso_provider: "oauth",
        },
      });
      invalidateConfigCache();

      // Check if the provider exists
      const existingProvider = await prisma.oAuthProvider.findFirst();

      if (existingProvider === null) {
        await prisma.oAuthProvider.create({
          data: {
            name: name,
            clientId: clientId,
            clientSecret: encryptedClientSecret,
            redirectUri: redirectUri,
            scope: "", // Add appropriate scope if needed
            authorizationUrl: "", // Add appropriate URL if needed
            tokenUrl: "", // Add appropriate URL if needed
            userInfoUrl: "", // Add appropriate URL if needed
          },
        });
      } else {
        await prisma.oAuthProvider.update({
          where: { id: existingProvider.id },
          data: {
            clientId: clientId,
            clientSecret: encryptedClientSecret,
            redirectUri: redirectUri,
          },
        });
      }

      await auditLog(request, { action: "config.sso_update", metadata: { provider: "oauth" } });

      await tracking("oauth_provider_updated", {});

      reply.send({
        success: true,
        message: "SSO Provider updated!",
      });
    }
  );

  // Delete auth config
  fastify.delete(
    "/api/v1/config/authentication",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const conf = await ensureConfig(reply);
      if (!conf) return;

      // Update config to false
      await prisma.config.update({
        where: { id: conf.id },
        data: {
          sso_active: false,
          sso_provider: "",
        },
      });
      invalidateConfigCache();

      // Delete the OAuth provider
      await prisma.oAuthProvider.deleteMany({});

      await tracking("sso_provider_deleted", {});

      reply.send({
        success: true,
        message: "SSO Provider deleted!",
      });
    }
  );

  // Check if Emails are enabled & GET email settings
  fastify.get(
    "/api/v1/config/email",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              active: { type: "boolean" },
              email: {
                type: "object",
                properties: {
                  active: { type: "boolean" },
                  host: { type: "string", nullable: true },
                  port: { type: "string", nullable: true },
                  reply: { type: "string", nullable: true },
                  user: { type: "string", nullable: true },
                },
              },
              verification: {},
            },
            required: ["success", "active"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // GET EMAIL SETTINGS
      const config = await prisma.email.findFirst({
        select: {
          active: true,
          host: true,
          port: true,
          reply: true,
          user: true,
        },
      });

      if (config && config?.active) {
        const provider = await createTransportProvider();

        const verification = await new Promise((resolve) => {
          provider.verify(function (error: Error | null, success: true | undefined) {
            if (error) {
              logger.error(error, "Email verification failed");
              resolve(error);
              return;
            }

            logger.debug("Email verification successful");
            resolve(success);
          });
        });

        return reply.send({
          success: true,
          active: true,
          email: config,
          verification,
        });
      }

      return reply.send({
        success: true,
        active: false,
      });
    }
  );

  // Update Email Provider Settings
  fastify.put<{
    Body: {
      host: string;
      active: boolean;
      port: string;
      reply: string;
      username: string;
      password: string;
      serviceType: string;
      clientId: string | undefined;
      clientSecret: string | undefined;
      redirectUri: string | undefined;
    };
  }>(
    "/api/v1/config/email",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            host: { type: "string", maxLength: 255 },
            active: { type: "boolean" },
            port: { type: "string", maxLength: 10 },
            reply: { type: "string", format: "email", maxLength: 254 },
            username: { type: "string", maxLength: 254 },
            password: { type: "string", maxLength: 500 },
            serviceType: { type: "string", maxLength: 50 },
            clientId: { type: "string", nullable: true, maxLength: 500 },
            clientSecret: { type: "string", nullable: true, maxLength: 2000 },
            redirectUri: { type: "string", nullable: true, maxLength: 2000 },
          },
          required: ["host", "active", "port", "reply", "username", "password", "serviceType"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              authorizeUrl: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request, reply) => {
      const {
        host,
        active,
        port,
        reply: replyto,
        username,
        password,
        serviceType,
        clientId,
        clientSecret,
        redirectUri,
      } = request.body;
      const encryptedPassword = await encryptSecret(password);
      const encryptedClientSecret = await encryptSecret(clientSecret);

      const email = await prisma.email.findFirst();

      if (email === null) {
        await prisma.email.create({
          data: {
            host: host,
            port: port,
            reply: replyto,
            user: username,
            pass: encryptedPassword,
            active: true,
            clientId: clientId,
            clientSecret: encryptedClientSecret,
            serviceType: serviceType,
            redirectUri: redirectUri,
          },
        });
      } else {
        await prisma.email.update({
          where: { id: email.id },
          data: {
            host: host,
            port: port,
            reply: replyto,
            user: username,
            pass: encryptedPassword,
            active: active,
            clientId: clientId,
            clientSecret: encryptedClientSecret,
            serviceType: serviceType,
            redirectUri: redirectUri,
          },
        });
      }

      if (serviceType === "gmail") {
        const email = await prisma.email.findFirst();

        const decryptedSecret = await decryptSecret(email?.clientSecret);

        const google = new OAuth2Client(
          email?.clientId ?? undefined,
          decryptedSecret ?? undefined,
          email?.redirectUri ?? undefined
        );

        const authorizeUrl = google.generateAuthUrl({
          access_type: "offline",
          scope: "https://mail.google.com",
          prompt: "consent",
        });

        reply.send({
          success: true,
          message: "SSO Provider updated!",
          authorizeUrl: authorizeUrl,
        });
        return;
      }

      reply.send({
        success: true,
        message: "SSO Provider updated!",
      });
    }
  );

  // Google oauth callback
  fastify.get<{
    Querystring: {
      code: string;
    };
  }>(
    "/api/v1/config/email/oauth/gmail",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        querystring: {
          type: "object",
          properties: {
            code: { type: "string", minLength: 1 },
          },
          required: ["code"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.query;

      const email = await prisma.email.findFirst();
      const decryptedClientSecret = await decryptSecret(email?.clientSecret);

      const google = new OAuth2Client(
        email?.clientId ?? undefined,
        decryptedClientSecret ?? undefined,
        email?.redirectUri ?? undefined
      );

      const r = await google.getToken(code);

      await prisma.email.update({
        where: { id: email?.id },
        data: {
          refreshToken: await encryptSecret(r.tokens.refresh_token),
          accessToken: await encryptSecret(r.tokens.access_token),
          expiresIn: r.tokens.expiry_date,
          serviceType: "gmail",
        },
      });

      reply.send({
        success: true,
        message: "SSO Provider updated!",
      });
    }
  );

  // Disable/Enable Email
  fastify.delete(
    "/api/v1/config/email",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await prisma.email.deleteMany({});

      reply.send({
        success: true,
        message: "Email settings deleted!",
      });
    }
  );

  // Toggle all roles
  fastify.patch<{
    Body: {
      isActive: boolean;
    };
  }>(
    "/api/v1/config/toggle-roles",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            isActive: { type: "boolean" },
          },
          required: ["isActive"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { isActive } = request.body;
      const session = await checkSession(request);

      // Double-check that user is admin
      if (!session?.isAdmin) {
        return reply.code(403).send({
          message: "Unauthorized. Admin access required.",
          success: false,
        });
      }

      const config = await ensureConfig(reply);
      if (!config) return;

      await prisma.config.update({
        where: { id: config.id },
        data: {
          roles_active: isActive,
        },
      });
      invalidateConfigCache();

      reply.send({
        success: true,
        message: "Roles updated!",
      });
    }
  );
}
