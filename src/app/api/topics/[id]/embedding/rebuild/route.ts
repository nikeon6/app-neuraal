import { NextRequest, NextResponse } from "next/server";
import { RebuildTopicEmbedding } from "@/application/use-cases/RebuildTopicEmbedding";
import { PrismaTopicRepository } from "@/infrastructure/persistence/PrismaTopicRepository";
import { OllamaEmbeddingProvider } from "@/infrastructure/embedding/OllamaEmbeddingProvider";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { DEFAULT_EMBEDDING_DIM } from "@/shared/constants/embedding";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/topics/:id/embedding/rebuild
 * Recalculates the embedding vector for a topic.
 * Used when a topic is renamed or for manual rebuild.
 */
export async function POST(
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
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "topicId is required",
        },
      },
      { status: 400 }
    );
  }

  // Wire up dependencies
  const topicRepo = new PrismaTopicRepository();
  const embeddingProvider = new OllamaEmbeddingProvider({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model:
      process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text-v2-moe:latest",
  });

  const embeddingDim = process.env.EMBEDDING_DIM
    ? Number.parseInt(process.env.EMBEDDING_DIM, 10)
    : DEFAULT_EMBEDDING_DIM;

  const embeddingModel =
    process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text-v2-moe:latest";

  const useCase = new RebuildTopicEmbedding(topicRepo, embeddingProvider, {
    embeddingDim,
    embeddingModel,
  });

  const result = await useCase.execute({ userId, topicId });

  if (result.isErr()) {
    const { code, message } = result.error;

    let statusCode: number;
    switch (code) {
      case "NOT_FOUND":
        statusCode = 404;
        break;
      case "INTERNAL_ERROR":
        statusCode = 500;
        break;
      default:
        statusCode = 400;
    }

    return NextResponse.json(
      { error: { code, message } },
      { status: statusCode }
    );
  }

  return NextResponse.json(result.value, { status: 200 });
}
