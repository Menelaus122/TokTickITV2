import { randomUUID } from "node:crypto";
import { extname } from "node:path";

// Attachment rules (BR-32 to BR-36, BR-39).
//
// Pure logic, so every boundary is unit-testable without a database, a request,
// or a filesystem.

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ACTIVE_ATTACHMENTS = 5;

export const REMOVAL_REASON_MIN = 5;
export const REMOVAL_REASON_MAX = 200;

// Extension and MIME type must BOTH be permitted and must agree with each
// other, so a .exe renamed to .pdf is rejected and so is a PDF announced as
// image/png.
const PERMITTED: Record<string, readonly string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".pdf": ["application/pdf"],
};

export const PERMITTED_EXTENSIONS = Object.keys(PERMITTED);
export const PERMITTED_MIME_TYPES = [...new Set(Object.values(PERMITTED).flat())];

export type FileRejection =
  | { code: "UNSUPPORTED_FILE_TYPE"; status: 415; message: string }
  | { code: "FILE_TOO_LARGE"; status: 413; message: string };

export type FileCheck = { ok: true } | { ok: false; reason: FileRejection };

export function checkUpload(
  originalFilename: string,
  mimeType: string,
  sizeBytes: number,
): FileCheck {
  const extension = extname(originalFilename).toLowerCase();
  const allowedMimes = PERMITTED[extension];

  if (!allowedMimes) {
    return {
      ok: false,
      reason: {
        code: "UNSUPPORTED_FILE_TYPE",
        status: 415,
        message: `Only ${PERMITTED_EXTENSIONS.join(", ")} files are permitted.`,
      },
    };
  }

  if (!allowedMimes.includes(mimeType.toLowerCase())) {
    return {
      ok: false,
      reason: {
        code: "UNSUPPORTED_FILE_TYPE",
        status: 415,
        message: "The file's type does not match its extension.",
      },
    };
  }

  // Zero-byte files are not a type problem, but nothing can be evidence.
  if (sizeBytes <= 0) {
    return {
      ok: false,
      reason: {
        code: "UNSUPPORTED_FILE_TYPE",
        status: 415,
        message: "The file is empty.",
      },
    };
  }

  if (sizeBytes > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: {
        code: "FILE_TOO_LARGE",
        status: 413,
        message: "Each file must be 5 MB or smaller.",
      },
    };
  }

  return { ok: true };
}

/**
 * Builds the name the file is stored under (BR-35).
 *
 * The original name is metadata only and is never used as a path: it may
 * contain separators, traversal sequences, or characters the filesystem treats
 * specially. An opaque uuid removes the whole class of problem, and only the
 * extension — already validated above — is carried across.
 */
export function buildStoredFilename(originalFilename: string): string {
  const extension = extname(originalFilename).toLowerCase();
  return `${randomUUID()}${extension}`;
}

export type ReasonCheck = { ok: true; value: string } | { ok: false; message: string };

export function checkRemovalReason(raw: unknown): ReasonCheck {
  const reason = typeof raw === "string" ? raw.trim() : "";

  if (reason.length === 0) {
    return { ok: false, message: "A removal reason is required." };
  }
  if (reason.length < REMOVAL_REASON_MIN || reason.length > REMOVAL_REASON_MAX) {
    return {
      ok: false,
      message: `The removal reason must be between ${REMOVAL_REASON_MIN} and ${REMOVAL_REASON_MAX} characters.`,
    };
  }

  return { ok: true, value: reason };
}
