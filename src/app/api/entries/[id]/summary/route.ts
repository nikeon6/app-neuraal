import { NextRequest, NextResponse } from "next/server";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/entries/:id/summary
 * Clears the AI-generated summary from an entry.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const authResult = await getAuthUserId(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: entryId } = await ctx.params;

  const repository = new PrismaEntryRepository();
  const entry = await repository.findById(entryId);

  if (!entry || entry.userId !== userId) {
    return NextResponse.json(
      { error: { message: "Entry not found", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  await repository.clearSummary(entryId);

  return new NextResponse(null, { status: 204 });
}
