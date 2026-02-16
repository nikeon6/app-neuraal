import { NextRequest, NextResponse } from "next/server";
import { UpdateEntry } from "@/application/use-cases/entries/UpdateEntry";
import { DeleteEntry } from "@/application/use-cases/entries/DeleteEntry";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/entries/:id
 * Updates an existing entry with optimistic concurrency.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  // Check authentication
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: entryId } = await context.params;

  // Validate entryId
  if (!entryId || entryId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "entryId is required" } },
      { status: 400 },
    );
  }

  // Parse request body
  let body: {
    version?: number;
    title?: string;
    content?: Record<string, unknown>;
    topicId?: string | null;
    completed?: boolean;
    type?: "task" | "note";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { version, title, content, topicId, completed, type } = body;

  // Execute use case
  const repository = new PrismaEntryRepository();
  const updateEntry = new UpdateEntry(repository);
  const result = await updateEntry.execute({
    userId,
    entryId,
    version: version as number,
    title,
    content,
    topicId,
    completed,
    type,
  });

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
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

    return NextResponse.json(
      { error: { code, message } },
      { status: statusCode },
    );
  }

  return NextResponse.json({ entry: result.value }, { status: 200 });
}

/**
 * DELETE /api/entries/:id
 * Deletes an existing entry owned by the user.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  // Check authentication
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: entryId } = await context.params;

  // Validate entryId
  if (!entryId || entryId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "entryId is required" } },
      { status: 400 },
    );
  }

  // Execute use case
  const repository = new PrismaEntryRepository();
  const deleteEntry = new DeleteEntry(repository);
  const result = await deleteEntry.execute({ userId, entryId });

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
    const statusCode = code === "NOT_FOUND" ? 404 : 400;

    return NextResponse.json(
      { error: { code, message } },
      { status: statusCode },
    );
  }

  // 204 No Content for successful deletion
  return new NextResponse(null, { status: 204 });
}
