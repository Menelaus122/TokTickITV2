import { describe, it, expect } from "vitest";
import {
  MAX_FILE_BYTES,
  PERMITTED_EXTENSIONS,
  buildStoredFilename,
  checkRemovalReason,
  checkUpload,
  REMOVAL_REASON_MIN,
  REMOVAL_REASON_MAX,
} from "../../src/attachments.js";

// UNIT-04 — attachment rules at their boundaries (BR-32, BR-33, BR-35, BR-39).

describe("permitted file types", () => {
  it.each([
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["screenshot.PNG", "image/png"],
    ["diagram.webp", "image/webp"],
    ["report.pdf", "application/pdf"],
  ])("accepts %s", (name, mime) => {
    expect(checkUpload(name, mime, 1024).ok).toBe(true);
  });

  it.each(["virus.exe", "notes.txt", "archive.zip", "script.js", "noextension"])(
    "rejects %s with 415",
    (name) => {
      const result = checkUpload(name, "application/octet-stream", 1024);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.code).toBe("UNSUPPORTED_FILE_TYPE");
        expect(result.reason.status).toBe(415);
      }
    },
  );

  it("rejects a file whose MIME type contradicts its extension", () => {
    // A .exe renamed to .pdf, and a PDF announced as an image.
    const disguised = checkUpload("virus.pdf", "application/octet-stream", 1024);
    expect(disguised.ok).toBe(false);

    const mislabelled = checkUpload("report.pdf", "image/png", 1024);
    expect(mislabelled.ok).toBe(false);
    if (!mislabelled.ok) expect(mislabelled.reason.status).toBe(415);
  });

  it("ignores extension case", () => {
    expect(checkUpload("REPORT.PDF", "application/pdf", 1024).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(checkUpload("report.pdf", "application/pdf", 0).ok).toBe(false);
  });

  it("exposes exactly the five permitted extensions", () => {
    expect([...PERMITTED_EXTENSIONS].sort()).toEqual([".jpeg", ".jpg", ".pdf", ".png", ".webp"]);
  });
});

describe("size limit", () => {
  it("accepts a file of exactly 5 MB", () => {
    expect(checkUpload("report.pdf", "application/pdf", MAX_FILE_BYTES).ok).toBe(true);
  });

  it("rejects one byte over 5 MB with 413", () => {
    const result = checkUpload("report.pdf", "application/pdf", MAX_FILE_BYTES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.code).toBe("FILE_TOO_LARGE");
      expect(result.reason.status).toBe(413);
    }
  });

  it("uses binary megabytes", () => {
    expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("stored filename", () => {
  it("keeps the extension but discards the original name", () => {
    const stored = buildStoredFilename("battery report.pdf");
    expect(stored).toMatch(/^[0-9a-f-]{36}\.pdf$/i);
    expect(stored).not.toContain("battery");
  });

  it("never carries a path separator or traversal sequence through", () => {
    for (const hostile of ["../../etc/passwd.pdf", "..\\..\\windows\\x.png", "a/b/c.jpg"]) {
      const stored = buildStoredFilename(hostile);
      expect(stored).not.toMatch(/[/\\]/);
      expect(stored).not.toContain("..");
    }
  });

  it("is different every time, so two uploads cannot collide", () => {
    const names = new Set(Array.from({ length: 50 }, () => buildStoredFilename("a.png")));
    expect(names.size).toBe(50);
  });
});

describe("removal reason", () => {
  it("requires a reason", () => {
    for (const bad of [undefined, null, "", "   ", 42]) {
      const result = checkRemovalReason(bad);
      expect(result.ok).toBe(false);
    }
  });

  it("reports a blank reason as required rather than too short", () => {
    const result = checkRemovalReason("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/required/i);
  });

  it("enforces the length boundaries after trimming", () => {
    expect(checkRemovalReason("a".repeat(REMOVAL_REASON_MIN - 1)).ok).toBe(false);
    expect(checkRemovalReason("a".repeat(REMOVAL_REASON_MIN)).ok).toBe(true);
    expect(checkRemovalReason("a".repeat(REMOVAL_REASON_MAX)).ok).toBe(true);
    expect(checkRemovalReason("a".repeat(REMOVAL_REASON_MAX + 1)).ok).toBe(false);
  });

  it("returns the trimmed reason for storage", () => {
    const result = checkRemovalReason("   Uploaded the wrong screenshot   ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("Uploaded the wrong screenshot");
  });
});
