import { NextRequest, NextResponse } from "next/server";
import { CreateTopic } from "@/application/use-cases/topics/CreateTopic";
import { ListTopics } from "@/application/use-cases/topics/ListTopics";
import { RebuildTopicEmbedding } from "@/application/use-cases/topics/RebuildTopicEmbedding";
import { PrismaTopicRepository } from "@/infrastructure/persistence/PrismaTopicRepository";
import { OllamaEmbeddingProvider } from "@/infrastructure/embedding/OllamaEmbeddingProvider";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import {
  DEFAULT_EMBEDDING_DIM,
} from "@/shared/constants/embedding";

/**
 * GET /api/topics
 * Returns all topics for the authenticated user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = await getAuthUserId(request);
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
  const authResult = await getAuthUserId(request);
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

  // Fire-and-forget: generate embedding for the new topic.
  // If it fails, the topic is still created — embedding can be rebuilt later.
  const topic = result.value;
  const embeddingProvider = new OllamaEmbeddingProvider({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_EMBED_MODEL || "qwen3-embedding:latest",
  });
  const embeddingDim = process.env.EMBEDDING_DIM
    ? Number.parseInt(process.env.EMBEDDING_DIM, 10)
    : DEFAULT_EMBEDDING_DIM;
  const rebuildUseCase = new RebuildTopicEmbedding(repository, embeddingProvider, {
    embeddingDim,
    embeddingModel: process.env.OLLAMA_EMBED_MODEL || "qwen3-embedding:latest",
  });
  rebuildUseCase.execute({ userId, topicId: topic.id }).catch((err) => {
    console.error(`[POST /api/topics] Failed to generate embedding for topic ${topic.id}:`, err);
  });

  return NextResponse.json({ topic }, { status: 201 });
}
