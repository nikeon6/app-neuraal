import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskEditor } from "./TaskEditor";
import type { ApiEntry } from "@/shared/api/sdk";

function createMockEntry(overrides: Partial<ApiEntry> = {}): ApiEntry {
  return {
    id: "entry-attachment-test",
    userId: "user-123",
    date: "2024-01-15",
    type: "task",
    title: "Attachment test",
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

const mockTopicsQuery = vi.fn();
const mockUpdateEntryAndInvalidate = vi.fn();
const mockDeleteEntryAndInvalidate = vi.fn();
const mockUseReminderActions = vi.fn();
const mockUseSummaryActions = vi.fn();

const descendantsSpy = vi.fn();
const trDeleteSpy = vi.fn();
const dispatchSpy = vi.fn();

let editorMock: {
  isDestroyed: boolean;
  state: {
    doc: { descendants: typeof descendantsSpy };
    tr: { delete: typeof trDeleteSpy };
  };
  view: { dispatch: typeof dispatchSpy };
};

vi.mock("@/shared/api/queries", () => ({
  useTopicsQuery: (...args: unknown[]) => mockTopicsQuery(...args),
  entriesQueryKey: (dateKey: string) => ["entries", dateKey],
  topicsQueryKey: ["topics"],
  useEntryAttachmentsQuery: () => ({ data: undefined, isLoading: false }),
  attachmentsQueryKey: (entryId: string) => ["attachments", entryId],
}));

vi.mock("@/shared/api/mutations", () => ({
  updateEntryAndInvalidate: (...args: unknown[]) =>
    mockUpdateEntryAndInvalidate(...args),
  deleteEntryAndInvalidate: (...args: unknown[]) =>
    mockDeleteEntryAndInvalidate(...args),
}));

vi.mock("@/shared/api/sdk/entries", () => ({
  autoTopicEntry: vi.fn().mockResolvedValue({
    entryId: "entry-attachment-test",
    selectedTopicId: null,
    score: null,
  }),
}));

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      selectedDate: new Date("2024-01-15"),
      selectedDay: 15,
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
  selectDateKey: (state: { selectedDate: Date }) => {
    const d = state.selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
}));

vi.mock("../hooks/useImageUpload", () => ({
  useImageUpload: () => ({ uploadImages: vi.fn() }),
}));

vi.mock("../hooks/useResolveAttachmentUrls", () => ({
  useResolveAttachmentUrls: vi.fn(),
}));

vi.mock("../hooks/useTrackDeletedImages", () => ({
  useTrackDeletedImages: vi.fn(),
}));

vi.mock("../hooks/useServerDataSync", () => ({
  useServerDataSync: vi.fn(),
}));

vi.mock("../hooks/useEditorCollapse", () => ({
  useEditorCollapse: vi.fn(),
  useContentMenuClose: vi.fn(),
}));

vi.mock("../hooks/useReminderActions", () => ({
  useReminderActions: (...args: unknown[]) => mockUseReminderActions(...args),
}));

vi.mock("../hooks/useSummaryActions", () => ({
  useSummaryActions: (...args: unknown[]) => mockUseSummaryActions(...args),
}));

vi.mock("./TiptapEditor", () => ({
  TiptapEditor: ({
    editorRef,
  }: {
    editorRef?: React.RefObject<{ editor: unknown } | null>;
  }) => {
    if (editorRef && "current" in editorRef) {
      (editorRef as { current: unknown }).current = { editor: editorMock };
    }
    return <div aria-label="Rich text editor">Mock editor</div>;
  },
}));

vi.mock("@/features/attachments", () => ({
  AttachmentPanel: ({
    onAttachmentDeleted,
  }: {
    onAttachmentDeleted?: (attachmentId: string) => void;
  }) => (
    <button
      type="button"
      aria-label="Delete panel attachment"
      onClick={() => onAttachmentDeleted?.("att-1")}
    >
      Trigger panel delete
    </button>
  ),
}));

function renderEditor(entryOverrides: Partial<ApiEntry> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const entry = createMockEntry(entryOverrides);
  return render(
    <QueryClientProvider client={qc}>
      <TaskEditor entry={entry} />
    </QueryClientProvider>,
  );
}

describe("TaskEditor attachment deletion sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTopicsQuery.mockReturnValue({ data: [], isPending: false });
    mockUpdateEntryAndInvalidate.mockResolvedValue(
      createMockEntry({ version: 2 }),
    );
    mockDeleteEntryAndInvalidate.mockResolvedValue(undefined);
    mockUseReminderActions.mockReturnValue({
      isReminderDialogOpen: false,
      setIsReminderDialogOpen: vi.fn(),
      activeReminderId: null,
      isReminderSaving: false,
      handleCreateReminder: vi.fn(),
      handleRescheduleReminder: vi.fn(),
      handleCancelReminder: vi.fn(),
    });
    mockUseSummaryActions.mockReturnValue({
      isSummarizing: false,
      summarizeError: null,
      setSummarizeError: vi.fn(),
      handleSummarize: vi.fn(),
      handleClearSummary: vi.fn(),
    });

    trDeleteSpy.mockReturnValue(undefined);
    editorMock = {
      isDestroyed: false,
      state: {
        doc: { descendants: descendantsSpy },
        tr: { delete: trDeleteSpy },
      },
      view: { dispatch: dispatchSpy },
    };
  });

  it("deletes matching editor node when panel reports deletion", async () => {
    const user = userEvent.setup();
    descendantsSpy.mockImplementation(
      (cb: (node: unknown, pos: number) => void) => {
        cb(
          {
            type: { name: "image" },
            attrs: { attachmentId: "att-1" },
            nodeSize: 3,
          },
          7,
        );
      },
    );

    renderEditor();
    await user.click(screen.getByRole("textbox", { name: /title/i }));
    await user.click(
      screen.getByRole("button", { name: /delete panel attachment/i }),
    );

    expect(trDeleteSpy).toHaveBeenCalledWith(7, 10);
    expect(dispatchSpy).toHaveBeenCalledWith(editorMock.state.tr);
  });

  it("does nothing when no matching attachment node exists", async () => {
    const user = userEvent.setup();
    descendantsSpy.mockImplementation(
      (cb: (node: unknown, pos: number) => void) => {
        cb(
          {
            type: { name: "image" },
            attrs: { attachmentId: "different-id" },
            nodeSize: 2,
          },
          5,
        );
      },
    );

    renderEditor();
    await user.click(screen.getByRole("textbox", { name: /title/i }));
    await user.click(
      screen.getByRole("button", { name: /delete panel attachment/i }),
    );

    expect(trDeleteSpy).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when editor is destroyed", async () => {
    const user = userEvent.setup();
    editorMock.isDestroyed = true;

    renderEditor();
    await user.click(screen.getByRole("textbox", { name: /title/i }));
    await user.click(
      screen.getByRole("button", { name: /delete panel attachment/i }),
    );

    expect(trDeleteSpy).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
