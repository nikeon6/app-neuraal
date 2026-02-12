import { NextRequest, NextResponse } from "next/server";
import { UpdateSticky } from "@/application/use-cases/stickies/UpdateSticky";
import { DeleteSticky } from "@/application/use-cases/stickies/DeleteSticky";
import { PrismaStickyRepository } from "@/infrastructure/persistence/PrismaStickyRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/stickies/:id
 * Updates an existing sticky with optimistic concurrency.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { id: stickyId } = await context.params;

  if (!stickyId || stickyId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "stickyId is required" } },
      { status: 400 }
    );
  }

  let body: {
    version?: number;
    title?: string;
    content?: Record<string, unknown>;
    columnIndex?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const repo = new PrismaStickyRepository();
  const useCase = new UpdateSticky(repo);
  const result = await useCase.execute(stickyId, authResult.userId, {
    version: body.version as number,
    title: body.title,
    content: body.content,
    columnIndex: body.columnIndex,
  });

  if (result.isErr()) {
    const { code, message } = result.error;
    let statusCode: number;
    switch (code) {
      case "NOT_FOUND":
        statusCode = 404;
        break;
      case "CONFLICT":
        statusCode = 409;
        break;
      default:
        statusCode = 400;
    }
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ sticky: result.value }, { status: 200 });
}

/**
 * DELETE /api/stickies/:id
 * Deletes a sticky owned by the user.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { id: stickyId } = await context.params;

  if (!stickyId || stickyId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "stickyId is required" } },
      { status: 400 }
    );
  }

  const repo = new PrismaStickyRepository();
  const useCase = new DeleteSticky(repo);
  const result = await useCase.execute(stickyId, authResult.userId);

  if (result.isErr()) {
    const { code, message } = result.error;
    const statusCode = code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return new NextResponse(null, { status: 204 });
}
