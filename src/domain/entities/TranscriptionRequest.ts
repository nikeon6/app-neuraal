import { Result, ok, err } from "../core/Result";
import { RequestStatus } from "../value-objects/RequestStatus";

/**
 * Props for creating a TranscriptionRequest entity.
 */
export interface TranscriptionRequestProps {
  id: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TranscriptionRequest entity representing an async request to transcribe
 * a YouTube video embedded in an entry.
 * Tracks the lifecycle: pending -> submitted -> done | failed
 */
export class TranscriptionRequest {
  readonly id: string;
  readonly userId: string;
  readonly entryId: string;
  readonly youtubeUrl: string;
  readonly status: RequestStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    id: string,
    userId: string,
    entryId: string,
    youtubeUrl: string,
    status: RequestStatus,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.entryId = entryId;
    this.youtubeUrl = youtubeUrl;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Creates a TranscriptionRequest entity from raw props.
   */
  static create(
    props: TranscriptionRequestProps,
  ): Result<TranscriptionRequest, string> {
    if (!props.id || props.id.trim().length === 0) {
      return err("Request id cannot be empty");
    }

    if (!props.userId || props.userId.trim().length === 0) {
      return err("Request userId cannot be empty");
    }

    if (!props.entryId || props.entryId.trim().length === 0) {
      return err("Request entryId cannot be empty");
    }

    if (!props.youtubeUrl || props.youtubeUrl.trim().length === 0) {
      return err("Request youtubeUrl cannot be empty");
    }

    const statusResult = RequestStatus.create(props.status);
    if (statusResult.isErr()) {
      return err(statusResult.error);
    }

    return ok(
      new TranscriptionRequest(
        props.id.trim(),
        props.userId.trim(),
        props.entryId.trim(),
        props.youtubeUrl.trim(),
        statusResult.value,
        props.createdAt,
        props.updatedAt,
      ),
    );
  }

  /**
   * Creates a new TranscriptionRequest with pending status.
   */
  static createNew(
    id: string,
    userId: string,
    entryId: string,
    youtubeUrl: string,
  ): TranscriptionRequest {
    const now = new Date();
    return new TranscriptionRequest(
      id,
      userId,
      entryId,
      youtubeUrl,
      RequestStatus.pending(),
      now,
      now,
    );
  }

  /** Marks the request as submitted (sent to n8n). */
  markSubmitted(): TranscriptionRequest {
    return new TranscriptionRequest(
      this.id,
      this.userId,
      this.entryId,
      this.youtubeUrl,
      RequestStatus.submitted(),
      this.createdAt,
      new Date(),
    );
  }

  /** Marks the request as done (transcription received). */
  markDone(): TranscriptionRequest {
    return new TranscriptionRequest(
      this.id,
      this.userId,
      this.entryId,
      this.youtubeUrl,
      RequestStatus.done(),
      this.createdAt,
      new Date(),
    );
  }

  /** Marks the request as failed. */
  markFailed(): TranscriptionRequest {
    return new TranscriptionRequest(
      this.id,
      this.userId,
      this.entryId,
      this.youtubeUrl,
      RequestStatus.failed(),
      this.createdAt,
      new Date(),
    );
  }

  /** Returns true if the request is in a terminal state (done or failed). */
  isTerminal(): boolean {
    return this.status.isTerminal();
  }

  /** Checks if this request belongs to the given user. */
  belongsTo(userId: string): boolean {
    return this.userId === userId;
  }

  /** Returns a plain object representation. */
  toJSON(): {
    id: string;
    userId: string;
    entryId: string;
    youtubeUrl: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      userId: this.userId,
      entryId: this.entryId,
      youtubeUrl: this.youtubeUrl,
      status: this.status.toString(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
