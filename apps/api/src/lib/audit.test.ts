import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing audit
vi.mock("../prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "test-id" }),
    },
  },
}));

import { auditLog } from "./audit";
import { prisma } from "../prisma";

describe("auditLog", () => {
  const mockRequest = {
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    log: { error: vi.fn() },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an audit log entry", async () => {
    await auditLog(mockRequest, {
      action: "test.action",
      userId: "user-123",
      target: "User",
      targetId: "target-456",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "test.action",
        userId: "user-123",
        target: "User",
        targetId: "target-456",
        ip: "127.0.0.1",
        userAgent: "test-agent",
      }),
    });
  });

  it("handles missing user-agent", async () => {
    const reqNoUA = {
      ip: "127.0.0.1",
      headers: {},
      log: { error: vi.fn() },
    } as any;

    await auditLog(reqNoUA, { action: "test" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userAgent: null,
      }),
    });
  });

  it("does not throw on DB error", async () => {
    (prisma.auditLog.create as any).mockRejectedValueOnce(
      new Error("DB down")
    );

    await expect(
      auditLog(mockRequest, { action: "test" })
    ).resolves.toBeUndefined();

    expect(mockRequest.log.error).toHaveBeenCalled();
  });

  it("passes metadata as JSON", async () => {
    await auditLog(mockRequest, {
      action: "test",
      metadata: { key: "value", nested: { a: 1 } },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { key: "value", nested: { a: 1 } },
      }),
    });
  });
});
