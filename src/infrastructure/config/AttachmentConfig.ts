import { Bytes } from "@/domain/value-objects/Bytes";

/**
 * Configuration for attachment quotas.
 * Values are read from environment variables.
 */
export interface AttachmentConfig {
  /** Maximum total size of attachments per entry */
  maxEntryAttachmentSizeBytes: Bytes;
  /** Maximum total storage quota per user */
  maxUserStorageQuotaBytes: Bytes;
}

// Default values (20MB per entry, 1GB per user)
const DEFAULT_MAX_ENTRY_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const DEFAULT_MAX_USER_STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB

/**
 * Reads attachment configuration from environment variables.
 */
export function getAttachmentConfig(): AttachmentConfig {
  const maxEntrySize = parseEnvBytes(
    "MAX_ENTRY_ATTACHMENT_SIZE_BYTES",
    DEFAULT_MAX_ENTRY_ATTACHMENT_SIZE_BYTES
  );

  const maxUserQuota = parseEnvBytes(
    "MAX_USER_STORAGE_QUOTA_BYTES",
    DEFAULT_MAX_USER_STORAGE_QUOTA_BYTES
  );

  return {
    maxEntryAttachmentSizeBytes: Bytes.fromNumber(maxEntrySize),
    maxUserStorageQuotaBytes: Bytes.fromNumber(maxUserQuota),
  };
}

/**
 * Parses an environment variable as bytes.
 * Returns default if not set or invalid.
 */
function parseEnvBytes(key: string, defaultValue: number): number {
  const value = process.env[key];

  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed) || parsed < 0) {
    console.warn(
      `Invalid value for ${key}: "${value}". Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * S3/Object Storage configuration.
 */
export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/**
 * Reads S3 configuration from environment variables.
 */
export function getS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    bucket: process.env.S3_BUCKET || "neuraal-attachments",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}
