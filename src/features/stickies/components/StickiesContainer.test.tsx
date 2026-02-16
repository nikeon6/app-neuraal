import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StickiesContainer } from "./StickiesContainer";
import type { ApiSticky } from "@/shared/api/sdk";

function createMockSticky(
  id: string,
  overrides: Partial<ApiSticky> = {},
): ApiSticky {
  return {
    id,
    userId: "user-123",
    title: `Sticky ${id}`,
    content: { type: "doc", content: [] },
    version: 1,
    sortOrder: 0,
    columnIndex: 0,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    ...overrides,
  } as ApiSticky;
}

const mockStickies: ApiSticky[] = [
  createMockSticky("s1", { title: "Left 1", columnIndex: 0, sortOrder: 0 }),
  createMockSticky("s2", { title: "Left 2", columnIndex: 0, sortOrder: 1 }),
  createMockSticky("s3", { title: "Right 1", columnIndex: 1, sortOrder: 0 }),
];

const mockUseStickiesQuery = vi.fn();
const mockCreateStickyAndInvalidate = vi.fn();
const mockReorderStickiesAndInvalidate = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useStickiesQuery: (...args: unknown[]) => mockUseStickiesQuery(...args),
  stickiesQueryKey: ["stickies"],
}));

vi.mock("@/shared/api/mutations", () => ({
  createStickyAndInvalidate: (...args: unknown[]) =>
    mockCreateStickyAndInvalidate(...args),
  reorderStickiesAndInvalidate: (...args: unknown[]) =>
    mockReorderStickiesAndInvalidate(...args),
}));

vi.mock("./StickyEditor", () => ({
  StickyEditor: ({ sticky }: { sticky: ApiSticky }) => (
    <div aria-label="Sticky editor" data-sticky-id={sticky.id}>
      <input aria-label="Sticky title" defaultValue={sticky.title} readOnly />
    </div>
  ),
}));

function renderStickiesContainer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StickiesContainer />
    </QueryClientProvider>,
  );
}

describe("StickiesContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStickiesQuery.mockReturnValue({
      data: [],
      isPending: false,
    });
    mockCreateStickyAndInvalidate.mockResolvedValue({});
    mockReorderStickiesAndInvalidate.mockResolvedValue(undefined);
  });

  it("shows loading state when pending and no data", () => {
    mockUseStickiesQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });
    renderStickiesContainer();
    expect(screen.getByText(/loading stickies/i)).toBeInTheDocument();
  });

  it("shows empty state and Add sticky button when no stickies", () => {
    mockUseStickiesQuery.mockReturnValue({
      data: [],
      isPending: false,
    });
    renderStickiesContainer();
    expect(screen.getByText(/no stickies yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add sticky/i }),
    ).toBeInTheDocument();
  });

  it("calls createStickyAndInvalidate when Add sticky is clicked", async () => {
    mockUseStickiesQuery.mockReturnValue({
      data: [],
      isPending: false,
    });
    renderStickiesContainer();
    const addBtn = screen.getByRole("button", { name: /add sticky/i });
    await userEvent.click(addBtn);
    await waitFor(() => {
      expect(mockCreateStickyAndInvalidate).toHaveBeenCalled();
    });
    expect(mockCreateStickyAndInvalidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "",
        content: { type: "doc", content: [] },
      }),
    );
  });

  it("renders stickies in two independent columns", () => {
    mockUseStickiesQuery.mockReturnValue({
      data: mockStickies,
      isPending: false,
    });
    renderStickiesContainer();
    expect(screen.getByLabelText(/stickies container/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Left 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Left 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Right 1")).toBeInTheDocument();
  });
});
