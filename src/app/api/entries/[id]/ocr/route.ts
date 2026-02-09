import { NextRequest, NextResponse } from "next/server";
import { ExtractImageText } from "@/application/use-cases/ocr/ExtractImageText";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaAttachmentRepository } from "@/infrastructure/persistence/PrismaAttachmentRepository";
import { S3ObjectStorage } from "@/infrastructure/storage/S3ObjectStorage";
import {
  OllamaVisionProvider,
  PROMPT_SCAN_TEXT,
  PROMPT_DESCRIBE,
} from "@/infrastructure/ocr/OllamaVisionProvider";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

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
  context: RouteContext
): Promise<NextResponse> {
  // 1. Auth
  const authResult = getAuthUserId(request);
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
      { status: 400 }
    );
  }

  const { attachmentId, mode: rawMode } = body;
  if (!attachmentId || typeof attachmentId !== "string" || !attachmentId.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "attachmentId is required" } },
      { status: 400 }
    );
  }

  // Default to "scan" mode; validate if provided
  const mode: VisionMode =
    rawMode === "describe" ? "describe" : "scan";

  // 3. Build dependencies
  const entryRepository = new PrismaEntryRepository();
  const attachmentRepository = new PrismaAttachmentRepository();
  const objectStorage = new S3ObjectStorage();
  const ocrProvider = new OllamaVisionProvider({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_OCR_MODEL || "glm-ocr",
    timeoutMs: 120_000,
  });

  // 4. Execute use case with the appropriate prompt
  const useCase = new ExtractImageText(
    entryRepository,
    attachmentRepository,
    objectStorage,
    ocrProvider
  );

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
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ ...result.value, mode }, { status: 200 });
}
