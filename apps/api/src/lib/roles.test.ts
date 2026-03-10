import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing roles
vi.mock("../prisma", () => ({
  prisma: {
    config: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock session
vi.mock("./session", () => ({
  checkSession: vi.fn().mockResolvedValue(null),
}));

import { hasPermission, invalidateConfigCache, InsufficientPermissionsError } from "./roles";
import type { Permission } from "./types/permissions";

// Minimal types matching Prisma's Role and User
type MockRole = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MockUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  roles: MockRole[];
};

function makeRole(overrides: Partial<MockRole> = {}): MockRole {
  return {
    id: "role-1",
    name: "Test Role",
    description: null,
    permissions: [],
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    isAdmin: false,
    roles: [],
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("returns true for admin user regardless of permissions", () => {
    const admin = makeUser({ isAdmin: true, roles: [] });

    expect(hasPermission(admin as any, "issue::create")).toBe(true);
    expect(hasPermission(admin as any, ["issue::create", "user::manage"])).toBe(true);
    expect(hasPermission(admin as any, "settings::manage")).toBe(true);
  });

  it("returns true when user has the required single permission", () => {
    const user = makeUser({
      roles: [makeRole({ permissions: ["issue::create", "issue::read"] })],
    });

    expect(hasPermission(user as any, "issue::create")).toBe(true);
  });

  it("returns false when user lacks the required single permission", () => {
    const user = makeUser({
      roles: [makeRole({ permissions: ["issue::read"] })],
    });

    expect(hasPermission(user as any, "issue::create")).toBe(false);
  });

  it("returns true when user has ALL required permissions (requireAll: true, default)", () => {
    const user = makeUser({
      roles: [
        makeRole({ permissions: ["issue::create", "issue::read", "issue::update"] }),
      ],
    });

    expect(hasPermission(user as any, ["issue::create", "issue::read"])).toBe(true);
    expect(hasPermission(user as any, ["issue::create", "issue::read"], true)).toBe(true);
  });

  it("returns false when user is missing one of the required permissions (requireAll: true)", () => {
    const user = makeUser({
      roles: [makeRole({ permissions: ["issue::create"] })],
    });

    expect(hasPermission(user as any, ["issue::create", "issue::delete"])).toBe(false);
  });

  it("returns true when user has at least one permission (requireAll: false)", () => {
    const user = makeUser({
      roles: [makeRole({ permissions: ["issue::create"] })],
    });

    expect(
      hasPermission(user as any, ["issue::create", "issue::delete"], false)
    ).toBe(true);
  });

  it("returns false when user has none of the required permissions (requireAll: false)", () => {
    const user = makeUser({
      roles: [makeRole({ permissions: ["issue::read"] })],
    });

    expect(
      hasPermission(user as any, ["issue::create", "issue::delete"], false)
    ).toBe(false);
  });

  it("combines permissions from multiple roles", () => {
    const user = makeUser({
      roles: [
        makeRole({ id: "r1", permissions: ["issue::create"] }),
        makeRole({ id: "r2", permissions: ["user::manage"] }),
      ],
    });

    expect(hasPermission(user as any, ["issue::create", "user::manage"])).toBe(true);
  });

  it("includes permissions from the default role", () => {
    const user = makeUser({
      roles: [
        makeRole({ isDefault: true, permissions: ["issue::read", "issue::comment"] }),
        makeRole({ id: "r2", permissions: ["issue::create"] }),
      ],
    });

    expect(
      hasPermission(user as any, ["issue::read", "issue::comment", "issue::create"])
    ).toBe(true);
  });

  it("returns false for user with no roles and no permissions", () => {
    const user = makeUser({ roles: [] });

    expect(hasPermission(user as any, "issue::create")).toBe(false);
  });

  it("handles empty required permissions array (requireAll: true → vacuously true)", () => {
    const user = makeUser({ roles: [] });

    expect(hasPermission(user as any, [], true)).toBe(true);
  });

  it("handles empty required permissions array (requireAll: false → vacuously false)", () => {
    const user = makeUser({ roles: [] });

    expect(hasPermission(user as any, [], false)).toBe(false);
  });

  it("deduplicates permissions across roles", () => {
    const user = makeUser({
      roles: [
        makeRole({ id: "r1", permissions: ["issue::create", "issue::read"] }),
        makeRole({ id: "r2", permissions: ["issue::create", "user::read"] }),
      ],
    });

    // Should work correctly even if same permission appears in multiple roles
    expect(
      hasPermission(user as any, ["issue::create", "issue::read", "user::read"])
    ).toBe(true);
  });
});

describe("invalidateConfigCache", () => {
  it("does not throw when called", () => {
    expect(() => invalidateConfigCache()).not.toThrow();
  });

  it("can be called multiple times without error", () => {
    invalidateConfigCache();
    invalidateConfigCache();
    invalidateConfigCache();
    // No assertion needed beyond no-throw
  });
});

describe("InsufficientPermissionsError", () => {
  it("has default message", () => {
    const error = new InsufficientPermissionsError();
    expect(error.message).toBe("Insufficient permissions");
    expect(error.name).toBe("InsufficientPermissionsError");
  });

  it("accepts custom message", () => {
    const error = new InsufficientPermissionsError("Custom message");
    expect(error.message).toBe("Custom message");
  });

  it("is an instance of Error", () => {
    const error = new InsufficientPermissionsError();
    expect(error).toBeInstanceOf(Error);
  });
});
