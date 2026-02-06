/**
 * Error codes for use case failures.
 */
export type UseCaseErrorCode =
  | "VALIDATION_ERROR"
  | "DUPLICATE_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR";

/**
 * Structured error for use case failures.
 */
export interface UseCaseError {
  code: UseCaseErrorCode;
  message: string;
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
