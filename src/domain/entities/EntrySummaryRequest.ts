import { Result, ok, err } from "../core/Result";
import { RequestStatus } from "../value-objects/RequestStatus";

/**
 * Props for creating an EntrySummaryRequest entity.
 */
export interface EntrySummaryRequestProps {
  id: string;
  userId: string;
  entryId: string;
  status: string;
  meta?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * EntrySummaryRequest entity representing an async request to summarize an entry.
 * Tracks the lifecycle: pending -> submitted -> done | failed
 */
export class EntrySummaryRequest {
  readonly id: string;
  readonly userId: string;
  readonly entryId: string;
  readonly status: RequestStatus;
  readonly meta: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    id: string,
    userId: string,
    entryId: string,
    status: RequestStatus,
    meta: Record<string, unknown> | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.entryId = entryId;
    this.status = status;
    this.meta = meta;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Creates an EntrySummaryRequest entity from raw props.
   */
  static create(
    props: EntrySummaryRequestProps,
  ): Result<EntrySummaryRequest, string> {
    // Validate id
    if (!props.id || props.id.trim().length === 0) {
      return err("Request id cannot be empty");
    }

    // Validate userId
    if (!props.userId || props.userId.trim().length === 0) {
      return err("Request userId cannot be empty");
    }

    // Validate entryId
    if (!props.entryId || props.entryId.trim().length === 0) {
      return err("Request entryId cannot be empty");
    }

    // Validate status
    const statusResult = RequestStatus.create(props.status);
    if (statusResult.isErr()) {
      return err(statusResult.error);
    }

    return ok(
      new EntrySummaryRequest(
        props.id.trim(),
        props.userId.trim(),
        props.entryId.trim(),
        statusResult.value,
        props.meta ?? null,
        props.createdAt,
        props.updatedAt,
      ),
    );
  }

  /**
   * Creates a new EntrySummaryRequest with pending status.
   * meta: optional e.g. { truncated: true, plainTextForSummary: "..." }
   */
  static createNew(
    id: string,
    userId: string,
    entryId: string,
    meta?: Record<string, unknown> | null,
  ): EntrySummaryRequest {
    const now = new Date();
    return new EntrySummaryRequest(
      id,
      userId,
      entryId,
      RequestStatus.pending(),
      meta ?? null,
      now,
      now,
    );
  }

  /**
   * Marks the request as submitted (sent to n8n).
   */
  markSubmitted(): EntrySummaryRequest {
    return new EntrySummaryRequest(
      this.id,
      this.userId,
      this.entryId,
      RequestStatus.submitted(),
      this.meta,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Marks the request as done (summary received).
   */
  markDone(): EntrySummaryRequest {
    return new EntrySummaryRequest(
      this.id,
      this.userId,
      this.entryId,
      RequestStatus.done(),
      this.meta,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Marks the request as failed.
   */
  markFailed(): EntrySummaryRequest {
    return new EntrySummaryRequest(
      this.id,
      this.userId,
      this.entryId,
      RequestStatus.failed(),
      this.meta,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Returns true if the request is in a terminal state (done or failed).
   */
  isTerminal(): boolean {
    return this.status.isTerminal();
  }

  /**
   * Checks if this request belongs to the given user.
   */
  belongsTo(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Returns a plain object representation.
   */
  toJSON(): {
    id: string;
    userId: string;
    entryId: string;
    status: string;
    meta: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      userId: this.userId,
      entryId: this.entryId,
      status: this.status.toString(),
      meta: this.meta,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
