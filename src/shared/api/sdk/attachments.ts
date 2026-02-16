/**
 * Attachments SDK — typed functions for attachment-related endpoints.
 *
 * All functions use the centralized apiClient helpers.
 * Types are derived from the OpenAPI spec.
 */

import { get, post, del } from "../apiClient";
import type { ApiAttachment } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for listing attachments with usage info. */
export interface ListAttachmentsResponse {
  attachments: ApiAttachment[];
  usage: {
    entryBytesUsed: number;
    entryLimitBytes: number;
    userBytesUsed: number;
    userLimitBytes: number;
  };
}

/** Response shape for init attachment upload. */
export interface InitUploadResponse {
  attachment: ApiAttachment;
  presignedPutUrl: string;
}

/** Input for init attachment upload. */
export interface InitUploadInput {
  entryId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "inline" | "file";
}

// ---------------------------------------------------------------------------
// List by Entry
// ---------------------------------------------------------------------------

/**
 * GET /api/entries/{entryId}/attachments
 * Returns all non-deleted attachments for the entry, plus usage/quota data.
 */
export async function listByEntry(
  entryId: string,
): Promise<ListAttachmentsResponse> {
  return await get<ListAttachmentsResponse>(
    `/api/entries/${encodeURIComponent(entryId)}/attachments`,
  );
}

// ---------------------------------------------------------------------------
// Init Upload
// ---------------------------------------------------------------------------

/**
 * POST /api/attachments/init
 * Initializes an attachment upload, creates a pending record,
 * and returns a presigned PUT URL for direct-to-S3 upload.
 */
export async function initUpload(
  input: InitUploadInput,
): Promise<InitUploadResponse> {
  return await post<InitUploadResponse>("/api/attachments/init", input);
}

// ---------------------------------------------------------------------------
// Complete Upload
// ---------------------------------------------------------------------------

/**
 * POST /api/attachments/complete
 * Marks an attachment as ready after the file has been uploaded to S3.
 */
export async function completeUpload(
  attachmentId: string,
): Promise<{ attachment: ApiAttachment }> {
  return await post<{ attachment: ApiAttachment }>(
    "/api/attachments/complete",
    {
      attachmentId,
    },
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * DELETE /api/attachments/{id}
 * Soft-deletes an attachment and removes the object from S3.
 */
export async function deleteAttachment(id: string): Promise<void> {
  await del(`/api/attachments/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Download URL
// ---------------------------------------------------------------------------

/**
 * GET /api/attachments/{id}/download
 * Returns a presigned GET URL for downloading the attachment.
 */
export async function getDownloadUrl(
  id: string,
): Promise<{ presignedGetUrl: string }> {
  return await get<{ presignedGetUrl: string }>(
    `/api/attachments/${encodeURIComponent(id)}/download`,
  );
}
