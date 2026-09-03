import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app, UPLOAD_DIR } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { MAX_FILE_BYTES } from "../../src/attachments.js";

// API-19 to API-28 — the attachment lifecycle.

const prisma = getPrisma();

let requesterA: number;
let requesterB: number;
let ticketOfA: number;
let ticketOfB: number;
const createdTicketIds: number[] = [];

// A tiny but real PDF, so the type check is exercised against genuine content.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer\n%%EOF\n");
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d494844520000000100000001080600000" + "01f15c4890000000a49444154789c6300010000050001",
  "hex",
);

function attach(requesterId: number | null, ticketId: number, name: string, body: Buffer, mime: string) {
  const req = request(app).post(`/api/tickets/${ticketId}/attachments`);
  if (requesterId !== null) req.set("X-Requester-Id", String(requesterId));
  return req.attach("file", body, { filename: name, contentType: mime });
}

function listAttachments(requesterId: number, ticketId: number) {
  return request(app)
    .get(`/api/tickets/${ticketId}/attachments`)
    .set("X-Requester-Id", String(requesterId));
}

function download(requesterId: number, attachmentId: number) {
  return request(app)
    .get(`/api/attachments/${attachmentId}/download`)
    .set("X-Requester-Id", String(requesterId));
}

function remove(requesterId: number, attachmentId: number, removalReason?: unknown) {
  return request(app)
    .patch(`/api/attachments/${attachmentId}/remove`)
    .set("X-Requester-Id", String(requesterId))
    .send(removalReason === undefined ? {} : { removalReason });
}

async function makeTicket(requesterId: number, number: string, summary: string) {
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: number,
      requesterId,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary,
      description: "Created by the attachments API suite.",
      requestedPriority: "MEDIUM",
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket.id;
}

beforeAll(async () => {
  const [a, b] = await prisma.requesterUser.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  requesterA = a.id;
  requesterB = b.id;
});

// Ticket numbers must be unique, so each test gets its own pair from a
// counter rather than a timestamp two tests could share.
let ticketSeq = 0;

beforeEach(async () => {
  // A fresh ticket per test keeps the five-attachment limit predictable.
  ticketSeq += 1;
  const a = String(ticketSeq * 2 - 1).padStart(5, "0");
  const b = String(ticketSeq * 2).padStart(5, "0");

  ticketOfA = await makeTicket(requesterA, `TT-9994-${a}`, "Attachment suite ticket A");
  ticketOfB = await makeTicket(requesterB, `TT-9994-${b}`, "Attachment suite ticket B");
});

afterAll(async () => {
  // Attachments cascade with their tickets; the stored files are removed too so
  // the suite leaves nothing behind on disk.
  const rows = await prisma.attachment.findMany({
    where: { ticketId: { in: createdTicketIds } },
    select: { storedFilename: true },
  });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  for (const row of rows) {
    await rm(join(UPLOAD_DIR, row.storedFilename), { force: true }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("upload", () => {
  it("stores a permitted file and returns 201 with its metadata", async () => {
    const res = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");

    expect(res.status).toBe(201);
    expect(res.body.originalFilename).toBe("report.pdf");
    expect(res.body.mimeType).toBe("application/pdf");
    expect(res.body.sizeBytes).toBe(PDF.length);
    expect(res.body.removedAt).toBeNull();
    expect(res.body.downloadUrl).toBe(`/api/attachments/${res.body.id}/download`);
  });

  it("writes the bytes under an opaque stored name", async () => {
    const res = await attach(requesterA, ticketOfA, "battery report.pdf", PDF, "application/pdf");
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: res.body.id } });

    expect(row.storedFilename).toMatch(/^[0-9a-f-]{36}\.pdf$/i);
    expect(row.storedFilename).not.toContain("battery");
    expect(existsSync(join(UPLOAD_DIR, row.storedFilename))).toBe(true);
  });

  it("accepts each permitted type", async () => {
    const pdf = await attach(requesterA, ticketOfA, "a.pdf", PDF, "application/pdf");
    const png = await attach(requesterA, ticketOfA, "b.png", PNG, "image/png");

    expect(pdf.status).toBe(201);
    expect(png.status).toBe(201);
  });

  it("rejects an unsupported type with 415 and stores nothing", async () => {
    const before = await prisma.attachment.count({ where: { ticketId: ticketOfA } });
    const res = await attach(requesterA, ticketOfA, "virus.exe", PDF, "application/octet-stream");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(await prisma.attachment.count({ where: { ticketId: ticketOfA } })).toBe(before);
  });

  it("rejects a file whose type contradicts its extension", async () => {
    const res = await attach(requesterA, ticketOfA, "sneaky.pdf", PDF, "application/octet-stream");
    expect(res.status).toBe(415);
  });

  it("rejects a file over 5 MB with 413 and stores nothing", async () => {
    const before = await prisma.attachment.count({ where: { ticketId: ticketOfA } });
    const oversized = Buffer.alloc(MAX_FILE_BYTES + 1024, 0x41);
    const res = await attach(requesterA, ticketOfA, "big.pdf", oversized, "application/pdf");

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
    expect(await prisma.attachment.count({ where: { ticketId: ticketOfA } })).toBe(before);
  });

  it("refuses to attach to another requester's ticket", async () => {
    const res = await attach(requesterA, ticketOfB, "report.pdf", PDF, "application/pdf");

    expect(res.status).toBe(404);
    expect(await prisma.attachment.count({ where: { ticketId: ticketOfB } })).toBe(0);
  });

  it("touches the ticket so Last Updated reflects the change", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketOfA } });
    await new Promise((r) => setTimeout(r, 5));
    await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketOfA } });

    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });
});

describe("the five-active limit", () => {
  it("accepts the fifth attachment and rejects the sixth with 409", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await attach(requesterA, ticketOfA, `file${i}.pdf`, PDF, "application/pdf");
      expect(res.status).toBe(201);
    }

    const sixth = await attach(requesterA, ticketOfA, "file6.pdf", PDF, "application/pdf");
    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
  });

  it("frees a slot when one is removed", async () => {
    const uploaded: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = await attach(requesterA, ticketOfA, `file${i}.pdf`, PDF, "application/pdf");
      uploaded.push(res.body.id);
    }

    expect((await attach(requesterA, ticketOfA, "extra.pdf", PDF, "application/pdf")).status).toBe(409);

    await remove(requesterA, uploaded[0], "Freeing a slot for the test");

    // Removed attachments do not count toward the limit (BR-34).
    expect((await attach(requesterA, ticketOfA, "extra.pdf", PDF, "application/pdf")).status).toBe(201);
  });
});

describe("metadata listing", () => {
  it("lists active and removed attachments together", async () => {
    const kept = await attach(requesterA, ticketOfA, "kept.pdf", PDF, "application/pdf");
    const gone = await attach(requesterA, ticketOfA, "gone.pdf", PDF, "application/pdf");
    await remove(requesterA, gone.body.id, "Uploaded the wrong file");

    const res = await listAttachments(requesterA, ticketOfA);
    const ids = res.body.map((a: { id: number }) => a.id);

    expect(res.status).toBe(200);
    expect(ids).toContain(kept.body.id);
    expect(ids).toContain(gone.body.id);
  });

  it("reports a removed attachment with its reason and no download URL", async () => {
    const gone = await attach(requesterA, ticketOfA, "gone.pdf", PDF, "application/pdf");
    await remove(requesterA, gone.body.id, "Uploaded the wrong file");

    const res = await listAttachments(requesterA, ticketOfA);
    const row = res.body.find((a: { id: number }) => a.id === gone.body.id);

    expect(row.removedAt).toBeTruthy();
    expect(row.removalReason).toBe("Uploaded the wrong file");
    expect(row.downloadUrl).toBeNull();
  });

  it("refuses to list another requester's attachments", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketOfB}/attachments`)
      .set("X-Requester-Id", String(requesterA));

    expect(res.status).toBe(404);
  });
});

describe("download", () => {
  it("streams an active attachment with its original filename", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    const res = await download(requesterA, uploaded.body.id);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain('filename="report.pdf"');
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(res.body).equals(PDF)).toBe(true);
  });

  it("returns 410 for a removed attachment and streams no bytes", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    await remove(requesterA, uploaded.body.id, "Uploaded the wrong file");

    const res = await download(requesterA, uploaded.body.id);

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("ATTACHMENT_REMOVED");
    expect(JSON.stringify(res.body)).not.toContain("%PDF");
  });

  it("returns 404 for another requester's attachment by direct id", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");

    // A direct link is not a bypass (BR-17).
    const res = await download(requesterB, uploaded.body.id);
    expect(res.status).toBe(404);
  });

  it("returns 404 for an attachment that does not exist", async () => {
    const res = await download(requesterA, 999999);
    expect(res.status).toBe(404);
  });
});

describe("soft removal", () => {
  it("keeps the row and the file, stamped with when and why", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    const res = await remove(requesterA, uploaded.body.id, "Uploaded the wrong screenshot");

    expect(res.status).toBe(200);

    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: uploaded.body.id } });
    expect(row.removedAt).not.toBeNull();
    expect(row.removalReason).toBe("Uploaded the wrong screenshot");
    // Soft: the bytes are still on disk (D-05).
    expect(existsSync(join(UPLOAD_DIR, row.storedFilename))).toBe(true);
  });

  it("requires a reason", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");

    for (const bad of [undefined, "", "   ", "abc"]) {
      const res = await remove(requesterA, uploaded.body.id, bad);
      expect(res.status).toBe(400);
      expect(res.body.error.fields.removalReason).toBeTruthy();
    }

    // Still active after every rejected attempt.
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: uploaded.body.id } });
    expect(row.removedAt).toBeNull();
  });

  it("stores the reason trimmed", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    await remove(requesterA, uploaded.body.id, "   Wrong file attached   ");

    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: uploaded.body.id } });
    expect(row.removalReason).toBe("Wrong file attached");
  });

  it("refuses to remove another requester's attachment", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    const res = await remove(requesterB, uploaded.body.id, "Not mine to remove");

    expect(res.status).toBe(404);
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: uploaded.body.id } });
    expect(row.removedAt).toBeNull();
  });

  it("rejects removing the same attachment twice with 409", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    await remove(requesterA, uploaded.body.id, "Uploaded the wrong file");

    const second = await remove(requesterA, uploaded.body.id, "Trying again");
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("ATTACHMENT_ALREADY_REMOVED");
  });

  it("touches the ticket so Last Updated reflects the removal", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "report.pdf", PDF, "application/pdf");
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketOfA } });
    await new Promise((r) => setTimeout(r, 5));

    await remove(requesterA, uploaded.body.id, "Uploaded the wrong file");
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketOfA } });

    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });
});

describe("ticket detail reflects the attachment lifecycle", () => {
  it("shows a removed attachment as retained metadata with no download URL", async () => {
    const uploaded = await attach(requesterA, ticketOfA, "gone.pdf", PDF, "application/pdf");
    await remove(requesterA, uploaded.body.id, "Uploaded the wrong file");

    const res = await request(app)
      .get(`/api/tickets/${ticketOfA}`)
      .set("X-Requester-Id", String(requesterA));

    const row = res.body.attachments.find((a: { id: number }) => a.id === uploaded.body.id);
    expect(row.originalFilename).toBe("gone.pdf");
    expect(row.removalReason).toBe("Uploaded the wrong file");
    expect(row.downloadUrl).toBeNull();
  });
});
