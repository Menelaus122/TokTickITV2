import type { Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";

// How an attachment is shown and streamed (Lab 2 BR-40, BR-41), shared by the
// Requester's routes in app.ts and, since Lab 3 Issue 9, the IT Staff detail
// screen's routes in staff.ts. The two differ only in which download URL a row
// advertises; the rules about removed files are the same for both.

export const UPLOAD_DIR = resolvePath(process.env.UPLOAD_DIR ?? "uploads");

export const ATTACHMENT_SELECT = {
  id: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  removedAt: true,
  removalReason: true,
} as const;

export interface AttachmentRow {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
}

/** The download route a row advertises, by the caller's route family. */
export type DownloadBase = "/api/attachments" | "/api/staff/attachments";

export function attachmentView(row: AttachmentRow, base: DownloadBase = "/api/attachments") {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt,
    removedAt: row.removedAt,
    removalReason: row.removalReason,
    // A removed attachment reports no download URL, so a client cannot build a
    // working link out of the response (BR-40).
    downloadUrl: row.removedAt ? null : `${base}/${row.id}/download`,
  };
}

/**
 * Streams an attachment that the caller is already allowed to see, or answers
 * why it cannot: 410 once removed (BR-41), 500 when the stored file is gone.
 */
export function sendAttachment(res: Response, attachment: AttachmentRow & { storedFilename: string }) {
  // A removed attachment never streams bytes, whatever the UI shows (BR-41).
  if (attachment.removedAt) {
    return res.status(410).json({
      error: {
        code: "ATTACHMENT_REMOVED",
        message: "That attachment was removed and can no longer be downloaded.",
      },
    });
  }

  const path = join(UPLOAD_DIR, attachment.storedFilename);
  if (!existsSync(path)) {
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "The stored file is unavailable." } });
  }

  res.status(200);
  res.set("Content-Type", attachment.mimeType);
  res.set("Content-Length", String(attachment.sizeBytes));
  // The original name is only ever used as a label, never as a path.
  res.set("Content-Disposition", `attachment; filename="${attachment.originalFilename.replace(/"/g, "")}"`);
  return createReadStream(path).pipe(res);
}
