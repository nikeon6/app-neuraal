import { NextRequest, NextResponse } from "next/server";
import { ListStickies } from "@/application/use-cases/stickies/ListStickies";
import { CreateSticky } from "@/application/use-cases/stickies/CreateSticky";
import { PrismaStickyRepository } from "@/infrastructure/persistence/PrismaStickyRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * GET /api/stickies
 * Lists all stickies for the authenticated user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const repo = new PrismaStickyRepository();
  const useCase = new ListStickies(repo);
  const result = await useCase.execute(authResult.userId);

  if (result.isErr()) {
    const { code, message } = result.error;
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }

  return NextResponse.json({ stickies: result.value }, { status: 200 });
}

/**
 * POST /api/stickies
 * Creates a new sticky for the authenticated user.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  let body: {
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

  const { title, content, columnIndex } = body;

  if (title === undefined || !content) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "title and content are required" } },
      { status: 400 }
    );
  }

  const repo = new PrismaStickyRepository();
  const useCase = new CreateSticky(repo);
  const result = await useCase.execute({
    userId: authResult.userId,
    title,
    content,
    columnIndex,
  });

  if (result.isErr()) {
    const { code, message } = result.error;
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }

  return NextResponse.json({ sticky: result.value }, { status: 201 });
}
