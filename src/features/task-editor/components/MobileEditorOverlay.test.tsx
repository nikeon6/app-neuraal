import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MobileEditorOverlay } from "./MobileEditorOverlay";
import type { ApiEntry } from "@/shared/api/sdk";

function createMockEntry(
  id: string,
  title: string,
  overrides: Partial<ApiEntry> = {},
): ApiEntry {
  return {
    id,
    userId: "user-123",
    date: "2024-01-15",
    type: "task",
    title,
    content: null,
    topicId: null,
    completed: false,
    summary: null,
    summaryUpdatedAt: null,
    version: 1,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    ...overrides,
  } as ApiEntry;
}

vi.mock("./TaskEditor", () => ({
  TaskEditor: ({
    entry,
    forceExpanded,
  }: {
    entry: ApiEntry;
    forceExpanded?: boolean;
  }) => (
    <div
      data-testid="mock-task-editor"
      data-entry-id={entry.id}
      data-force-expanded={String(!!forceExpanded)}
      aria-label="Task editor"
    >
      {entry.title}
    </div>
  ),
}));

describe("MobileEditorOverlay", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
  });

  it("renders nothing when entry is null", () => {
    render(<MobileEditorOverlay entry={null} onClose={onClose} />);
    expect(
      screen.queryByTestId("mobile-editor-overlay"),
    ).not.toBeInTheDocument();
  });

  it("renders the overlay when entry is provided", () => {
    const entry = createMockEntry("e1", "Test task");
    render(<MobileEditorOverlay entry={entry} onClose={onClose} />);
    expect(screen.getByTestId("mobile-editor-overlay")).toBeInTheDocument();
    expect(screen.getByText("Edit entry")).toBeInTheDocument();
  });

  it("calls onClose when the back button is clicked", () => {
    const entry = createMockEntry("e1", "Test task");
    render(<MobileEditorOverlay entry={entry} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /go back/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const entry = createMockEntry("e1", "Test task");
    render(<MobileEditorOverlay entry={entry} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders a TaskEditor with forceExpanded inside the overlay", () => {
    const entry = createMockEntry("e1", "Test task");
    render(<MobileEditorOverlay entry={entry} onClose={onClose} />);

    const editor = screen.getByTestId("mock-task-editor");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute("data-entry-id", "e1");
    expect(editor).toHaveAttribute("data-force-expanded", "true");
  });

  it("locks body scroll when entry is provided", async () => {
    const entry = createMockEntry("e1", "Test task");
    const { unmount } = render(
      <MobileEditorOverlay entry={entry} onClose={onClose} />,
    );

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    unmount();
  });

  it("restores body scroll on unmount", async () => {
    const entry = createMockEntry("e1", "Test task");
    document.body.style.overflow = "auto";

    const { unmount } = render(
      <MobileEditorOverlay entry={entry} onClose={onClose} />,
    );

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
