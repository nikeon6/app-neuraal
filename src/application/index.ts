// Application layer exports
// Use cases and ports (interfaces)

// Core
export type { UseCaseError, UseCaseErrorCode } from "./core/UseCaseError";
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
export { CreateTopic } from "./use-cases/topics/CreateTopic";
export type { CreateTopicInput } from "./use-cases/topics/CreateTopic";
export { ListTopics } from "./use-cases/topics/ListTopics";
export type { ListTopicsInput } from "./use-cases/topics/ListTopics";
export { UpdateTopic } from "./use-cases/topics/UpdateTopic";
export type { UpdateTopicInput } from "./use-cases/topics/UpdateTopic";
export { DeleteTopic } from "./use-cases/topics/DeleteTopic";
export type { DeleteTopicInput } from "./use-cases/topics/DeleteTopic";

// Use Cases - Entries
export { CreateEntry } from "./use-cases/entries/CreateEntry";
export type { CreateEntryInput } from "./use-cases/entries/CreateEntry";
export { ListEntriesByDate } from "./use-cases/entries/ListEntriesByDate";
export type { ListEntriesByDateInput } from "./use-cases/entries/ListEntriesByDate";
export { UpdateEntry } from "./use-cases/entries/UpdateEntry";
export type { UpdateEntryInput } from "./use-cases/entries/UpdateEntry";
export { DeleteEntry } from "./use-cases/entries/DeleteEntry";
export type { DeleteEntryInput } from "./use-cases/entries/DeleteEntry";
export { ReorderEntries } from "./use-cases/entries/ReorderEntries";
export type { ReorderEntriesInput } from "./use-cases/entries/ReorderEntries";

// Use Cases - Attachments
export { InitAttachmentUpload } from "./use-cases/attachments/InitAttachmentUpload";
export type {
  InitAttachmentInput,
  AttachmentQuotaConfig,
} from "./use-cases/attachments/InitAttachmentUpload";
export { CompleteAttachmentUpload } from "./use-cases/attachments/CompleteAttachmentUpload";
export type { CompleteAttachmentInput } from "./use-cases/attachments/CompleteAttachmentUpload";
export { GetAttachmentDownloadUrl } from "./use-cases/attachments/GetAttachmentDownloadUrl";
export type { GetDownloadUrlInput } from "./use-cases/attachments/GetAttachmentDownloadUrl";
export { DeleteAttachment } from "./use-cases/attachments/DeleteAttachment";
export type { DeleteAttachmentInput } from "./use-cases/attachments/DeleteAttachment";
