import axios from "axios";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { LRUCache } from "lru-cache";
import { generators } from "openid-client";
import { AuthorizationCode } from "simple-oauth2";
import { getOAuthProvider, getOidcConfig } from "../lib/auth";
import { track } from "../lib/hog";
import { forgotPassword } from "../lib/nodemailer/auth/forgot-password";
import { getSessionToken } from "../lib/request-token";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { clearSessionCookie, setSessionCookie } from "../lib/session-cookie";
import { auditLog } from "../lib/audit";
import { getOAuthClient } from "../lib/utils/oauth_client";
import { getOidcClient } from "../lib/utils/oidc_client";
import { prisma } from "../prisma";

const options = {
  max: 500, // Maximum number of items in cache
  ttl: 1000 * 60 * 5, // Items expire after 5 minutes
};

const cache = new LRUCache(options);

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getUserEmails(token: string) {
  const res = await axios.get("https://api.github.com/user/emails", {
    headers: {
      Authorization: `token ${token}`,
    },
  });

  // Return only the primary email address
  const primaryEmail = res.data.find(
    (email: { primary: boolean }) => email.primary
  );
  return primaryEmail ? primaryEmail.email : null; // Return the email or null if not found
}

function generateRandomPassword(length: number): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  const randomBytes = crypto.randomBytes(length);

  return Array.from(randomBytes)
    .map((byte) => charset[byte % charset.length])
    .join("");
}

async function tracking(event: string, properties: Record<string, string>) {
  const client = track();

  client.capture({
    event: event,
    properties: properties,
    distinctId: "uuid",
  });
}

function buildSessionToken(userId: string): string {
  const secret = Buffer.from(process.env.SECRET!, "base64");
  return jwt.sign(
    {
      data: {
        id: userId,
        sessionId: crypto.randomBytes(32).toString("hex"),
      },
    },
    secret,
    {
      expiresIn: "8h",
      algorithm: "HS256",
    }
  );
}

export function authRoutes(fastify: FastifyInstance) {
  // Register a new user
  fastify.post(
    "/api/v1/auth/user/register",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", maxLength: 254 },
            password: { type: "string", minLength: 8, maxLength: 128 },
            admin: { type: "boolean" },
            name: { type: "string", maxLength: 200 },
          },
          required: ["email", "password", "name", "admin"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password, admin, name } = request.body as {
        email: string;
        password: string;
        admin: boolean;
        name: string;
      };

      const requester = await checkSession(request);

      if (!requester?.isAdmin) {
        return reply.code(401).send({
          message: "Unauthorized",
        });
      }

      // Checks if email already exists
      const record = await prisma.user.findUnique({
        where: { email },
      });

      // if exists, return 400
      if (record) {
        return reply.code(400).send({
          message: "Email already exists",
        });
      }

      const user = await prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(password, 12),
          name,
          isAdmin: admin,
        },
      });

      await auditLog(request, { action: "user.create", userId: requester!.id, target: "User", targetId: user.id });

      const hog = track();

      hog.capture({
        event: "user_registered",
        distinctId: user.id,
      });

      reply.send({
        success: true,
      });
    }
  );

  // Register a new external user
  fastify.post(
    "/api/v1/auth/user/register/external",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "15 minutes" },
      },
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", maxLength: 254 },
            password: { type: "string", minLength: 8, maxLength: 128 },
            name: { type: "string", maxLength: 200 },
            language: { type: "string" },
          },
          required: ["email", "password", "name"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password, name, language } = request.body as {
        email: string;
        password: string;
        name: string;
        language: string;
      };

      // Checks if email already exists
      const record = await prisma.user.findUnique({
        where: { email },
      });

      // if exists, return 400
      if (record) {
        return reply.code(400).send({
          message: "Email already exists",
        });
      }

      const user = await prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(password, 12),
          name,
          isAdmin: false,
          language,
          external_user: true,
          firstLogin: false,
        },
      });

      const hog = track();

      hog.capture({
        event: "user_registered_external",
        distinctId: user.id,
      });

      reply.send({
        success: true,
      });
    }
  );

  // Forgot password and generate one-time token
  fastify.post(
    "/api/v1/auth/password-reset",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.body as { email: string };
      const forwardedProto = request.headers["x-forwarded-proto"];
      const proto = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto || "http";
      const origin =
        process.env.PUBLIC_APP_URL || `${proto}://${request.headers.host}`;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        await prisma.passwordResetToken.deleteMany({
          where: { userId: user.id },
        });

        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            code: hashResetToken(resetToken),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });

        await forgotPassword(email, origin, resetToken);
      }

      reply.send({
        success: true,
      });
    }
  );

  // Validate password reset token
  fastify.post(
    "/api/v1/auth/password-reset/code",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.body as { token: string };
      if (!token) {
        return reply.code(400).send({
          message: "Missing token",
          success: false,
        });
      }

      const tokenHash = hashResetToken(token);

      const reset = await prisma.passwordResetToken.findFirst({
        where: { code: tokenHash, expiresAt: { gt: new Date() } },
      });

      if (!reset) {
        return reply.code(401).send({
          message: "Invalid or expired token",
          success: false,
        });
      }

      reply.send({
        success: true,
      });
    }
  );

  // Reset user password using one-time token
  fastify.post(
    "/api/v1/auth/password-reset/password",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { password, token } = request.body as {
        password: string;
        token: string;
      };
      if (!token) {
        return reply.code(400).send({
          message: "Missing token",
          success: false,
        });
      }

      if (!password || password.length < 8) {
        return reply.code(400).send({
          message: "Password must be at least 8 characters",
          success: false,
        });
      }

      const tokenHash = hashResetToken(token);
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: { code: tokenHash, expiresAt: { gt: new Date() } },
      });

      if (!resetToken) {
        return reply.code(401).send({
          message: "Invalid or expired token",
          success: false,
        });
      }

      await prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: await bcrypt.hash(password, 12),
        },
      });

      await prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      });

      await prisma.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId },
      });

      await auditLog(request, { action: "auth.password_reset", target: "User", targetId: resetToken.userId });

      reply.send({
        success: true,
      });
    }
  );

  // User password login route
  fastify.post(
    "/api/v1/auth/login",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", maxLength: 254 },
            password: { type: "string", maxLength: 128 },
          },
          required: ["email", "password"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user?.password || user.isDeleted) {
        request.log.warn({ security: true, event: "login_failed", email, ip: request.ip }, "Failed login attempt");
        await auditLog(request, { action: "auth.login_failed", metadata: { email } });
        return reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user!.password);

      if (!isPasswordValid) {
        request.log.warn({ security: true, event: "login_failed", email, ip: request.ip }, "Failed login attempt");
        await auditLog(request, { action: "auth.login_failed", metadata: { email } });
        reply.code(401).send({
          message: "Invalid email or password",
        });
        throw new Error("Password is not valid");
      }

      const token = buildSessionToken(user!.id);

      // Store session with additional security info
      await prisma.session.create({
        data: {
          userId: user!.id,
          sessionToken: token,
          expires: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
          userAgent: request.headers["user-agent"] || "",
          ipAddress: request.ip,
        },
      });

      await auditLog(request, { action: "auth.login", userId: user!.id });

      await tracking("user_logged_in_password", {});

      const data = {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        isAdmin: user!.isAdmin,
        language: user!.language,
        ticket_created: user!.notify_ticket_created,
        ticket_status_changed: user!.notify_ticket_status_changed,
        ticket_comments: user!.notify_ticket_comments,
        ticket_assigned: user!.notify_ticket_assigned,
        firstLogin: user!.firstLogin,
        external_user: user!.external_user,
      };

      setSessionCookie(request, reply, token);

      reply.send({
        user: data,
      });
    }
  );

  // Checks if a user is password auth or other
  fastify.get(
    "/api/v1/auth/check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authtype = await prisma.config.findMany({
        where: {
          sso_active: true,
        },
      });

      if (authtype.length === 0) {
        return reply.code(200).send({
          success: true,
          message: "SSO not enabled",
          oauth: false,
        });
      }

      const provider = authtype[0].sso_provider;
      const sso_active = authtype[0].sso_active;

      if (!sso_active) {
        return reply.code(200).send({
          success: true,
          message: "SSO not enabled",
          oauth: false,
        });
      }

      // Find out which config type it is, then action accordinly
      switch (provider) {
        case "oidc":
          const config = await getOidcConfig();
          if (!config) {
            return reply
              .code(500)
              .send({ error: "OIDC configuration not found" });
          }

          const oidcClient = await getOidcClient(config);

          // Generate codeVerifier and codeChallenge
          const codeVerifier = generators.codeVerifier();
          const codeChallenge = generators.codeChallenge(codeVerifier);

          // Generate a random state parameter
          const state = generators.state();

          // Store codeVerifier in cache with s
          cache.set(state, {
            codeVerifier: codeVerifier,
          });

          // Generate authorization URL
          const url = oidcClient.authorizationUrl({
            scope: "openid email profile",
            response_type: "code",
            redirect_uri: config.redirectUri,
            code_challenge: codeChallenge,
            code_challenge_method: "S256", // Use 'plain' if 'S256' is not supported
            state: state,
          });

          reply.send({
            type: "oidc",
            success: true,
            url: url,
          });

          break;
        case "oauth":
          const oauthProvider = await getOAuthProvider();

          if (!oauthProvider) {
            return reply.code(500).send({
              error: `OAuth provider ${provider} configuration not found`,
            });
          }

          const client = getOAuthClient({
            ...oauthProvider,
            name: oauthProvider.name,
          });

          const oauthState = generators.state();
          cache.set(oauthState, { provider: "oauth" });

          // Generate authorization URL
          const uri = client.authorizeURL({
            redirect_uri: oauthProvider.redirectUri,
            scope: oauthProvider.scope,
            state: oauthState,
          });

          reply.send({
            type: "oauth",
            success: true,
            url: uri,
          });

          break;
        default:
          break;
      }
    }
  );

  // oidc api callback route
  fastify.get(
    "/api/v1/auth/oidc/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oidc = await getOidcConfig();

        const oidcClient = await getOidcClient(oidc);
        if (!oidcClient) {
          return reply
            .code(500)
            .send({ error: "OIDC configuration not properly set" });
        }

        // Parse the callback parameters
        const params = oidcClient.callbackParams(request.raw);

        if (params.iss === "undefined") {
          // Remove the trailing part and ensure a trailing slash
          params.iss = oidc.issuer.replace(
            /\/\.well-known\/openid-configuration$/,
            "/"
          );
        }

        // Retrieve the state parameter from the callback
        const state = params.state;
        if (!state) {
          return reply.status(400).send("Invalid or expired session");
        }

        const sessionData = cache.get(state) as { codeVerifier?: string } | undefined;

        if (!sessionData) {
          return reply.status(400).send("Invalid or expired session");
        }

        const { codeVerifier } = sessionData;

        // Handle the case where codeVerifier is not found
        if (!codeVerifier) {
          return reply.status(400).send("Invalid or expired session");
        }

        const tokens = await oidcClient.callback(
          oidc.redirectUri,
          params,
          {
            code_verifier: codeVerifier,
            state: state,
          }
        );

        // Clean up: Remove the codeVerifier from the cache
        cache.delete(state);

        // Retrieve user information
        if (!tokens.access_token) {
          return reply.status(400).send({
            success: false,
            error: "OIDC access token missing",
          });
        }
        const userInfo = await oidcClient.userinfo(tokens.access_token);
        if (!userInfo.email) {
          return reply.status(400).send({
            success: false,
            error: "OIDC email claim missing",
          });
        }

        let user = await prisma.user.findUnique({
          where: { email: userInfo.email },
        });

        await tracking("user_logged_in_oidc", {});

        if (!user) {
          // Create a new basic user
          user = await prisma.user.create({
            data: {
              email: userInfo.email,
              password: await bcrypt.hash(generateRandomPassword(12), 12), // Set a random password of length 12
              name: userInfo.name || "New User", // Use the name from userInfo or a default
              isAdmin: false, // Set isAdmin to false for basic users
              language: "en", // Set a default language
              external_user: false, // Mark as external user
              firstLogin: true, // Set firstLogin to true
            },
          });
        }

        const signedToken = buildSessionToken(user.id);

        // Create a session
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: signedToken,
            expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
            userAgent: request.headers["user-agent"] || "",
            ipAddress: request.ip,
          },
        });

        setSessionCookie(request, reply, signedToken);

        // Send Response
        reply.send({
          onboarding: user.firstLogin,
          success: true,
        });
      } catch (error) {
        request.log.error(error, "Authentication error");
        reply.status(403).send({
          success: false,
          error: "OIDC callback error",
          details: (error as Error).message,
        });
      }
    }
  );

  // oauth api callback route
  fastify.get<{
    Querystring: {
      code: string;
      state: string;
    };
  }>(
    "/api/v1/auth/oauth/callback",
    async (request, reply) => {
      const { code, state } = request.query;
      const oauthProvider = await getOAuthProvider();

      if (!oauthProvider) {
        return reply.code(500).send({
          error: `OAuth provider configuration not found`,
        });
      }

      if (!state) {
        return reply.code(400).send({
          success: false,
          error: "Missing OAuth state",
        });
      }

      const cachedState = cache.get(state as string);
      if (!cachedState) {
        return reply.code(400).send({
          success: false,
          error: "Invalid or expired OAuth state",
        });
      }
      cache.delete(state as string);

      const client = new AuthorizationCode({
        client: {
          id: oauthProvider.clientId,
          secret: oauthProvider.clientSecret || "",
        },
        auth: {
          tokenHost: oauthProvider.authorizationUrl,
        },
      });

      const tokenParams = {
        code,
        redirect_uri: oauthProvider.redirectUri,
      };

      try {
        // Exchange authorization code for an access token
        const fetch_token = await client.getToken(tokenParams);
        const access_token = fetch_token.token.access_token;

        // // Fetch user info from the provider
        const userInfoResponse: any = await axios.get(
          oauthProvider.userInfoUrl,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        );

        const emails =
          oauthProvider.name === "github"
            ? await getUserEmails(access_token as string)
            : userInfoResponse.email;

        // Issue JWT token
        const user = await prisma.user.findUnique({
          where: { email: emails },
        });

        if (!user) {
          return reply.send({
            success: false,
            message: "Invalid email",
          });
        }

        const signedToken = buildSessionToken(user.id);

        // Create a session
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: signedToken,
            expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
            userAgent: request.headers["user-agent"] || "",
            ipAddress: request.ip,
          },
        });

        await tracking("user_logged_in_oauth", {});

        setSessionCookie(request, reply, signedToken);

        // Send Response
        reply.send({
          onboarding: user.firstLogin,
          success: true,
        });
      } catch (error) {
        request.log.error(error, "Authentication error");
        reply.status(403).send({
          success: false,
          error: "OAuth callback error",
          details: (error as Error).message,
        });
      }
    }
  );

  // Delete a user
  fastify.delete(
    "/api/v1/auth/user/:id",
    {
      preHandler: requirePermission(["user::delete"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const requester = await checkSession(request);

      // Check if user exists
      const userToDelete = await prisma.user.findUnique({
        where: { id },
      });

      if (!userToDelete) {
        return reply.code(404).send({
          message: "User not found",
          success: false,
        });
      }

      // Prevent deletion of admin accounts if they're the last admin
      if (userToDelete.isAdmin) {
        const adminCount = await prisma.user.count({
          where: { isAdmin: true, isDeleted: false },
        });

        if (adminCount <= 1) {
          return reply.code(400).send({
            message: "Cannot delete the last admin account",
            success: false,
          });
        }
      }

      await prisma.notes.deleteMany({ where: { userId: id } });
      await prisma.session.deleteMany({ where: { userId: id } });
      await prisma.notifications.deleteMany({ where: { userId: id } });

      await prisma.user.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: requester!.id,
        },
      });

      await auditLog(request, { action: "user.delete", userId: requester!.id, target: "User", targetId: id });

      reply.send({ success: true });
    }
  );

  // User Profile
  fastify.get(
    "/api/v1/auth/profile",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      const config = await prisma.config.findFirst();

      const notifications = await prisma.notifications.findMany({
        where: { userId: user.id },
        orderBy: {
          createdAt: "desc",
        },
      });

      const data = {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        language: user.language,
        ticket_created: user.notify_ticket_created,
        ticket_status_changed: user.notify_ticket_status_changed,
        ticket_comments: user.notify_ticket_comments,
        ticket_assigned: user.notify_ticket_assigned,
        sso_status: config!.sso_active,
        version: config!.client_version,
        notifications,
        external_user: user.external_user,
      };

      await tracking("user_profile", {});

      reply.send({
        user: data,
      });
    }
  );

  // Reset Users password
  fastify.post(
    "/api/v1/auth/reset-password",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { password } = request.body as {
        password: string;
      };

      const session = await checkSession(request);
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      if (!password || password.length < 8) {
        return reply.code(400).send({
          message: "Password must be at least 8 characters",
          success: false,
        });
      }

      const hashedPass = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: session.id },
        data: {
          password: hashedPass,
        },
      });

      await prisma.session.deleteMany({
        where: { userId: session.id },
      });

      clearSessionCookie(request, reply);

      reply.send({
        success: true,
      });
    }
  );

  // Reset password by admin
  fastify.post(
    "/api/v1/auth/admin/reset-password",
    {
      preHandler: requirePermission(["user::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { password, user } = request.body as {
        password: string;
        user: string;
      };

      const currentUser = await checkSession(request);
      if (!currentUser || !currentUser.isAdmin) {
        return reply.code(401).send({
          message: "Unauthorized",
        });
      }

      if (!password || password.length < 8) {
        return reply.code(400).send({
          message: "Password must be at least 8 characters",
          success: false,
        });
      }

      const hashedPass = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: user },
        data: {
          password: hashedPass,
        },
      });

      await prisma.session.deleteMany({
        where: { userId: user },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Update a users profile/config
  fastify.put(
    "/api/v1/auth/profile",
    {
      preHandler: requirePermission(["user::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      const { name, email, language } = request.body as {
        name: string;
        email: string;
        language: string;
      };

      const user = await prisma.user.update({
        where: { id: session?.id },
        data: {
          name: name,
          email: email,
          language: language,
        },
      });

      reply.send({
        user,
      });
    }
  );

  // Update a users Email notification settings
  fastify.put(
    "/api/v1/auth/profile/notifications/emails",
    {
      preHandler: requirePermission(["user::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      const {
        notify_ticket_created,
        notify_ticket_assigned,
        notify_ticket_comments,
        notify_ticket_status_changed,
      } = request.body as {
        notify_ticket_created: boolean;
        notify_ticket_assigned: boolean;
        notify_ticket_comments: boolean;
        notify_ticket_status_changed: boolean;
      };

      const user = await prisma.user.update({
        where: { id: session?.id },
        data: {
          notify_ticket_created: notify_ticket_created,
          notify_ticket_assigned: notify_ticket_assigned,
          notify_ticket_comments: notify_ticket_comments,
          notify_ticket_status_changed: notify_ticket_status_changed,
        },
      });

      reply.send({
        user,
      });
    }
  );

  // Logout a user (deletes session)
  fastify.get(
    "/api/v1/auth/user/:id/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const session = await checkSession(request);
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      // Users can only logout themselves unless they are admin
      if (session.id !== id && !session.isAdmin) {
        return reply.code(403).send({
          message: "Forbidden",
          success: false,
        });
      }

      await prisma.session.deleteMany({
        where: { userId: id },
      });

      await auditLog(request, { action: "auth.logout", userId: session!.id, target: "User", targetId: id });

      clearSessionCookie(request, reply);

      reply.send({ success: true });
    }
  );

  // Update a users role
  fastify.put(
    "/api/v1/auth/user/role",
    {
      preHandler: requirePermission(["user::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      if (session?.isAdmin) {
        const { id, role } = request.body as { id: string; role: boolean };
        if (role === false) {
          const admins = await prisma.user.findMany({
            where: { isAdmin: true },
          });
          if (admins.length === 1) {
            reply.code(400).send({
              message: "At least one admin is required",
              success: false,
            });
            return;
          }
        }
        await prisma.user.update({
          where: { id },
          data: {
            isAdmin: role,
          },
        });

        await auditLog(request, { action: "user.role_change", userId: session!.id, target: "User", targetId: id, metadata: { newRole: role } });

        reply.send({ success: true });
      } else {
        reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }
    }
  );

  // first login
  fastify.post(
    "/api/v1/auth/user/:id/first-login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const session = await checkSession(request);
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      // Users can only update their own first-login flag
      if (session.id !== id) {
        return reply.code(403).send({
          message: "Forbidden",
          success: false,
        });
      }

      await prisma.user.update({
        where: { id },
        data: {
          firstLogin: false,
        },
      });

      await tracking("user_first_login", {});

      reply.send({ success: true });
    }
  );

  // Add a new endpoint to list and manage active sessions
  fastify.get(
    "/api/v1/auth/sessions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = await checkSession(request);
      if (!currentUser) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const sessions = await prisma.session.findMany({
        where: { userId: currentUser.id },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expires: true,
        },
      });

      reply.send({ sessions });
    }
  );

  // GDPR: Right to erasure — anonymize user data
  fastify.post(
    "/api/v1/admin/gdpr/erase/:userId",
    {
      preHandler: requirePermission(["user::manage"]),
      config: {
        rateLimit: { max: 3, timeWindow: "15 minutes" },
      },
      schema: {
        params: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid" },
          },
          required: ["userId"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const session = await checkSession(request);

      if (!session?.isAdmin) {
        return reply.code(403).send({ message: "Admin access required", success: false });
      }

      const userToErase = await prisma.user.findUnique({ where: { id: userId } });
      if (!userToErase) {
        return reply.code(404).send({ message: "User not found", success: false });
      }

      // Anonymize user data
      const anonymizedEmail = `deleted-${crypto.randomBytes(8).toString("hex")}@erased.local`;
      await prisma.user.update({
        where: { id: userId },
        data: {
          name: "Deleted User",
          email: anonymizedEmail,
          password: null,
          image: null,
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: session.id,
        },
      });

      // Delete all sessions
      await prisma.session.deleteMany({ where: { userId } });

      // Anonymize comments
      await prisma.comment.updateMany({
        where: { userId },
        data: {
          replyEmail: null,
        },
      });

      // Delete notifications
      await prisma.notifications.deleteMany({ where: { userId } });

      // Delete notes
      await prisma.notes.deleteMany({ where: { userId } });

      await auditLog(request, {
        action: "gdpr.erase",
        userId: session.id,
        target: "User",
        targetId: userId,
      });

      reply.send({ success: true, message: "User data erased" });
    }
  );

  // Add ability to revoke specific sessions
  fastify.delete(
    "/api/v1/auth/sessions/:sessionId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = await checkSession(request);
      if (!currentUser) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const { sessionId } = request.params as { sessionId: string };

      // Only allow users to delete their own sessions
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId: currentUser.id,
        },
      });

      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }

      await prisma.session.delete({
        where: { id: sessionId },
      });

      const currentToken = getSessionToken(request);
      if (currentToken && session.sessionToken === currentToken) {
        clearSessionCookie(request, reply);
      }

      reply.send({ success: true });
    }
  );
}
