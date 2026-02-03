// Application layer exports
// Use cases and ports (interfaces)

// Core
export type {
  UseCaseError,
  UseCaseErrorCode,
} from "./core/UseCaseError";
export {
  validationError,
  duplicateError,
  notFoundError,
  unauthorizedError,
  internalError,
  conflictError,
  quotaExceededError,
} from "./core/UseCaseError";

// DTOs - Topics
export type { CreateTopicDTO, TopicDTO } from "./dto/TopicDTO";

// DTOs - Entries
export type { CreateEntryDTO, EntryDTO, UpdateEntryDTO } from "./dto/EntryDTO";

// DTOs - Attachments
export type {
  InitAttachmentDTO,
  AttachmentDTO,
  InitAttachmentResult,
  DownloadUrlResult,
} from "./dto/AttachmentDTO";

// Ports (interfaces)
export type { TopicRepository } from "./ports/TopicRepository";
export type { EntryRepository } from "./ports/EntryRepository";
export type { AttachmentRepository } from "./ports/AttachmentRepository";
export type { ObjectStoragePort } from "./ports/ObjectStoragePort";

// Use Cases - Topics
export { CreateTopic } from "./use-cases/CreateTopic";
export type { CreateTopicInput } from "./use-cases/CreateTopic";
export { ListTopics } from "./use-cases/ListTopics";
export type { ListTopicsInput } from "./use-cases/ListTopics";
export { UpdateTopic } from "./use-cases/UpdateTopic";
export type { UpdateTopicInput } from "./use-cases/UpdateTopic";
export { DeleteTopic } from "./use-cases/DeleteTopic";
export type { DeleteTopicInput } from "./use-cases/DeleteTopic";

// Use Cases - Entries
export { CreateEntry } from "./use-cases/CreateEntry";
export type { CreateEntryInput } from "./use-cases/CreateEntry";
export { ListEntriesByDate } from "./use-cases/ListEntriesByDate";
export type { ListEntriesByDateInput } from "./use-cases/ListEntriesByDate";
export { UpdateEntry } from "./use-cases/UpdateEntry";
export type { UpdateEntryInput } from "./use-cases/UpdateEntry";
export { DeleteEntry } from "./use-cases/DeleteEntry";
export type { DeleteEntryInput } from "./use-cases/DeleteEntry";

// Use Cases - Attachments
export { InitAttachmentUpload } from "./use-cases/InitAttachmentUpload";
export type { InitAttachmentInput, AttachmentQuotaConfig } from "./use-cases/InitAttachmentUpload";
export { CompleteAttachmentUpload } from "./use-cases/CompleteAttachmentUpload";
export type { CompleteAttachmentInput } from "./use-cases/CompleteAttachmentUpload";
export { GetAttachmentDownloadUrl } from "./use-cases/GetAttachmentDownloadUrl";
export type { GetDownloadUrlInput } from "./use-cases/GetAttachmentDownloadUrl";
export { DeleteAttachment } from "./use-cases/DeleteAttachment";
export type { DeleteAttachmentInput } from "./use-cases/DeleteAttachment";
