import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const {
  mockNotesCreate,
  mockNotesFindMany,
  mockNotesFindUnique,
  mockNotesDelete,
  mockNotesUpdate,
  mockCheckSession,
  mockTrackCapture,
  mockTrackShutdown,
} = vi.hoisted(() => ({
  mockNotesCreate: vi.fn(),
  mockNotesFindMany: vi.fn(),
  mockNotesFindUnique: vi.fn(),
  mockNotesDelete: vi.fn(),
  mockNotesUpdate: vi.fn(),
  mockCheckSession: vi.fn(),
  mockTrackCapture: vi.fn(),
  mockTrackShutdown: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    notes: {
      create: mockNotesCreate,
      findMany: mockNotesFindMany,
      findUnique: mockNotesFindUnique,
      delete: mockNotesDelete,
      update: mockNotesUpdate,
    },
  },
}));

vi.mock("../../lib/session", () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({
    capture: mockTrackCapture,
    shutdownAsync: mockTrackShutdown,
  }),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

import { notebookRoutes } from "../notebook";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";

describe("Notebook controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    notebookRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSession.mockResolvedValue({ id: USER_ID });
    mockNotesCreate.mockResolvedValue({ id: NOTE_ID });
    mockNotesFindMany.mockResolvedValue([
      {
        id: NOTE_ID,
        title: "Runbook",
        note: "Documented",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        userId: USER_ID,
        Favourited: false,
      },
    ]);
    mockNotesFindUnique.mockResolvedValue({
      id: NOTE_ID,
      title: "Runbook",
      note: "Documented",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      userId: USER_ID,
      Favourited: false,
    });
    mockNotesDelete.mockResolvedValue({});
    mockNotesUpdate.mockResolvedValue({});
  });

  it("valide le payload de creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/notebook/note/create",
      payload: { title: "Incomplete" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("cree une note", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/notebook/note/create",
      payload: {
        title: "Runbook",
        content: "Documented",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      id: NOTE_ID,
    });
    expect(mockNotesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          title: "Runbook",
          note: "Documented",
        }),
      })
    );
  });

  it("liste les notes de l'utilisateur courant", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/notebooks/all",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().notebooks).toHaveLength(1);
    expect(mockNotesFindMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("met a jour une note", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/notebooks/note/${NOTE_ID}/update`,
      payload: {
        title: "Updated",
        content: "Updated note",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockNotesUpdate).toHaveBeenCalledOnce();
  });

  it("supprime une note", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/notebooks/note/${NOTE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockNotesDelete).toHaveBeenCalledOnce();
  });
});
