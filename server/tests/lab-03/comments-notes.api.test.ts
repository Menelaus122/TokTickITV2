import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 3, Issue 7 — Public Comments and Internal Notes (API-22 to API-29 in
// docs/lab-03/tests.md; specification.md §5.6, api-spec §4). Needs the migrated
// and seeded database:  cd server && npx prisma migrate deploy && npm run prisma:seed

const prisma = getPrisma();

const cookies = {} as Record<"owner" | "otherRequester" | "staff" | "admin", string>;
const ids = {} as Record<"owner" | "staff" | "admin", number>;
let ticketId: number;
let ticketOfOther: number;
const createdTicketIds: number[] = [];

async function makeTicket(requesterId: number, summary: string): Promise<number> {
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9994-${String((Date.now() + createdTicketIds.length) % 90000).padStart(5, "0")}`,
      requesterId,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary,
      description: "Created by the comments and notes API suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket.id;
}

/** Every object key in a JSON value, at any depth. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
  }
  return [];
}

function post(path: string, cookie: string, body: unknown) {
  return request(app).post(path).set("Cookie", cookie).send(body as object);
}

function get(path: string, cookie: string) {
  return request(app).get(path).set("Cookie", cookie);
}

beforeAll(async () => {
  const [owner, other] = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true, mustChangePassword: false },
    orderBy: { id: "asc" },
    take: 2,
  });
  const staff = await prisma.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true, mustChangePassword: false } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } });
  ids.owner = owner.id;
  ids.staff = staff.id;
  ids.admin = admin.id;

  cookies.owner = await signInAs(owner.id);
  cookies.otherRequester = await signInAs(other.id);
  cookies.staff = await signInAs(staff.id);
  cookies.admin = await signInAs(admin.id);

  ticketId = await makeTicket(owner.id, "Comments suite ticket");
  ticketOfOther = await makeTicket(other.id, "Comments suite ticket of another Requester");
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await endTestSessions();
  await prisma.$disconnect();
});

describe("Public Comments", () => {
  it("API-22 the owning Requester, IT Staff, and an Administrator all post to and read one thread", async () => {
    const posted = [
      await post(`/api/tickets/${ticketId}/comments`, cookies.owner, { body: "  The printer still jams on page two.  " }),
      await post(`/api/tickets/${ticketId}/comments`, cookies.staff, { body: "We are sending a technician this afternoon." }),
      await post(`/api/tickets/${ticketId}/comments`, cookies.admin, { body: "Escalated with the vendor." }),
    ];
    for (const res of posted) expect(res.status).toBe(201);
    expect(posted[0].body.body).toBe("The printer still jams on page two."); // stored trimmed
    expect(posted[1].body.author).toEqual({ id: ids.staff, fullName: expect.any(String), role: "IT_STAFF" });

    const threads = await Promise.all([cookies.owner, cookies.staff, cookies.admin].map((c) => get(`/api/tickets/${ticketId}/comments`, c)));
    for (const res of threads) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual(threads[0].body);
    }
    const comments = threads[0].body.comments as { id: number; body: string; createdAt: string; author: { id: number; role: string } }[];
    expect(comments.map((c) => c.id)).toEqual(posted.map((p) => p.body.id)); // oldest first
    expect(comments.map((c) => c.author.role)).toEqual(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]);
    for (const c of comments) {
      expect(Object.keys(c).sort()).toEqual(["author", "body", "createdAt", "id"]);
      expect(Object.keys(c.author).sort()).toEqual(["fullName", "id", "role"]);
      expect(Number.isNaN(Date.parse(c.createdAt))).toBe(false);
    }
  });

  it("API-23 another Requester's thread is 404, exactly like a ticket that does not exist", async () => {
    const missing = await get(`/api/tickets/999999999/comments`, cookies.owner);
    expect(missing.status).toBe(404);
    for (const res of [
      await get(`/api/tickets/${ticketOfOther}/comments`, cookies.owner),
      await post(`/api/tickets/${ticketOfOther}/comments`, cookies.owner, { body: "Not my ticket." }),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(missing.body);
    }
    expect(await prisma.publicComment.count({ where: { ticketId: ticketOfOther } })).toBe(0);
  });

  it("a malformed ticket id is 400 INVALID_QUERY", async () => {
    for (const id of ["abc", "9999999999", "1e0"]) {
      const res = await get(`/api/tickets/${id}/comments`, cookies.staff);
      expect(res.status, id).toBe(400);
      expect(res.body.error.code).toBe("INVALID_QUERY");
    }
  });

  it("without a session is 401", async () => {
    expect((await request(app).get(`/api/tickets/${ticketId}/comments`)).status).toBe(401);
    expect((await request(app).post(`/api/tickets/${ticketId}/comments`).send({ body: "Hi" })).status).toBe(401);
  });
});

describe("Internal Notes", () => {
  it("IT Staff and an Administrator post to and read one note thread", async () => {
    const staffNote = await post(`/api/tickets/${ticketId}/notes`, cookies.staff, { body: "Fuser unit looks worn; order part 44-B." });
    const adminNote = await post(`/api/tickets/${ticketId}/notes`, cookies.admin, { body: "Vendor contract covers the part." });
    expect(staffNote.status).toBe(201);
    expect(adminNote.status).toBe(201);

    for (const cookie of [cookies.staff, cookies.admin]) {
      const res = await get(`/api/tickets/${ticketId}/notes`, cookie);
      expect(res.status).toBe(200);
      expect(res.body.notes.map((n: { id: number }) => n.id)).toEqual([staffNote.body.id, adminNote.body.id]);
    }
  });

  it("API-26 a note is absent from every response the owning Requester can get", async () => {
    const note = "Secret: the asset is out of warranty.";
    expect((await post(`/api/tickets/${ticketId}/notes`, cookies.staff, { body: note })).status).toBe(201);
    const staffName = (await prisma.user.findUniqueOrThrow({ where: { id: ids.staff } })).fullName;

    const responses = [
      await get(`/api/tickets/${ticketId}`, cookies.owner),
      await get(`/api/tickets/${ticketId}/comments`, cookies.owner),
      await get(`/api/tickets/${ticketId}/attachments`, cookies.owner),
      await get(`/api/tickets?pageSize=50`, cookies.owner),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(note);
      // No field anywhere names notes, so not even a count leaks (BR-23).
      expect(keysOf(res.body).filter((key) => /note/i.test(key))).toEqual([]);
    }
    // The only staff author the Requester may see is on a public comment.
    const thread = responses[1].body.comments as { body: string; author: { fullName: string } }[];
    expect(thread.every((c) => c.author.fullName !== staffName || !c.body.includes("Secret"))).toBe(true);
  });
});

describe("content rules", () => {
  it("API-24 rejects empty and whitespace-only bodies on comments and notes, field by field", async () => {
    const before = [await prisma.publicComment.count(), await prisma.internalNote.count()];
    for (const thread of ["comments", "notes"]) {
      for (const body of ["", "   \n\t "]) {
        const res = await post(`/api/tickets/${ticketId}/${thread}`, cookies.staff, { body });
        expect(res.status, `${thread} ${JSON.stringify(body)}`).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_FAILED");
        expect(res.body.error.fields.body).toMatch(/required/);
      }
    }
    for (const body of [undefined, null, 42, ["a"], { text: "a" }]) {
      const res = await post(`/api/tickets/${ticketId}/comments`, cookies.owner, { body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect([await prisma.publicComment.count(), await prisma.internalNote.count()]).toEqual(before);
  });

  it("API-25 accepts 2000 characters after trimming and refuses 2001", async () => {
    for (const thread of ["comments", "notes"]) {
      const atLimit = await post(`/api/tickets/${ticketId}/${thread}`, cookies.staff, { body: `  ${"a".repeat(2000)}  ` });
      expect(atLimit.status, thread).toBe(201);
      expect(atLimit.body.body).toHaveLength(2000);

      const over = await post(`/api/tickets/${ticketId}/${thread}`, cookies.staff, { body: "a".repeat(2001) });
      expect(over.status, thread).toBe(400);
      expect(over.body.error.fields.body).toMatch(/2000/);
    }
  });

  it("stores markup as text and returns it as text (BR-43)", async () => {
    const markup = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const res = await post(`/api/tickets/${ticketId}/comments`, cookies.owner, { body: markup });
    expect(res.status).toBe(201);
    expect(res.body.body).toBe(markup);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("API-27 has no edit or delete route for a comment or a note", async () => {
    const comment = await post(`/api/tickets/${ticketId}/comments`, cookies.staff, { body: "Append-only check." });
    const note = await post(`/api/tickets/${ticketId}/notes`, cookies.staff, { body: "Append-only check." });
    const paths = [
      `/api/tickets/${ticketId}/comments/${comment.body.id}`,
      `/api/tickets/${ticketId}/notes/${note.body.id}`,
      `/api/comments/${comment.body.id}`,
      `/api/notes/${note.body.id}`,
    ];
    for (const path of paths) {
      for (const method of ["patch", "put", "delete"] as const) {
        const res = await request(app)[method](path).set("Cookie", cookies.staff).send({ body: "Edited" });
        expect(res.status, `${method} ${path}`).toBe(404);
      }
    }
    for (const method of ["patch", "put", "delete"] as const) {
      expect((await request(app)[method](`/api/tickets/${ticketId}/comments`).set("Cookie", cookies.staff).send({})).status).toBe(404);
    }
    expect((await prisma.publicComment.findUniqueOrThrow({ where: { id: comment.body.id } })).body).toBe("Append-only check.");
    expect((await prisma.internalNote.findUniqueOrThrow({ where: { id: note.body.id } })).body).toBe("Append-only check.");
  });

  it("API-28 takes the author and timestamp from the server, never the request", async () => {
    const forged = { body: "Forged metadata check.", authorId: ids.admin, createdAt: "2001-01-01T00:00:00.000Z", ticketId: ticketOfOther };
    for (const thread of ["comments", "notes"]) {
      const before = Date.now();
      const res = await post(`/api/tickets/${ticketId}/${thread}`, cookies.staff, forged);
      expect(res.status, thread).toBe(201);
      expect(res.body.author.id).toBe(ids.staff);
      expect(Date.parse(res.body.createdAt)).toBeGreaterThanOrEqual(before - 1000);
      const table = thread === "comments" ? prisma.publicComment : prisma.internalNote;
      const row = await (table as typeof prisma.publicComment).findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.ticketId).toBe(ticketId);
      expect(row.authorId).toBe(ids.staff);
    }
  });

  it("API-29 posting a comment or a note advances the ticket's updatedAt", async () => {
    for (const thread of ["comments", "notes"]) {
      const past = new Date("2026-01-01T00:00:00.000Z");
      await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: past } });
      const res = await post(`/api/tickets/${ticketId}/${thread}`, cookies.staff, { body: `Touch check for ${thread}.` });
      expect(res.status).toBe(201);
      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      expect(ticket.updatedAt.getTime(), thread).toBeGreaterThan(past.getTime());
      expect(Math.abs(ticket.updatedAt.getTime() - Date.parse(res.body.createdAt))).toBeLessThan(5000);
    }
  });

  it("a refused post leaves the ticket's updatedAt alone", async () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: past } });
    expect((await post(`/api/tickets/${ticketId}/comments`, cookies.owner, { body: " " })).status).toBe(400);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).updatedAt.getTime()).toBe(past.getTime());
  });
});
