import { Result, ok, err } from "../core/Result";
import { Bytes } from "../value-objects/Bytes";
import { MimeType } from "../value-objects/MimeType";
import { Filename } from "../value-objects/Filename";
import { StorageKey } from "../value-objects/StorageKey";
import { AttachmentKind } from "../value-objects/AttachmentKind";
import { AttachmentStatus } from "../value-objects/AttachmentStatus";

/**
 * Props for creating an Attachment entity.
 */
export interface AttachmentProps {
  id: string;
  userId: string;
  entryId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "inline" | "file";
  status: "pending" | "ready" | "deleted";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attachment entity representing a file associated with an entry.
 */
export class Attachment {
  readonly id: string;
  readonly userId: string;
  readonly entryId: string;
  readonly storageKey: StorageKey;
  readonly filename: Filename;
  readonly mimeType: MimeType;
  readonly sizeBytes: Bytes;
  readonly kind: AttachmentKind;
  readonly status: AttachmentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    id: string,
    userId: string,
    entryId: string,
    storageKey: StorageKey,
    filename: Filename,
    mimeType: MimeType,
    sizeBytes: Bytes,
    kind: AttachmentKind,
    status: AttachmentStatus,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.entryId = entryId;
    this.storageKey = storageKey;
    this.filename = filename;
    this.mimeType = mimeType;
    this.sizeBytes = sizeBytes;
    this.kind = kind;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Creates an Attachment entity from raw props.
   */
  static create(props: AttachmentProps): Result<Attachment, string> {
    // Validate id
    if (!props.id || props.id.trim().length === 0) {
      return err("Attachment id cannot be empty");
    }

    // Validate userId
    if (!props.userId || props.userId.trim().length === 0) {
      return err("Attachment userId cannot be empty");
    }

    // Validate entryId
    if (!props.entryId || props.entryId.trim().length === 0) {
      return err("Attachment entryId cannot be empty");
    }

    // Validate storageKey
    const storageKeyResult = StorageKey.create(props.storageKey);
    if (storageKeyResult.isErr()) {
      return err(storageKeyResult.error);
    }

    // Validate filename
    const filenameResult = Filename.create(props.filename);
    if (filenameResult.isErr()) {
      return err(filenameResult.error);
    }

    // Validate mimeType
    const mimeTypeResult = MimeType.create(props.mimeType);
    if (mimeTypeResult.isErr()) {
      return err(mimeTypeResult.error);
    }

    // Validate sizeBytes
    const sizeBytesResult = Bytes.create(props.sizeBytes);
    if (sizeBytesResult.isErr()) {
      return err(sizeBytesResult.error);
    }

    // Validate kind
    const kindResult = AttachmentKind.create(props.kind);
    if (kindResult.isErr()) {
      return err(kindResult.error);
    }

    // Validate status
    const statusResult = AttachmentStatus.create(props.status);
    if (statusResult.isErr()) {
      return err(statusResult.error);
    }

    return ok(
      new Attachment(
        props.id.trim(),
        props.userId.trim(),
        props.entryId.trim(),
        storageKeyResult.value,
        filenameResult.value,
        mimeTypeResult.value,
        sizeBytesResult.value,
        kindResult.value,
        statusResult.value,
        props.createdAt,
        props.updatedAt,
      ),
    );
  }

  /**
   * Creates a new Attachment with ready status.
   */
  markReady(): Attachment {
    return new Attachment(
      this.id,
      this.userId,
      this.entryId,
      this.storageKey,
      this.filename,
      this.mimeType,
      this.sizeBytes,
      this.kind,
      AttachmentStatus.ready(),
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Creates a new Attachment with deleted status.
   */
  markDeleted(): Attachment {
    return new Attachment(
      this.id,
      this.userId,
      this.entryId,
      this.storageKey,
      this.filename,
      this.mimeType,
      this.sizeBytes,
      this.kind,
      AttachmentStatus.deleted(),
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Returns true if the attachment counts towards quotas.
   */
  isActive(): boolean {
    return this.status.isActive();
  }

  /**
   * Returns a plain object representation.
   */
  toJSON(): {
    id: string;
    userId: string;
    entryId: string;
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      userId: this.userId,
      entryId: this.entryId,
      storageKey: this.storageKey.toString(),
      filename: this.filename.toString(),
      mimeType: this.mimeType.toString(),
      sizeBytes: this.sizeBytes.toNumber(),
      kind: this.kind.toString(),
      status: this.status.toString(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
