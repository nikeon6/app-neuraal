import { NextRequest, NextResponse } from "next/server";
import { GetMe } from "@/application/use-cases/auth/GetMe";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import type { UseCaseErrorCode } from "@/application/core/UseCaseError";

function errorCodeToStatus(code: UseCaseErrorCode): number {
  const map: Record<UseCaseErrorCode, number> = {
    VALIDATION_ERROR: 400,
    DUPLICATE_ERROR: 409,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    QUOTA_EXCEEDED: 429,
    INTERNAL_ERROR: 500,
  };
  return map[code] ?? 500;
}

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const useCase = new GetMe(new PrismaUserRepository());
  const result = await useCase.execute({ userId: authResult.userId });

  if (result.isErr()) {
    const { code, message } = result.error;
    const status = errorCodeToStatus(code);
    return NextResponse.json({ error: { code, message } }, { status });
  }

  return NextResponse.json({ user: result.value }, { status: 200 });
}
