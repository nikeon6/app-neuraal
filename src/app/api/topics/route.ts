import { NextRequest, NextResponse } from "next/server";
import { CreateTopic } from "@/application/use-cases/topics/CreateTopic";
import { ListTopics } from "@/application/use-cases/topics/ListTopics";
import { PrismaTopicRepository } from "@/infrastructure/persistence/PrismaTopicRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * GET /api/topics
 * Returns all topics for the authenticated user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }

  const { userId } = authResult;

  // Execute use case
  const repository = new PrismaTopicRepository();
  const listTopics = new ListTopics(repository);
  const result = await listTopics.execute({ userId });

  if (result.isErr()) {
    // Shouldn't happen with valid userId, but handle defensively
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ topics: result.value }, { status: 200 });
}

/**
 * POST /api/topics
 * Creates a new topic for the authenticated user.
 * 
 * Request body:
 * - name: string (required)
 * - color: string (required, #RRGGBB format)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }

  const { userId } = authResult;

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

  // Basic validation (use case does detailed validation)
  if (!name || !color) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "name and color are required",
        },
      },
      { status: 400 }
    );
  }

  // Execute use case
  const repository = new PrismaTopicRepository();
  const createTopic = new CreateTopic(repository);
  const result = await createTopic.execute({ userId, name, color });

  if (result.isErr()) {
    const { code, message } = result.error;
    
    // Map error codes to HTTP status codes
    const statusCode = code === "DUPLICATE_ERROR" ? 409 : 400;
    
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ topic: result.value }, { status: 201 });
}
