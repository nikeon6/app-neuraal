import { NextRequest, NextResponse } from "next/server";
import { AutoAssignTopicToEntry } from "@/application/use-cases/topics/AutoAssignTopicToEntry";
import { PrismaTopicRepository } from "@/infrastructure/persistence/PrismaTopicRepository";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { OllamaEmbeddingProvider } from "@/infrastructure/embedding/OllamaEmbeddingProvider";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import {
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_AUTO_TOPIC_THRESHOLD,
} from "@/shared/constants/embedding";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/auto-topic
 * Auto-assigns the best matching topic to an entry based on embedding similarity.
 *
 * Body (optional):
 * { "threshold": 0.35 }
 */
export async function POST(
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
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "entryId is required",
        },
      },
      { status: 400 },
    );
  }

  // Parse optional body
  let threshold: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.threshold === "number") {
      if (body.threshold < 0 || body.threshold > 1) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "threshold must be between 0 and 1",
            },
          },
          { status: 400 },
        );
      }
      threshold = body.threshold;
    }
  } catch {
    // No body or invalid JSON — use default threshold
  }

  // Wire up dependencies
  const topicRepo = new PrismaTopicRepository();
  const entryRepo = new PrismaEntryRepository();
  const embeddingProvider = new OllamaEmbeddingProvider({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_EMBED_MODEL || "qwen3-embedding:latest",
  });

  const embeddingDim = process.env.EMBEDDING_DIM
    ? Number.parseInt(process.env.EMBEDDING_DIM, 10)
    : DEFAULT_EMBEDDING_DIM;

  const defaultThreshold = process.env.AUTO_TOPIC_THRESHOLD
    ? Number.parseFloat(process.env.AUTO_TOPIC_THRESHOLD)
    : DEFAULT_AUTO_TOPIC_THRESHOLD;

  const useCase = new AutoAssignTopicToEntry(
    topicRepo,
    entryRepo,
    embeddingProvider,
    { embeddingDim, defaultThreshold },
  );

  const result = await useCase.execute({ userId, entryId, threshold });

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
      { status: statusCode },
    );
  }

  return NextResponse.json(result.value, { status: 200 });
}
