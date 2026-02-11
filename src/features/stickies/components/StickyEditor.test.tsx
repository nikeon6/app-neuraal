import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StickyEditor } from "./StickyEditor";
import type { ApiSticky } from "@/shared/api/sdk";

function createMockSticky(overrides: Partial<ApiSticky> = {}): ApiSticky {
  return {
    id: "sticky-1",
    userId: "user-123",
    title: "My Sticky",
    content: { type: "doc", content: [] },
    version: 1,
    sortOrder: 0,
    columnIndex: 0,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    ...overrides,
  } as ApiSticky;
}

const mockUpdateStickyAndInvalidate = vi.fn();
const mockDeleteStickyAndInvalidate = vi.fn();

vi.mock("@/shared/api/mutations", () => ({
  updateStickyAndInvalidate: (...args: unknown[]) =>
    mockUpdateStickyAndInvalidate(...args),
  deleteStickyAndInvalidate: (...args: unknown[]) =>
    mockDeleteStickyAndInvalidate(...args),
}));

function renderStickyEditor(sticky: ApiSticky) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StickyEditor sticky={sticky} />
    </QueryClientProvider>
  );
}

describe("StickyEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateStickyAndInvalidate.mockResolvedValue(undefined);
    mockDeleteStickyAndInvalidate.mockResolvedValue(undefined);
  });

  it("renders sticky title and Sticky badge", () => {
    const sticky = createMockSticky({ title: "Test title" });
    renderStickyEditor(sticky);
    expect(screen.getByTestId("sticky-editor")).toBeInTheDocument();
    expect(screen.getByTestId("sticky-title")).toHaveValue("Test title");
    expect(screen.getByText("Sticky")).toBeInTheDocument();
  });

  it("shows delete button and opens confirm on delete", async () => {
    const sticky = createMockSticky();
    renderStickyEditor(sticky);
    const deleteBtn = screen.getByRole("button", { name: /delete sticky/i });
    await userEvent.click(deleteBtn);
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
    expect(screen.getByText(/delete sticky\?/i)).toBeInTheDocument();
  });

  it("calls updateStickyAndInvalidate when title changes (debounced)", async () => {
    const sticky = createMockSticky({ title: "Original" });
    renderStickyEditor(sticky);
    const titleInput = screen.getByTestId("sticky-title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "New title");
    expect(mockUpdateStickyAndInvalidate).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 1100));
    await waitFor(() => {
      expect(mockUpdateStickyAndInvalidate).toHaveBeenCalled();
    });
  });
});
