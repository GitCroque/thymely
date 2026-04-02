import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auditLog } from "../lib/audit";
import { track } from "../lib/hog";
import { parsePagination } from "../lib/pagination";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

const paginationQuerySchema = {
  type: "object",
  properties: {
    page: { type: "string", pattern: "^[0-9]+$" },
    limit: { type: "string", pattern: "^[0-9]+$" },
  },
  additionalProperties: false,
} as const;

const roleIdParamSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const successResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
  },
  required: ["success"],
  additionalProperties: true,
} as const;

const rolesListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    roles: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "integer" },
        limit: { type: "integer" },
        total: { type: "integer" },
      },
      required: ["page", "limit", "total"],
      additionalProperties: false,
    },
    roles_active: { type: "object", additionalProperties: true },
  },
  required: ["success", "roles", "pagination", "roles_active"],
  additionalProperties: true,
} as const;

const roleResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    role: { type: "object", additionalProperties: true },
  },
  required: ["success", "role"],
  additionalProperties: true,
} as const;

const roleUpdateBodySchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 500 },
    permissions: { type: "array", items: { type: "string" } },
    isDefault: { type: "boolean" },
    users: {
      anyOf: [
        { type: "string", format: "uuid" },
        {
          type: "array",
          items: { type: "string", format: "uuid" },
        },
      ],
    },
  },
  additionalProperties: false,
} as const;

const roleAssignmentBodySchema = {
  type: "object",
  properties: {
    userId: { type: "string", format: "uuid" },
    roleId: { type: "string", format: "uuid" },
  },
  required: ["userId", "roleId"],
  additionalProperties: false,
} as const;

const userResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    user: { type: "object", additionalProperties: true },
  },
  required: ["success", "user"],
  additionalProperties: true,
} as const;

export function roleRoutes(fastify: FastifyInstance) {
  // Create a new role
  fastify.post<{
    Body: {
      name: string;
      description: string | undefined;
      permissions: string[] | undefined;
      isDefault: boolean | undefined;
    };
  }>(
    "/api/v1/role/create",
    {
      preHandler: requirePermission(["role::create"]),
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 100 },
            description: { type: "string", maxLength: 500 },
            permissions: { type: "array", items: { type: "string" } },
            isDefault: { type: "boolean" },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const user = await checkSession(request);
      const { name, description, permissions, isDefault } = request.body;

      const existingRole = await prisma.role.findUnique({
        where: { name },
      });

      if (existingRole) {
        return reply.status(400).send({
          message: "Role already exists",
          success: false,
        });
      }

      const role = await prisma.role.create({
        data: {
          name,
          description,
          permissions,
          isDefault: isDefault || false,
        },
      });

      await auditLog(request, { action: "role.create", userId: user!.id, target: "Role", targetId: role.id, metadata: { name } });

      const client = track();
      client.capture({
        event: "role_created",
        distinctId: "uuid",
      });
      client.shutdownAsync();

      reply.status(200).send({ message: "Role created!", success: true });
    }
  );

  // Get all roles
  fastify.get(
    "/api/v1/roles/all",
    {
      preHandler: requirePermission(["role::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: rolesListResponseSchema },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const [roles, total, active] = await Promise.all([
        prisma.role.findMany({
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            users: false,
          },
        }),
        prisma.role.count(),
        prisma.config.findFirst({
          select: {
            roles_active: true,
          },
        }),
      ]);

      reply.status(200).send({ roles, pagination: { page, limit, total }, success: true, roles_active: active });
    }
  );

  // Get role by ID
  fastify.get<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/role/:id",
    {
      preHandler: requirePermission(["role::read"]),
      schema: {
        params: roleIdParamSchema,
        response: { 200: roleResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const role = await prisma.role.findUnique({
        where: { id },
        include: {
          users: true,
        },
      });

      if (!role) {
        return reply.status(404).send({
          message: "Role not found",
          success: false,
        });
      }

      reply.status(200).send({ role, success: true });
    }
  );

  // Update role
  fastify.put<{
    Params: {
      id: string;
    };
    Body: {
      name: string | undefined;
      description: string | undefined;
      permissions: string[] | undefined;
      isDefault: boolean | undefined;
      users: string | string[];
    };
  }>(
    "/api/v1/role/:id/update",
    {
      preHandler: requirePermission(["role::update"]),
      schema: {
        params: roleIdParamSchema,
        body: roleUpdateBodySchema,
        response: { 200: roleResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, description, permissions, isDefault, users } =
        request.body;

      try {
        const updatedRole = await prisma.role.update({
          where: { id },
          data: {
            name,
            description,
            permissions,
            isDefault,
            users: {
              set: Array.isArray(users)
                ? users.map((userId) => ({ id: userId }))
                : [{ id: users }], // Ensure users is an array of objects with unique IDs when updating
            },
          },
        });

        reply.status(200).send({ role: updatedRole, success: true });
      } catch (error) {
        if ((error as { code?: string }).code === "P2025") {
          return reply.status(404).send({
            message: "Role not found",
            success: false,
          });
        }
        throw error;
      }
    }
  );

  // Toggle role active state
  fastify.patch<{
    Params: {
      id: string;
    };
    Body: {
      isActive: boolean;
    };
  }>(
    "/api/v1/role/:id/toggle",
    {
      preHandler: requirePermission(["role::update"]),
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
        body: {
          type: "object",
          properties: {
            isActive: { type: "boolean" },
          },
          required: ["isActive"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { isActive } = request.body;
      const session = await checkSession(request);

      try {
        const updatedRole = await prisma.role.update({
          where: { id },
          data: {
            active: isActive,
          },
        });

        await auditLog(request, {
          action: "role.toggle",
          userId: session?.id,
          target: "Role",
          targetId: id,
          metadata: { active: isActive },
        });

        reply.status(200).send({ role: updatedRole, success: true });
      } catch (error) {
        if ((error as { code?: string }).code === "P2025") {
          return reply.status(404).send({
            message: "Role not found",
            success: false,
          });
        }
        throw error;
      }
    }
  );

  // Delete role
  fastify.delete<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/role/:id/delete",
    {
      preHandler: requirePermission(["role::delete"]),
      schema: {
        params: roleIdParamSchema,
        response: { 200: successResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await prisma.role.delete({
          where: { id },
        });

        await auditLog(request, { action: "role.delete", target: "Role", targetId: id });

        reply.status(200).send({ success: true });
      } catch (error) {
        if ((error as { code?: string }).code === "P2025") {
          return reply.status(404).send({
            message: "Role not found",
            success: false,
          });
        }
        throw error;
      }
    }
  );

  // Assign role to user
  fastify.post<{
    Body: {
      userId: string;
      roleId: string;
    };
  }>(
    "/api/v1/role/assign",
    {
      preHandler: requirePermission(["role::update"]),
      schema: {
        body: roleAssignmentBodySchema,
        response: { 200: userResponseSchema },
      },
    },
    async (request, reply) => {
      const { userId, roleId } = request.body;

      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            roles: {
              connect: { id: roleId },
            },
          },
          include: {
            roles: true,
          },
        });

        reply.status(200).send({ user: updatedUser, success: true });
      } catch (error) {
        if ((error as { code?: string }).code === "P2025") {
          return reply.status(404).send({
            message: "User or Role not found",
            success: false,
          });
        }
        throw error;
      }
    }
  );

  // Remove role from user
  fastify.post<{
    Body: {
      userId: string;
      roleId: string;
    };
  }>(
    "/api/v1/role/remove",
    {
      preHandler: requirePermission(["role::manage"]),
      schema: {
        body: roleAssignmentBodySchema,
        response: { 200: userResponseSchema },
      },
    },
    async (request, reply) => {
      const { userId, roleId } = request.body;

      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            roles: {
              disconnect: { id: roleId },
            },
          },
          include: {
            roles: true,
          },
        });

        reply.status(200).send({ user: updatedUser, success: true });
      } catch (error) {
        if ((error as { code?: string }).code === "P2025") {
          return reply.status(404).send({
            message: "User or Role not found",
            success: false,
          });
        }
        throw error;
      }
    }
  );
}
