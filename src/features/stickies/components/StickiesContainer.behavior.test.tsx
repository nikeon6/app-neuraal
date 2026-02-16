import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StickiesContainer } from "./StickiesContainer";
import type { ApiSticky } from "@/shared/api/sdk";

const createStickyAndInvalidateMock = vi.fn();
const reorderStickiesAndInvalidateMock = vi.fn();
const dragStartMock = vi.fn();

let stickiesState: ApiSticky[] = [];
let lastLeftReorder: ((ids: string[]) => void) | null = null;
let lastRightReorder: ((ids: string[]) => void) | null = null;

function createSticky(
  id: string,
  columnIndex: 0 | 1,
  sortOrder: number,
  title?: string,
): ApiSticky {
  return {
    id,
    userId: "user-123",
    title: title ?? id,
    content: { type: "doc", content: [] },
    version: 1,
    sortOrder,
    columnIndex,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  } as ApiSticky;
}

vi.mock("framer-motion", () => ({
  Reorder: {
    Group: ({
      values,
      onReorder,
      children,
      ...rest
    }: {
      values: string[];
      onReorder: (ids: string[]) => void;
      children: React.ReactNode;
    } & React.HTMLAttributes<HTMLDivElement>) => {
      const safe = rest as React.HTMLAttributes<HTMLDivElement>;
      const groupId =
        values.includes("l1") || values.includes("l2") ? "left" : "right";
      if (groupId === "left") lastLeftReorder = onReorder;
      if (groupId === "right") lastRightReorder = onReorder;
      return (
        <div className={safe.className} data-testid={`group-${groupId}`}>
          {children}
        </div>
      );
    },
    Item: ({
      children,
      ...rest
    }: {
      children: React.ReactNode;
    } & React.HTMLAttributes<HTMLDivElement>) => {
      const safe = rest as React.HTMLAttributes<HTMLDivElement>;
      return (
        <div data-testid={safe["data-testid"]} className={safe.className}>
          {children}
        </div>
      );
    },
  },
  useDragControls: () => ({
    start: dragStartMock,
  }),
}));

vi.mock("@/shared/api/queries", () => ({
  useStickiesQuery: vi.fn(() => ({
    data: stickiesState,
    isPending: false,
  })),
}));

vi.mock("@/shared/api/mutations", () => ({
  createStickyAndInvalidate: (...args: unknown[]) =>
    createStickyAndInvalidateMock(...args),
  reorderStickiesAndInvalidate: (...args: unknown[]) =>
    reorderStickiesAndInvalidateMock(...args),
}));

vi.mock("./StickyEditor", () => ({
  StickyEditor: ({ sticky }: { sticky: ApiSticky }) => (
    <div data-testid={`sticky-editor-${sticky.id}`}>{sticky.title}</div>
  ),
}));

function renderContainer() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <StickiesContainer />
    </QueryClientProvider>,
  );
}

describe("StickiesContainer behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastLeftReorder = null;
    lastRightReorder = null;
    stickiesState = [];
    createStickyAndInvalidateMock.mockResolvedValue({});
    reorderStickiesAndInvalidateMock.mockResolvedValue(undefined);
  });

  it("creates new sticky in left column when columns are balanced", async () => {
    stickiesState = [createSticky("l1", 0, 0), createSticky("r1", 1, 0)];
    renderContainer();

    fireEvent.click(screen.getByRole("button", { name: /add sticky/i }));
    await waitFor(() => {
      expect(createStickyAndInvalidateMock).toHaveBeenCalledTimes(1);
    });

    expect(createStickyAndInvalidateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        columnIndex: 0,
      }),
    );
  });

  it("creates new sticky in right column when left has more items", async () => {
    stickiesState = [
      createSticky("l1", 0, 0),
      createSticky("l2", 0, 1),
      createSticky("r1", 1, 0),
    ];
    renderContainer();

    fireEvent.click(screen.getByRole("button", { name: /add sticky/i }));
    await waitFor(() => {
      expect(createStickyAndInvalidateMock).toHaveBeenCalledTimes(1);
    });

    expect(createStickyAndInvalidateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        columnIndex: 1,
      }),
    );
  });

  it("reorders left column with columnIndex 0 payload", async () => {
    stickiesState = [
      createSticky("l1", 0, 0),
      createSticky("l2", 0, 1),
      createSticky("r1", 1, 0),
    ];
    renderContainer();
    expect(lastLeftReorder).not.toBeNull();

    lastLeftReorder?.(["l2", "l1"]);
    await waitFor(() => {
      expect(reorderStickiesAndInvalidateMock).toHaveBeenCalledTimes(1);
    });

    expect(reorderStickiesAndInvalidateMock).toHaveBeenCalledWith(
      expect.anything(),
      [
        { id: "l2", sortOrder: 0, columnIndex: 0 },
        { id: "l1", sortOrder: 1, columnIndex: 0 },
      ],
    );
  });

  it("reorders right column with columnIndex 1 payload", async () => {
    stickiesState = [
      createSticky("l1", 0, 0),
      createSticky("r1", 1, 0),
      createSticky("r2", 1, 1),
    ];
    renderContainer();
    expect(lastRightReorder).not.toBeNull();

    lastRightReorder?.(["r2", "r1"]);
    await waitFor(() => {
      expect(reorderStickiesAndInvalidateMock).toHaveBeenCalledTimes(1);
    });

    expect(reorderStickiesAndInvalidateMock).toHaveBeenCalledWith(
      expect.anything(),
      [
        { id: "r2", sortOrder: 0, columnIndex: 1 },
        { id: "r1", sortOrder: 1, columnIndex: 1 },
      ],
    );
  });

  it("ignores empty reorder payload for a column", () => {
    stickiesState = [createSticky("l1", 0, 0), createSticky("r1", 1, 0)];
    renderContainer();

    lastLeftReorder?.([]);
    lastRightReorder?.([]);
    expect(reorderStickiesAndInvalidateMock).not.toHaveBeenCalled();
  });

  it("starts drag when sticky drag handle receives pointer down", () => {
    stickiesState = [createSticky("l1", 0, 0), createSticky("r1", 1, 0)];
    renderContainer();

    fireEvent.pointerDown(screen.getAllByTestId("sticky-drag-handle")[0], {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    expect(dragStartMock).toHaveBeenCalledTimes(1);
  });
});
