import { Result, ok, err } from "../core/Result";

/**
 * RequestStatus value object.
 * Represents the status of an async request (e.g., summary request).
 * States: pending -> submitted -> done | failed
 */
export class RequestStatus {
  private readonly value: "pending" | "submitted" | "done" | "failed";

  static readonly PENDING = "pending" as const;
  static readonly SUBMITTED = "submitted" as const;
  static readonly DONE = "done" as const;
  static readonly FAILED = "failed" as const;

  private static readonly VALID_STATUSES = [
    RequestStatus.PENDING,
    RequestStatus.SUBMITTED,
    RequestStatus.DONE,
    RequestStatus.FAILED,
  ] as const;

  private constructor(value: "pending" | "submitted" | "done" | "failed") {
    this.value = value;
  }

  static create(value: string): Result<RequestStatus, string> {
    if (!value || value.trim().length === 0) {
      return err("Status cannot be empty");
    }

    const normalized = value.trim().toLowerCase();

    if (
      !RequestStatus.VALID_STATUSES.includes(
        normalized as (typeof RequestStatus.VALID_STATUSES)[number],
      )
    ) {
      return err(
        `Invalid status. Allowed: ${RequestStatus.VALID_STATUSES.join(", ")}`,
      );
    }

    return ok(
      new RequestStatus(
        normalized as "pending" | "submitted" | "done" | "failed",
      ),
    );
  }

  static pending(): RequestStatus {
    return new RequestStatus(RequestStatus.PENDING);
  }

  static submitted(): RequestStatus {
    return new RequestStatus(RequestStatus.SUBMITTED);
  }

  static done(): RequestStatus {
    return new RequestStatus(RequestStatus.DONE);
  }

  static failed(): RequestStatus {
    return new RequestStatus(RequestStatus.FAILED);
  }

  isPending(): boolean {
    return this.value === RequestStatus.PENDING;
  }

  isSubmitted(): boolean {
    return this.value === RequestStatus.SUBMITTED;
  }

  isDone(): boolean {
    return this.value === RequestStatus.DONE;
  }

  isFailed(): boolean {
    return this.value === RequestStatus.FAILED;
  }

  /**
   * Returns true if the request is in a terminal state (done or failed).
   * No further state transitions are expected.
   */
  isTerminal(): boolean {
    return this.isDone() || this.isFailed();
  }

  toString(): string {
    return this.value;
  }

  equals(other: RequestStatus): boolean {
    return this.value === other.value;
  }
}
