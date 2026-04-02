import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const mockTicketCount = vi.hoisted(() => vi.fn());

vi.mock("../../prisma", () => ({
  prisma: {
    ticket: {
      count: mockTicketCount,
    },
  },
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

import { dataRoutes } from "../data";

describe("Data controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    dataRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockTicketCount.mockResolvedValue(7);
  });

  it.each([
    ["/api/v1/data/tickets/all", { hidden: false }],
    ["/api/v1/data/tickets/completed", { isComplete: true, hidden: false }],
    ["/api/v1/data/tickets/open", { isComplete: false, hidden: false }],
    ["/api/v1/data/tickets/unassigned", { userId: null, hidden: false, isComplete: false }],
  ])("retourne le compteur pour %s", async (url, where) => {
    const response = await app.inject({
      method: "GET",
      url,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ count: 7 });
    expect(mockTicketCount).toHaveBeenLastCalledWith({ where });
  });
});
