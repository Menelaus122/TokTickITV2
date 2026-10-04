import { describe, it, expect } from "vitest";
import { changeRefusal, checkUserFields } from "../../src/userRules.js";

// Lab 3, Issue 10 — UNIT-15 in docs/lab-03/tests.md: the Administrator's user
// rules as pure functions (specification.md §5.7). The API suite proves them
// over HTTP; this one reaches the BR-49 case that a single request cannot,
// because the caller is itself an active Administrator.

describe("checkUserFields", () => {
  const valid = { fullName: "  New Person ", email: " New.Person@TokTickIT.local ", role: "IT_STAFF", isActive: true };
  const all = ["fullName", "email", "role", "isActive"] as const;

  it("trims the name and lowercases the email (BR-45)", () => {
    expect(checkUserFields(valid, all)).toEqual({
      ok: true,
      value: { fullName: "New Person", email: "new.person@toktickit.local", role: "IT_STAFF", isActive: true },
    });
  });

  it("requires every create field, each with its own message (FR-43)", () => {
    const result = checkUserFields({}, all);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fields).sort()).toEqual(["email", "fullName", "isActive", "role"]);
  });

  it("refuses anything but exactly one of the three roles (BR-17)", () => {
    for (const role of ["ADMIN", "requester", ["IT_STAFF"], ["IT_STAFF", "REQUESTER"], 1, null]) {
      const result = checkUserFields({ ...valid, role }, all);
      expect(result.ok, JSON.stringify(role)).toBe(false);
    }
  });

  it("refuses a blank or over-long name, a malformed email, and a non-boolean isActive", () => {
    for (const body of [
      { ...valid, fullName: "   " },
      { ...valid, fullName: "x".repeat(101) },
      { ...valid, email: "not-an-email" },
      { ...valid, email: `${"a".repeat(250)}@x.co` },
      { ...valid, isActive: "true" },
    ]) {
      expect(checkUserFields(body, all).ok, JSON.stringify(body)).toBe(false);
    }
  });

  it("validates only the fields sent on an edit, and never reads password fields", () => {
    expect(checkUserFields({ role: "REQUESTER" })).toEqual({ ok: true, value: { role: "REQUESTER" } });
    expect(checkUserFields({ passwordHash: "x", mustChangePassword: false, initialPassword: "y" })).toEqual({ ok: true, value: {} });
  });
});

describe("changeRefusal", () => {
  const admin = { id: 1, role: "ADMINISTRATOR" as const, isActive: true };

  it("refuses an Administrator deactivating or re-roling themselves (BR-48)", () => {
    expect(changeRefusal({ callerId: 1, target: admin, change: { isActive: false }, otherActiveAdministrators: 3 })).toBe("SELF_DEACTIVATION");
    expect(changeRefusal({ callerId: 1, target: admin, change: { role: "IT_STAFF" }, otherActiveAdministrators: 3 })).toBe("SELF_DEACTIVATION");
  });

  it("lets an Administrator resend their own unchanged role and activation", () => {
    expect(changeRefusal({ callerId: 1, target: admin, change: { role: "ADMINISTRATOR", isActive: true }, otherActiveAdministrators: 0 })).toBeNull();
  });

  it("refuses removing the last active Administrator, by deactivation or demotion (BR-49)", () => {
    expect(changeRefusal({ callerId: 2, target: admin, change: { isActive: false }, otherActiveAdministrators: 0 })).toBe("LAST_ADMINISTRATOR");
    expect(changeRefusal({ callerId: 2, target: admin, change: { role: "REQUESTER" }, otherActiveAdministrators: 0 })).toBe("LAST_ADMINISTRATOR");
  });

  it("allows it while another active Administrator remains", () => {
    expect(changeRefusal({ callerId: 2, target: admin, change: { isActive: false }, otherActiveAdministrators: 1 })).toBeNull();
  });

  it("never applies BR-49 to someone who is not an active Administrator", () => {
    const staff = { id: 5, role: "IT_STAFF" as const, isActive: true };
    const inactiveAdmin = { id: 6, role: "ADMINISTRATOR" as const, isActive: false };
    expect(changeRefusal({ callerId: 1, target: staff, change: { isActive: false }, otherActiveAdministrators: 0 })).toBeNull();
    expect(changeRefusal({ callerId: 1, target: inactiveAdmin, change: { role: "REQUESTER" }, otherActiveAdministrators: 0 })).toBeNull();
  });
});
