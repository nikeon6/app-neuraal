import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * Extracts or generates a unique request ID.
 *
 * Priority:
 * 1. `x-request-id` header from the incoming request (forwarded proxies)
 * 2. Newly generated UUID
 */
export function getRequestId(request: NextRequest): string {
  const fromHeader = request.headers.get("x-request-id");
  if (fromHeader && fromHeader.trim().length > 0) {
    return fromHeader.trim();
  }
  return randomUUID();
}
