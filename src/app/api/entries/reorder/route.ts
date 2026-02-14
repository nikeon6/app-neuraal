import { NextRequest, NextResponse } from "next/server";
import { ReorderEntries } from "@/application/use-cases/entries/ReorderEntries";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * PATCH /api/entries/reorder
 * Bulk-updates the display order of entries for a given date.
 * Body: { date: "YYYY-MM-DD", orderedIds: ["id1", "id2", ...] }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

  // Parse request body
  let body: { date?: string; orderedIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { date, orderedIds } = body;

  if (!date || !orderedIds) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "date and orderedIds are required",
        },
      },
      { status: 400 },
    );
  }

  // Execute use case
  const repository = new PrismaEntryRepository();
  const reorderEntries = new ReorderEntries(repository);
  const result = await reorderEntries.execute({ userId, date, orderedIds });

  if (result.isErr()) {
    const { code, message } = result.error;
    const status = code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: { code, message } }, { status });
  }

  return new NextResponse(null, { status: 204 });
}
