import { describe, it, expect } from "vitest";
import {
  checkActionEdit,
  checkNewAction,
  compareReadingOrder,
  isValidRequestKey,
  type ActionFields,
} from "../../src/actionTakenRules.js";

// Lab 4, Issue 4 — the rules of an Action Taken as pure functions (UNIT-01 to
// UNIT-06 in docs/lab-04/tests.md §2.1; specification.md BR-03 to BR-08, BR-12,
// BR-28, D-18; api-spec §2.2, §2.3).
//
// The clock is always passed in, so every boundary is exact and nothing waits.

const NOW = new Date("2026-10-05T10:00:00.000Z");
const TICKET_CREATED = new Date("2026-10-01T09:00:00.000Z");
const ctx = { now: NOW, ticketCreatedAt: TICKET_CREATED };

const valid = {
  actionAt: "2026-10-05T09:30:00.000Z",
  description: "Replaced the toner cartridge and ran a test page.",
  result: "The test page printed cleanly.",
  followUpRequired: false,
};

const chars = (n: number) => "x".repeat(n);

// The fields a rejected body complains about, or null when it was accepted.
function rejectedFields(body: unknown): string[] | null {
  const checked = checkNewAction(body, ctx);
  return checked.ok ? null : Object.keys(checked.fields).sort();
}

describe("UNIT-01 each text field's length, at both edges (BR-03)", () => {
  it("accepts a valid Action Taken, trimmed, with an optional note stored as null", () => {
    const checked = checkNewAction({ ...valid, description: `  ${valid.description}  ` }, ctx);
    expect(checked).toEqual({
      ok: true,
      value: {
        actionAt: new Date(valid.actionAt),
        description: valid.description,
        result: valid.result,
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
      },
    });
  });

  it.each([
    ["description", 4, 5, 2000, 2001],
    ["result", 1, 2, 1000, 1001],
  ] as const)("%s: %i is too short, %i and %i are allowed, %i is too long", (field, short, min, max, long) => {
    expect(rejectedFields({ ...valid, [field]: chars(short) })).toEqual([field]);
    expect(rejectedFields({ ...valid, [field]: chars(min) })).toBeNull();
    expect(rejectedFields({ ...valid, [field]: chars(max) })).toBeNull();
    expect(rejectedFields({ ...valid, [field]: chars(long) })).toEqual([field]);
  });

  it("follow-up note: 4 is too short, 5 and 1000 are allowed, 1001 is too long", () => {
    const yes = { ...valid, followUpRequired: true };
    expect(rejectedFields({ ...yes, followUpNote: chars(4) })).toEqual(["followUpNote"]);
    expect(rejectedFields({ ...yes, followUpNote: chars(5) })).toBeNull();
    expect(rejectedFields({ ...yes, followUpNote: chars(1000) })).toBeNull();
    expect(rejectedFields({ ...yes, followUpNote: chars(1001) })).toEqual(["followUpNote"]);
  });

  it("attachment notes: 500 is allowed, 501 is too long, and nothing or blanks is stored as null", () => {
    expect(rejectedFields({ ...valid, attachmentNotes: chars(500) })).toBeNull();
    expect(rejectedFields({ ...valid, attachmentNotes: chars(501) })).toEqual(["attachmentNotes"]);
    for (const absent of [undefined, null, "", "   "]) {
      const checked = checkNewAction({ ...valid, attachmentNotes: absent }, ctx);
      expect(checked.ok && checked.value.attachmentNotes, JSON.stringify(absent)).toBeNull();
    }
  });

  it("measures after trimming, so padding cannot satisfy a minimum or break a maximum", () => {
    expect(rejectedFields({ ...valid, description: `  ${chars(4)}  ` })).toEqual(["description"]);
    expect(rejectedFields({ ...valid, description: ` ${chars(2000)} ` })).toBeNull();
  });

  it("reports every offending field at once, one message each, in the order of the form", () => {
    const checked = checkNewAction({ actionAt: "nonsense", description: "no", result: "", followUpRequired: "yes" }, ctx);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(Object.keys(checked.fields)).toEqual(["actionAt", "description", "result", "followUpRequired"]);
    for (const message of Object.values(checked.fields)) expect(message.length).toBeGreaterThan(10);
  });

  it("refuses a body that is not an object, and a field of the wrong type, rather than coercing it", () => {
    for (const body of [null, undefined, "text", 42, []]) expect(rejectedFields(body), JSON.stringify(body)).not.toBeNull();
    expect(rejectedFields({ ...valid, description: 12345678 })).toEqual(["description"]);
    expect(rejectedFields({ ...valid, followUpRequired: "true" })).toEqual(["followUpRequired"]);
    expect(rejectedFields({ ...valid, followUpRequired: 1 })).toEqual(["followUpRequired"]);
    expect(rejectedFields({ ...valid, attachmentNotes: 7 })).toEqual(["attachmentNotes"]);
  });
});

describe("UNIT-02 the follow-up note follows Follow-Up Required? (BR-04, D-18)", () => {
  it("is required for Yes", () => {
    expect(rejectedFields({ ...valid, followUpRequired: true })).toEqual(["followUpNote"]);
    expect(rejectedFields({ ...valid, followUpRequired: true, followUpNote: "   " })).toEqual(["followUpNote"]);
  });

  it("is ignored and stored as null for No, whatever was sent", () => {
    const checked = checkNewAction({ ...valid, followUpRequired: false, followUpNote: "Call back on Thursday." }, ctx);
    expect(checked.ok && checked.value.followUpNote).toBeNull();
    // Even one that would have been invalid is not an error: it is not read.
    expect(rejectedFields({ ...valid, followUpRequired: false, followUpNote: chars(5000) })).toBeNull();
  });

  describe("on an edit, the rules apply to the merged record", () => {
    const stored: ActionFields = {
      actionAt: new Date(valid.actionAt),
      description: valid.description,
      result: valid.result,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    };
    const edit = (body: object) => checkActionEdit(stored, { expectedVersion: 1, ...body }, ctx);

    it("sending Yes onto a record with no note needs a note in the same request", () => {
      const bare = edit({ followUpRequired: true });
      expect(bare.ok).toBe(false);
      expect(!bare.ok && Object.keys(bare.fields)).toEqual(["followUpNote"]);
      const withNote = edit({ followUpRequired: true, followUpNote: "Check again on Thursday." });
      expect(withNote.ok && withNote.value).toMatchObject({ followUpRequired: true, followUpNote: "Check again on Thursday." });
    });

    it("sending No clears a note the record had", () => {
      const yes: ActionFields = { ...stored, followUpRequired: true, followUpNote: "Check again on Thursday." };
      const checked = checkActionEdit(yes, { expectedVersion: 1, followUpRequired: false }, ctx);
      expect(checked.ok && checked.value).toMatchObject({ followUpRequired: false, followUpNote: null });
      expect(checked.ok && checked.changed).toBe(true);
    });

    it("leaves a field that was not sent alone, and reports a body that changes nothing as unchanged", () => {
      const checked = edit({ result: stored.result });
      expect(checked.ok && checked.value).toEqual(stored);
      expect(checked.ok && checked.changed).toBe(false);
      const real = edit({ result: "The toner level is at 100 percent." });
      expect(real.ok && real.changed).toBe(true);
    });

    it("requires expectedVersion to be an integer, and returns it (BR-27)", () => {
      for (const bad of [undefined, null, "1", 1.5, NaN, -1, 0]) {
        const checked = checkActionEdit(stored, { expectedVersion: bad, result: "Changed result." }, ctx);
        expect(checked.ok, JSON.stringify(bad)).toBe(false);
        expect(!checked.ok && Object.keys(checked.fields), JSON.stringify(bad)).toEqual(["expectedVersion"]);
      }
      const good = checkActionEdit(stored, { expectedVersion: 7, result: "Changed result." }, ctx);
      expect(good.ok && good.expectedVersion).toBe(7);
    });

    it("never reads performedBy, ticketId, createdAt, version, or any other field", () => {
      const checked = edit({ result: "Changed result.", performedBy: 99, ticketId: 5, createdAt: "2020-01-01T00:00:00Z", version: 40, id: 3 });
      expect(checked.ok && Object.keys(checked.value).sort()).toEqual(
        ["actionAt", "attachmentNotes", "description", "followUpNote", "followUpRequired", "result"],
      );
    });
  });
});

describe("UNIT-03 Action Date/Time against an explicit clock (BR-06)", () => {
  const at = (iso: string) => rejectedFields({ ...valid, actionAt: iso });

  it("allows up to five minutes ahead of the server, and not a second more", () => {
    expect(at("2026-10-05T10:05:00.000Z")).toBeNull();
    expect(at("2026-10-05T10:05:01.000Z")).toEqual(["actionAt"]);
  });

  it("allows the moment the Ticket was created, and not a millisecond before it", () => {
    expect(at("2026-10-01T09:00:00.000Z")).toBeNull();
    expect(at("2026-10-01T08:59:59.999Z")).toEqual(["actionAt"]);
  });

  it("accepts an offset and converts it to the same instant", () => {
    const checked = checkNewAction({ ...valid, actionAt: "2026-10-05T16:30:00+07:00" }, ctx);
    expect(checked.ok && checked.value.actionAt.toISOString()).toBe("2026-10-05T09:30:00.000Z");
  });

  it("refuses anything that is not a complete ISO 8601 date and time with a zone", () => {
    for (const bad of [
      "", "yesterday", "2026-10-05", "2026-10-05 09:30", "2026-10-05T09:30:00", "05/10/2026 09:30",
      "2026-13-05T09:30:00Z", "2026-02-31T09:30:00Z", "2026-10-05T25:00:00Z", 1759656600000, true, null, {}, [],
    ]) {
      expect(at(bad as string), JSON.stringify(bad)).toEqual(["actionAt"]);
    }
    expect(rejectedFields({ description: valid.description, result: valid.result, followUpRequired: false })).toEqual(["actionAt"]);
  });
});

describe("UNIT-04 a NUL character and blank text are refused in every text field (BR-12, BR-52)", () => {
  const nul = "bad\u0000text here";
  const yes = { ...valid, followUpRequired: true, followUpNote: "Check again on Thursday." };

  it.each(["description", "result", "followUpNote", "attachmentNotes"])("%s refuses a NUL character", (field) => {
    expect(rejectedFields({ ...yes, [field]: nul })).toEqual([field]);
  });

  it("refuses a NUL character even where the field is otherwise ignored (BR-52 says any string)", () => {
    // The No path never stores the note, but BR-52 is about the request, not about
    // what happens to the field afterwards, so a NUL in it is still a 400.
    expect(rejectedFields({ ...valid, followUpRequired: false, followUpNote: nul })).toEqual(["followUpNote"]);
  });

  it.each(["description", "result"])("%s refuses whitespace-only text, whatever kind of whitespace", (field) => {
    for (const blank of ["", "     ", "\n\n\n\n\n", "\t \t \t ", "     "]) {
      expect(rejectedFields({ ...valid, [field]: blank }), JSON.stringify(blank)).toEqual([field]);
    }
  });

  it("refuses a NUL character in an edit as well", () => {
    const stored: ActionFields = {
      actionAt: new Date(valid.actionAt), description: valid.description, result: valid.result,
      followUpRequired: false, followUpNote: null, attachmentNotes: null,
    };
    const checked = checkActionEdit(stored, { expectedVersion: 1, description: nul }, ctx);
    expect(!checked.ok && Object.keys(checked.fields)).toEqual(["description"]);
  });
});

describe("UNIT-05 the reading order: oldest Action Date/Time first, ties by id (BR-08)", () => {
  const row = (id: number, iso: string) => ({ id, actionAt: new Date(iso) });

  it("sorts by date, then by id, and is stable however the rows arrive", () => {
    const rows = [
      row(4, "2026-10-05T09:00:00Z"),
      row(2, "2026-10-05T08:00:00Z"),
      row(3, "2026-10-05T09:00:00Z"),
      row(1, "2026-10-05T10:00:00Z"),
    ];
    const expected = [2, 3, 4, 1];
    expect([...rows].sort(compareReadingOrder).map((r) => r.id)).toEqual(expected);
    expect([...rows].reverse().sort(compareReadingOrder).map((r) => r.id)).toEqual(expected);
  });

  it("says nothing about which action is the gate's 'latest': a later id can come first", () => {
    const recordedFirst = row(1, "2026-10-05T10:00:00Z");
    const recordedLast = row(2, "2026-10-05T09:00:00Z");
    expect([recordedFirst, recordedLast].sort(compareReadingOrder).map((r) => r.id)).toEqual([2, 1]);
  });
});

describe("UNIT-06 the request key that makes a resend safe (BR-28)", () => {
  it("accepts 8 to 64 characters of letters, digits, hyphen, and underscore", () => {
    expect(isValidRequestKey("a".repeat(8))).toBe(true);
    expect(isValidRequestKey("a".repeat(64))).toBe(true);
    expect(isValidRequestKey("6f1c2d3e-8a47-4b0e-9d52-0c7a1e5f93aa")).toBe(true);
    expect(isValidRequestKey("Mixed_Case-123")).toBe(true);
  });

  it("refuses 7 and 65 characters, other characters, and anything that is not a string", () => {
    expect(isValidRequestKey("a".repeat(7))).toBe(false);
    expect(isValidRequestKey("a".repeat(65))).toBe(false);
    for (const bad of ["has space 1234", "semi;colon1234", "dot.dot.dot1", "slash/slash1", "ünïcödé-key1", "key\u0000nul123", "", "   "]) {
      expect(isValidRequestKey(bad), JSON.stringify(bad)).toBe(false);
    }
    for (const bad of [undefined, null, 12345678, true, {}, []]) expect(isValidRequestKey(bad), JSON.stringify(bad)).toBe(false);
  });
});
