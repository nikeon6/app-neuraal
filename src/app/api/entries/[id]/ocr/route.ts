import { NextRequest, NextResponse } from "next/server";
import { ExtractImageText } from "@/application/use-cases/ocr/ExtractImageText";
import { GuardAiAction } from "@/application/use-cases/ai/GuardAiAction";
import { ConsumeAiRequest } from "@/application/use-cases/ai/ConsumeAiRequest";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaAttachmentRepository } from "@/infrastructure/persistence/PrismaAttachmentRepository";
import { PrismaAiUsageRepository } from "@/infrastructure/persistence/PrismaAiUsageRepository";
import { S3ObjectStorage } from "@/infrastructure/storage/S3ObjectStorage";
import {
  OllamaVisionProvider,
  PROMPT_SCAN_TEXT,
  PROMPT_DESCRIBE,
} from "@/infrastructure/ocr/OllamaVisionProvider";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { getAiGuardrailsConfig } from "@/infrastructure/config/AiGuardrailsConfig";
import { getRedisConnection } from "@/infrastructure/redis/RedisClient";
import { RedisRateLimiter } from "@/infrastructure/redis/RedisRateLimiter";
import { RedisConcurrencyLimiter } from "@/infrastructure/redis/RedisConcurrencyLimiter";
import { SystemClock } from "@/infrastructure/auth/SystemClock";

/** Supported vision analysis modes. */
type VisionMode = "scan" | "describe";

const PROMPTS: Record<VisionMode, string> = {
  scan: PROMPT_SCAN_TEXT,
  describe: PROMPT_DESCRIBE,
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/ocr
 * Analyzes an image attachment using Ollama Vision.
 *
 * Request body: { attachmentId: string, mode?: "scan" | "describe" }
 * Response: { attachmentId: string, extractedText: string }
 *
 * - mode "scan" (default): extracts visible text from the image (OCR).
 * - mode "describe": generates a detailed description of the image.
 *
 * This is a synchronous call — the server waits for Ollama to finish
 * processing (typically 5-30s depending on image complexity and model).
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  // 1. Auth
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: entryId } = await context.params;

  // 2. Parse body
  let body: { attachmentId?: string; mode?: string };
  try {
    body = (await request.json()) as { attachmentId?: string; mode?: string };
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { attachmentId, mode: rawMode } = body;
  if (
    !attachmentId ||
    typeof attachmentId !== "string" ||
    !attachmentId.trim()
  ) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "attachmentId is required",
        },
      },
      { status: 400 },
    );
  }

  // Default to "scan" mode; validate if provided
  const mode: VisionMode = rawMode === "describe" ? "describe" : "scan";

  // 2b. AI Guardrails for OCR
  const guardrailsConfig = getAiGuardrailsConfig();
  const ocrConfig = guardrailsConfig.ocrImage;
  const redis = getRedisConnection();
  const concurrencyLimiter = new RedisConcurrencyLimiter(redis);
  const concurrencyKey = `ai:ocr:user:${userId}`;

  const ocrConcurrencyChecker = {
    countActiveByUserId: async () => {
      const result = await concurrencyLimiter.acquire(
        concurrencyKey,
        ocrConfig.maxActivePerUser,
        120,
      );
      if (!result.acquired) return ocrConfig.maxActivePerUser; // Will trigger concurrency error
      return result.current - 1; // current already includes this request
    },
  };

  const guardAiAction = new GuardAiAction(
    ocrConcurrencyChecker,
    new PrismaAiUsageRepository(),
    new RedisRateLimiter(redis),
    new SystemClock(),
    {
      maxActivePerUser: ocrConfig.maxActivePerUser,
      maxActivePerEntry: 0,
      maxInputChars: 0,
      maxInputBytes: ocrConfig.maxInputBytes,
      rateLimitPerMinute: ocrConfig.rateLimitPerMinute,
      rateLimitPerHour: 0,
      monthlyQuotaRequests: ocrConfig.monthlyQuotaRequests,
      rateLimitPrefix: guardrailsConfig.rateLimitPrefix,
    },
  );

  // Note: we don't know image bytes yet, so we pass 0 here. The actual byte check
  // happens after fetching the image. The guard still checks rate limit + quota + concurrency.
  const guardResult = await guardAiAction.execute({
    userId,
    action: "OCR_IMAGE",
    entryId,
  });

  if (guardResult.isErr()) {
    await concurrencyLimiter.release(concurrencyKey);
    const { code, message, details } = guardResult.error;
    let statusCode: number;
    switch (code) {
      case "RATE_LIMITED":
        statusCode = 429;
        break;
      case "QUOTA_EXCEEDED":
        statusCode = 403;
        break;
      case "CONCURRENCY_LIMIT":
        statusCode = 409;
        break;
      case "INPUT_TOO_LARGE":
        statusCode = 400;
        break;
      default:
        statusCode = 400;
    }
    return NextResponse.json(
      { error: { code, message, ...(details !== undefined && { details }) } },
      { status: statusCode },
    );
  }

  // 3. Build dependencies
  const entryRepository = new PrismaEntryRepository();
  const attachmentRepository = new PrismaAttachmentRepository();
  const objectStorage = new S3ObjectStorage();
  const ocrProvider = new OllamaVisionProvider({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_OCR_MODEL || "glm-ocr:q8_0",
    timeoutMs: 120_000,
  });

  // 4. Execute use case with the appropriate prompt
  const useCase = new ExtractImageText(
    entryRepository,
    attachmentRepository,
    objectStorage,
    ocrProvider,
  );

  try {
    const result = await useCase.execute({
      userId,
      entryId,
      attachmentId: attachmentId.trim(),
      prompt: PROMPTS[mode],
    });

    if (result.isErr()) {
      const { code, message } = result.error;
      let statusCode: number;
      switch (code) {
        case "NOT_FOUND":
          statusCode = 404;
          break;
        case "INTERNAL_ERROR":
          statusCode = 502;
          break;
        default:
          statusCode = 400;
      }
      return NextResponse.json(
        { error: { code, message } },
        { status: statusCode },
      );
    }

    // 5. Persist vision result server-side into entry content JSON.
    //    This ensures the result survives even if the client navigates away
    //    before the response arrives (component unmounts, setState is no-op).
    try {
      const entry = await entryRepository.findById(entryId);
      if (entry) {
        const content = entry.content.toJSON();
        const updated = injectVisionResult(
          content,
          attachmentId.trim(),
          result.value.extractedText,
          mode,
        );
        if (updated) {
          await entryRepository.updateContent(entryId, updated);
        }
      }
    } catch (error) {
      // Non-fatal: the OCR result is still returned to the client.
      // If the client is still mounted it will persist via ProseMirror transaction.
      console.error(
        "[OCR] Failed to persist vision result server-side:",
        error,
      );
    }

    // 6. Record AI usage for OCR
    const consumeAiRequest = new ConsumeAiRequest(
      new PrismaAiUsageRepository(),
      new SystemClock(),
    );
    await consumeAiRequest.execute({ userId, action: "OCR_IMAGE" });

    const aiUsageRepo = new PrismaAiUsageRepository();
    await aiUsageRepo.addLedgerEntry({
      userId,
      action: "OCR_IMAGE",
      model: process.env.OLLAMA_OCR_MODEL || "glm-ocr:q8_0",
      metaJson: { entryId, attachmentId: attachmentId.trim(), mode },
    });

    return NextResponse.json({ ...result.value, mode }, { status: 200 });
  } finally {
    await concurrencyLimiter.release(concurrencyKey);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively traverse a Tiptap/ProseMirror JSON doc and inject
 * `visionResult` + `visionMode` into the image node whose
 * `attachmentId` matches. Returns the updated doc, or null if no match.
 */
function injectVisionResult(
  doc: Record<string, unknown>,
  attachmentId: string,
  text: string,
  mode: string,
): Record<string, unknown> | null {
  const clone = structuredClone(doc);
  const found = injectInNode(clone, attachmentId, text, mode);
  return found ? clone : null;
}

function injectInNode(
  node: Record<string, unknown>,
  attachmentId: string,
  text: string,
  mode: string,
): boolean {
  if (node.type === "image" && node.attrs) {
    const attrs = node.attrs as Record<string, unknown>;
    if (attrs.attachmentId === attachmentId) {
      attrs.visionResult = text;
      attrs.visionMode = mode;
      return true;
    }
  }

  const content = node.content;
  if (Array.isArray(content)) {
    for (const child of content) {
      if (
        injectInNode(child as Record<string, unknown>, attachmentId, text, mode)
      ) {
        return true;
      }
    }
  }
  return false;
}
