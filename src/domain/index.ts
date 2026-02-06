// Domain layer exports
// Pure business logic - no framework dependencies

// Core
export { Result, Ok, Err, ok, err } from "./core/Result";
export type { Result as ResultType } from "./core/Result";

// Value Objects - Topics
export { HexColor } from "./value-objects/HexColor";
export { TopicName } from "./value-objects/TopicName";

// Value Objects - Entries
export { ISODate } from "./value-objects/ISODate";
export { EntryType } from "./value-objects/EntryType";
export { EntryTitle } from "./value-objects/EntryTitle";
export { EntryContent } from "./value-objects/EntryContent";

// Value Objects - Attachments
export { Bytes } from "./value-objects/Bytes";
export { MimeType } from "./value-objects/MimeType";
export { Filename } from "./value-objects/Filename";
export { StorageKey } from "./value-objects/StorageKey";
export { AttachmentKind } from "./value-objects/AttachmentKind";
export { AttachmentStatus } from "./value-objects/AttachmentStatus";

// Entities
export { Topic } from "./entities/Topic";
export type { CreateTopicInput, TopicJSON } from "./entities/Topic";
export { Entry } from "./entities/Entry";
export type { EntryProps, EntryUpdateProps } from "./entities/Entry";
export { Attachment } from "./entities/Attachment";
export type { AttachmentProps } from "./entities/Attachment";
