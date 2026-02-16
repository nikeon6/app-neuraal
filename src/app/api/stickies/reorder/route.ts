import { NextRequest, NextResponse } from "next/server";
import { ReorderStickies } from "@/application/use-cases/stickies/ReorderStickies";
import { PrismaStickyRepository } from "@/infrastructure/persistence/PrismaStickyRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * PATCH /api/stickies/reorder
 * Bulk-updates sortOrder and columnIndex for a user's stickies.
 * Body: { items: [{ id, sortOrder, columnIndex }, ...] }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  let body: {
    items?: { id: string; sortOrder: number; columnIndex: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { items } = body;

  if (!items || !Array.isArray(items)) {
    return NextResponse.json(
      {
        error: { code: "VALIDATION_ERROR", message: "items array is required" },
      },
      { status: 400 },
    );
  }

  const repo = new PrismaStickyRepository();
  const useCase = new ReorderStickies(repo);
  const result = await useCase.execute(authResult.userId, items);

  if (result.isErr()) {
    const { code, message } = result.error;
    return NextResponse.json({ error: { code, message } }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
