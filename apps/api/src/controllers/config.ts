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
import { requirePermission } from "../lib/roles";
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
}

export function configRoutes(fastify: FastifyInstance) {
  // Check auth method
  fastify.get(
    "/api/v1/config/authentication/check",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = await prisma.config.findFirst();

      //@ts-expect-error
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
    { preHandler: requirePermission(["settings::manage"]) },
    async (request, reply) => {
      const { clientId, clientSecret, redirectUri, issuer, jwtSecret: _jwtSecret } =
        request.body;
      const encryptedClientSecret = await encryptSecret(clientSecret);

      const conf = await prisma.config.findFirst();

      await prisma.config.update({
        where: { id: conf!.id },
        data: {
          sso_active: true,
          sso_provider: "oidc",
        },
      });

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
    { preHandler: requirePermission(["settings::manage"]) },
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

      const conf = await prisma.config.findFirst();

      // Update config to true
      await prisma.config.update({
        where: { id: conf!.id },
        data: {
          sso_active: true,
          sso_provider: "oauth",
        },
      });

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
    { preHandler: requirePermission(["settings::manage"]) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const conf = await prisma.config.findFirst();

      // Update config to false
      await prisma.config.update({
        where: { id: conf!.id },
        data: {
          sso_active: false,
          sso_provider: "",
        },
      });

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
    { preHandler: requirePermission(["settings::manage"]) },
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
    { preHandler: requirePermission(["settings::manage"]) },
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
          //@ts-expect-error
          email?.clientId,
          decryptedSecret,
          email?.redirectUri
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
    { preHandler: requirePermission(["settings::manage"]) },
    async (request, reply) => {
      const { code } = request.query;

      const email = await prisma.email.findFirst();
      const decryptedClientSecret = await decryptSecret(email?.clientSecret);

      const google = new OAuth2Client(
        //@ts-expect-error
        email?.clientId,
        decryptedClientSecret,
        email?.redirectUri
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
    { preHandler: requirePermission(["settings::manage"]) },
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

      const config = await prisma.config.findFirst();

      await prisma.config.update({
        where: { id: config!.id },
        data: {
          roles_active: isActive,
        },
      });

      reply.send({
        success: true,
        message: "Roles updated!",
      });
    }
  );
}
