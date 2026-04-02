import fs from "fs";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const {
  mockCheckSession,
  mockTicketFindUnique,
  mockTicketFileFindMany,
  mockTicketFileFindUnique,
  mockTicketFileDelete,
} = vi.hoisted(() => ({
  mockCheckSession: vi.fn(),
  mockTicketFindUnique: vi.fn(),
  mockTicketFileFindMany: vi.fn(),
  mockTicketFileFindUnique: vi.fn(),
  mockTicketFileDelete: vi.fn(),
}));

vi.mock("../../lib/session", () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

vi.mock("../../prisma", () => ({
  prisma: {
    ticket: {
      findUnique: mockTicketFindUnique,
    },
    ticketFile: {
      findMany: mockTicketFileFindMany,
      findUnique: mockTicketFileFindUnique,
      delete: mockTicketFileDelete,
      create: vi.fn(),
    },
  },
}));

import { objectStoreRoutes } from "../storage";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TICKET_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";
const uploadsDir = path.join(process.cwd(), "uploads");

function writeUploadFixture(filename: string, content: string) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, content, "utf8");
  return filepath;
}

describe("Storage controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    objectStoreRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSession.mockResolvedValue({ id: USER_ID, isAdmin: true });
    mockTicketFindUnique.mockResolvedValue({ id: TICKET_ID });
    mockTicketFileFindMany.mockResolvedValue([
      {
        id: FILE_ID,
        filename: "report.txt",
        mime: "text/plain",
        size: 12,
        ticketId: TICKET_ID,
        userId: USER_ID,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockTicketFileFindUnique.mockResolvedValue(null);
    mockTicketFileDelete.mockResolvedValue({});
  });

  it("liste les fichiers d'un ticket", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/storage/ticket/${TICKET_ID}/files`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      files: [
        expect.objectContaining({
          id: FILE_ID,
          filename: "report.txt",
        }),
      ],
    });
  });

  it("retourne 404 si le ticket n'existe pas", async () => {
    mockTicketFindUnique.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/storage/ticket/${TICKET_ID}/files`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      success: false,
      message: "Ticket not found",
    });
  });

  it("telecharge un fichier par son fileId", async () => {
    const filepath = writeUploadFixture("download-test.txt", "download-content");
    mockTicketFileFindUnique.mockResolvedValueOnce({
      id: FILE_ID,
      filename: "report.txt",
      path: path.relative(process.cwd(), filepath),
      mime: "text/plain",
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/storage/file/${FILE_ID}/download`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toBe("download-content");
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.headers["content-disposition"]).toContain('filename="report.txt"');
  });

  it("supprime le fichier disque et l'enregistrement Prisma", async () => {
    const filepath = writeUploadFixture("delete-test.txt", "to-delete");
    mockTicketFileFindUnique.mockResolvedValueOnce({
      id: FILE_ID,
      filename: "delete-test.txt",
      path: path.relative(process.cwd(), filepath),
      mime: "text/plain",
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/storage/file/${FILE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockTicketFileDelete).toHaveBeenCalledWith({
      where: { id: FILE_ID },
    });
    expect(fs.existsSync(filepath)).toBe(false);
  });
});
