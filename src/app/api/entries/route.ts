import { NextRequest, NextResponse } from "next/server";
import { CreateEntry } from "@/application/use-cases/entries/CreateEntry";
import { ListEntriesByDate } from "@/application/use-cases/entries/ListEntriesByDate";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * GET /api/entries?date=YYYY-MM-DD
 * Lists all entries for the authenticated user on a specific date.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

  // Get date from query params
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "date query parameter is required" } },
      { status: 400 }
    );
  }

  // Execute use case
  const repository = new PrismaEntryRepository();
  const listEntries = new ListEntriesByDate(repository);
  const result = await listEntries.execute({ userId, date });

  if (result.isErr()) {
    const { code, message } = result.error;
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }

  return NextResponse.json({ entries: result.value }, { status: 200 });
}

/**
 * POST /api/entries
 * Creates a new entry (task or note) for the authenticated user.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

  // Parse request body
  let body: {
    date?: string;
    type?: "task" | "note";
    title?: string;
    content?: Record<string, unknown>;
    topicId?: string | null;
    completed?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const { date, type, title, content, topicId, completed } = body;

  // Validate required fields
  if (!date || !type || title === undefined || !content) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "date, type, title, and content are required" } },
      { status: 400 }
    );
  }

  // Execute use case
  const repository = new PrismaEntryRepository();
  const createEntry = new CreateEntry(repository);
  const result = await createEntry.execute({
    userId,
    date,
    type,
    title,
    content,
    topicId,
    completed,
  });

  if (result.isErr()) {
    const { code, message } = result.error;
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }

  return NextResponse.json({ entry: result.value }, { status: 201 });
}
