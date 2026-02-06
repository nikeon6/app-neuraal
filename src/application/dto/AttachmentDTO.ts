/**
 * DTO for initializing an attachment upload.
 */
export interface InitAttachmentDTO {
  entryId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "inline" | "file";
}

/**
 * DTO for attachment output.
 */
export interface AttachmentDTO {
  id: string;
  userId: string;
  entryId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of init upload.
 */
export interface InitAttachmentResult {
  attachment: AttachmentDTO;
  presignedPutUrl: string;
}

/**
 * Result of get download URL.
 */
export interface DownloadUrlResult {
  presignedGetUrl: string;
}
