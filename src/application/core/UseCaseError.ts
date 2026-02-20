/**
 * Error codes for use case failures.
 */
export type UseCaseErrorCode =
  | "VALIDATION_ERROR"
  | "DUPLICATE_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "EMAIL_NOT_VERIFIED"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "CONCURRENCY_LIMIT"
  | "INPUT_TOO_LARGE"
  | "INTERNAL_ERROR";

/**
 * Structured error for use case failures.
 * details: optional payload for API (e.g. RATE_LIMITED: { remaining, resetAt }).
 */
export interface UseCaseError {
  code: UseCaseErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Creates a validation error.
 */
export function validationError(message: string): UseCaseError {
  return { code: "VALIDATION_ERROR", message };
}

/**
 * Creates a duplicate error.
 */
export function duplicateError(message: string): UseCaseError {
  return { code: "DUPLICATE_ERROR", message };
}

/**
 * Creates a not found error.
 */
export function notFoundError(message: string): UseCaseError {
  return { code: "NOT_FOUND", message };
}

/**
 * Creates an unauthorized error.
 */
export function unauthorizedError(message: string): UseCaseError {
  return { code: "UNAUTHORIZED", message };
}

/**
 * Creates an internal error.
 */
export function internalError(message: string): UseCaseError {
  return { code: "INTERNAL_ERROR", message };
}

/**
 * Creates a conflict error (e.g., version mismatch).
 */
export function conflictError(message: string): UseCaseError {
  return { code: "CONFLICT", message };
}

/**
 * Creates a quota exceeded error.
 */
export function quotaExceededError(message: string): UseCaseError {
  return { code: "QUOTA_EXCEEDED", message };
}

/**
 * Creates a rate limit exceeded error (429).
 * details may include { remaining: number, resetAt: string (ISO) } for the API.
 */
export function rateLimitedError(
  message: string,
  details?: unknown,
): UseCaseError {
  return { code: "RATE_LIMITED", message, details };
}

/**
 * Creates a concurrency limit error (e.g. max active requests).
 */
export function concurrencyLimitError(
  message: string,
  details?: unknown,
): UseCaseError {
  return { code: "CONCURRENCY_LIMIT", message, details };
}

/**
 * Creates an input too large error (e.g. max chars exceeded).
 */
export function inputTooLargeError(message: string): UseCaseError {
  return { code: "INPUT_TOO_LARGE", message };
}

/**
 * Creates an email-not-verified error (user must confirm email before proceeding).
 */
export function emailNotVerifiedError(message: string): UseCaseError {
  return { code: "EMAIL_NOT_VERIFIED", message };
}
