import { NextRequest, NextResponse } from "next/server";
import { UpdateTopic } from "@/application/use-cases/topics/UpdateTopic";
import { DeleteTopic } from "@/application/use-cases/topics/DeleteTopic";
import { PrismaTopicRepository } from "@/infrastructure/persistence/PrismaTopicRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/topics/:id
 * Updates an existing topic's name and/or color.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: topicId } = await context.params;

  // Validate topicId
  if (!topicId || topicId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "topicId is required" } },
      { status: 400 }
    );
  }

  // Parse request body
  let body: { name?: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const { name, color } = body;

  // Execute use case
  const repository = new PrismaTopicRepository();
  const updateTopic = new UpdateTopic(repository);
  const result = await updateTopic.execute({ userId, topicId, name, color });

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
    let statusCode: number;
    switch (code) {
      case "NOT_FOUND":
        statusCode = 404;
        break;
      case "DUPLICATE_ERROR":
        statusCode = 409;
        break;
      default:
        statusCode = 400;
    }

    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ topic: result.value }, { status: 200 });
}

/**
 * DELETE /api/topics/:id
 * Deletes an existing topic owned by the user.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: topicId } = await context.params;

  // Validate topicId
  if (!topicId || topicId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "topicId is required" } },
      { status: 400 }
    );
  }

  // Execute use case
  const repository = new PrismaTopicRepository();
  const deleteTopic = new DeleteTopic(repository);
  const result = await deleteTopic.execute({ userId, topicId });

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
    const statusCode = code === "NOT_FOUND" ? 404 : 400;

    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  // 204 No Content for successful deletion
  return new NextResponse(null, { status: 204 });
}
