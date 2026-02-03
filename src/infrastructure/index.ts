/**
 * Infrastructure layer
 * 
 * This folder contains external service integrations and infrastructure code.
 * Examples: Sentry, API clients, analytics, feature flags, etc.
 */

// Persistence
export { prisma } from "./persistence/prisma";
export { PrismaTopicRepository } from "./persistence/PrismaTopicRepository";
export { PrismaEntryRepository } from "./persistence/PrismaEntryRepository";
export { PrismaAttachmentRepository } from "./persistence/PrismaAttachmentRepository";

// Object Storage
export { S3ObjectStorage } from "./storage/S3ObjectStorage";

// Config
export { getAttachmentConfig, getS3Config } from "./config/AttachmentConfig";
export type { AttachmentConfig, S3Config } from "./config/AttachmentConfig";

// Auth
export { getAuthUserId } from "./auth/getAuthUserId";
export type { AuthResult, AuthError } from "./auth/getAuthUserId";

// Add more infrastructure services as they are added
// export { initSentry, captureException } from "./sentry";
// export { apiClient } from "./api-client";
