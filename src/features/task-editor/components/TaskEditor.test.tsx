import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskEditor } from "./TaskEditor";
import type { ApiEntry } from "@/shared/api/sdk";
import { ApiError } from "@/shared/api/apiClient";

// ============================================================================
// Mock Data
// ============================================================================
function createMockEntry(overrides: Partial<ApiEntry> = {}): ApiEntry {
  return {
    id: "entry-test",
    userId: "user-123",
    date: "2024-01-15",
    type: "task",
    title: "Test Task",
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

const mockTopics = [
  { id: "topic-work", userId: "user-123", name: "Trabajo", color: "#3b82f6" },
  { id: "topic-health", userId: "user-123", name: "Salud", color: "#22c55e" },
];

// ============================================================================
// Mocks
// ============================================================================
const mockTopicsQuery = vi.fn();
const mockUpdateEntryAndInvalidate = vi.fn();
const mockDeleteEntryAndInvalidate = vi.fn();
const mockSetSummarizeError = vi.fn();
const mockUseSummaryActions = vi.fn();
const mockHandleSummarize = vi.fn();
const mockHandleClearSummary = vi.fn();
const mockInitUpload = vi.fn();
const mockCompleteUpload = vi.fn();
const mockGetDownloadUrl = vi.fn();
const mockListByEntry = vi.fn();
const mockDeleteAttachment = vi.fn();
const mockUseReminderActions = vi.fn();
const mockSetIsReminderDialogOpen = vi.fn();
const mockHandleCreateReminder = vi.fn();
const mockHandleRescheduleReminder = vi.fn();
const mockHandleCancelReminder = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useTopicsQuery: (...args: unknown[]) => mockTopicsQuery(...args),
  useUserProfileQuery: () => ({ data: undefined }),
  entriesQueryKey: (dateKey: string) => ["entries", dateKey],
  topicsQueryKey: ["topics"],
  useEntryAttachmentsQuery: () => ({ data: undefined, isLoading: false }),
  attachmentsQueryKey: (entryId: string) => ["attachments", entryId],
}));

const mockSummarizeEntryAndInvalidate = vi.fn();
const mockCreateReminderAndInvalidate = vi.fn();
const mockUpdateReminderAndInvalidate = vi.fn();

vi.mock("@/shared/api/mutations", () => ({
  updateEntryAndInvalidate: (...args: unknown[]) =>
    mockUpdateEntryAndInvalidate(...args),
  deleteEntryAndInvalidate: (...args: unknown[]) =>
    mockDeleteEntryAndInvalidate(...args),
  summarizeEntryAndInvalidate: (...args: unknown[]) =>
    mockSummarizeEntryAndInvalidate(...args),
  createReminderAndInvalidate: (...args: unknown[]) =>
    mockCreateReminderAndInvalidate(...args),
  updateReminderAndInvalidate: (...args: unknown[]) =>
    mockUpdateReminderAndInvalidate(...args),
}));

vi.mock("@/shared/api/sdk/entries", () => ({
  autoTopicEntry: vi.fn().mockResolvedValue({
    entryId: "entry-test",
    selectedTopicId: null,
    score: null,
  }),
}));

vi.mock("@/shared/api/sdk/attachments", () => ({
  initUpload: (...args: unknown[]) => mockInitUpload(...args),
  completeUpload: (...args: unknown[]) => mockCompleteUpload(...args),
  getDownloadUrl: (...args: unknown[]) => mockGetDownloadUrl(...args),
  listByEntry: (...args: unknown[]) => mockListByEntry(...args),
  deleteAttachment: (...args: unknown[]) => mockDeleteAttachment(...args),
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

vi.mock("../hooks/useSummaryActions", () => ({
  useSummaryActions: (...args: unknown[]) => mockUseSummaryActions(...args),
}));

vi.mock("../hooks/useReminderActions", () => ({
  useReminderActions: (...args: unknown[]) => mockUseReminderActions(...args),
}));

// ============================================================================
// Helpers
// ============================================================================
function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderEditor(entryOverrides: Partial<ApiEntry> = {}) {
  const qc = createQueryClient();
  const entry = createMockEntry(entryOverrides);
  return render(
    <QueryClientProvider client={qc}>
      <TaskEditor entry={entry} />
    </QueryClientProvider>,
  );
}

function renderEditorWithClient(
  qc: QueryClient,
  entryOverrides: Partial<ApiEntry> = {},
) {
  const entry = createMockEntry(entryOverrides);
  return render(
    <QueryClientProvider client={qc}>
      <TaskEditor entry={entry} />
    </QueryClientProvider>,
  );
}

// ============================================================================
// Tests
// ============================================================================
describe("TaskEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTopicsQuery.mockReturnValue({ data: mockTopics, isPending: false });
    mockUpdateEntryAndInvalidate.mockResolvedValue(
      createMockEntry({ version: 2 }),
    );
    mockDeleteEntryAndInvalidate.mockResolvedValue(undefined);
    mockUseSummaryActions.mockReturnValue({
      isSummarizing: false,
      summarizeError: null,
      setSummarizeError: mockSetSummarizeError,
      handleSummarize: mockHandleSummarize,
      handleClearSummary: mockHandleClearSummary,
    });
    mockUseReminderActions.mockReturnValue({
      isReminderDialogOpen: false,
      setIsReminderDialogOpen: mockSetIsReminderDialogOpen,
      activeReminderId: null,
      isReminderSaving: false,
      handleCreateReminder: mockHandleCreateReminder,
      handleRescheduleReminder: mockHandleRescheduleReminder,
      handleCancelReminder: mockHandleCancelReminder,
    });
  });

  const expandEditor = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("textbox", { name: /title/i }));
  };

  describe("Rendering", () => {
    it("should render the component", () => {
      renderEditor();
      expect(screen.getByLabelText(/task editor/i)).toBeInTheDocument();
    });

    it("should render title input field", () => {
      renderEditor();
      expect(
        screen.getByRole("textbox", { name: /title/i }),
      ).toBeInTheDocument();
    });

    it("should render content area (Tiptap editor)", () => {
      renderEditor();
      expect(screen.getByLabelText(/rich text editor/i)).toBeInTheDocument();
    });

    it("should render topic selector", () => {
      renderEditor();
      expect(
        screen.getByRole("button", { name: /topic/i }),
      ).toBeInTheDocument();
    });

    it("should initialize title from entry prop", () => {
      renderEditor({ title: "My Custom Title" });
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue(
        "My Custom Title",
      );
    });
  });

  describe("Bottom Left Buttons", () => {
    it("should render content button when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(
        screen.getByRole("button", { name: /add content/i }),
      ).toBeInTheDocument();
    });

    it("should render format button when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(
        screen.getByRole("button", { name: /format/i }),
      ).toBeInTheDocument();
    });

    it("should open content dropdown when content button is clicked", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("should show image option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(
        screen.getByRole("menuitem", { name: /image/i }),
      ).toBeInTheDocument();
    });

    it("should show code snippet option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(
        screen.getByRole("menuitem", { name: /code/i }),
      ).toBeInTheDocument();
    });

    it("should show YouTube video option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(
        screen.getByRole("menuitem", { name: /youtube|video/i }),
      ).toBeInTheDocument();
    });

    it("should show file attachment option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(
        screen.getByRole("menuitem", { name: /file|attach/i }),
      ).toBeInTheDocument();
    });

    it("should show bullet list option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(
        screen.getByRole("menuitem", { name: /bullet list/i }),
      ).toBeInTheDocument();
    });

    it("should show numbered list option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(
        screen.getByRole("menuitem", { name: /numbered list/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Top Right Buttons", () => {
    it("should render reminder button", () => {
      renderEditor();
      expect(
        screen.getByRole("button", { name: /reminder/i }),
      ).toBeInTheDocument();
    });

    it("should render summarize button", () => {
      renderEditor();
      expect(
        screen.getByRole("button", { name: /summarize/i }),
      ).toBeInTheDocument();
    });

    it("should open reminder dialog when reminder button is clicked", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(
        screen.getByRole("button", { name: /schedule reminder/i }),
      );
      expect(mockSetIsReminderDialogOpen).toHaveBeenCalledWith(true);
    });

    it("should disable summarize button when summary is in progress", async () => {
      const user = userEvent.setup();
      mockUseSummaryActions.mockReturnValue({
        isSummarizing: true,
        summarizeError: null,
        setSummarizeError: mockSetSummarizeError,
        handleSummarize: mockHandleSummarize,
        handleClearSummary: mockHandleClearSummary,
      });

      renderEditor();
      const summarizeBtn = screen.getByRole("button", {
        name: /summary in progress/i,
      });
      expect(summarizeBtn).toBeDisabled();

      await user.click(summarizeBtn);
      expect(mockHandleSummarize).not.toHaveBeenCalled();
    });
  });

  describe("Delete Button", () => {
    it("should render delete button when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(
        screen.getByRole("button", { name: /delete/i }),
      ).toBeInTheDocument();
    });

    it("should call deleteEntryAndInvalidate when delete is confirmed", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      // Click the delete button (aria-label "Delete") to open confirm dialog
      await user.click(screen.getByTitle("Delete entry"));

      // Wait for the confirm dialog to appear and click the confirm button.
      // The ConfirmDialog renders a second "Delete" button with confirmText="Delete".
      await waitFor(() => {
        const allDeleteBtns = screen.getAllByRole("button", {
          name: /delete/i,
        });
        // At least 2: the original "Delete entry" button and the dialog "Delete" confirm
        expect(allDeleteBtns.length).toBeGreaterThanOrEqual(2);
      });

      // The last "Delete" button is the confirm button in the dialog
      const allDeleteBtns = screen.getAllByRole("button", { name: /delete/i });
      const dialogConfirm = allDeleteBtns[allDeleteBtns.length - 1];
      await user.click(dialogConfirm);

      await waitFor(() => {
        expect(mockDeleteEntryAndInvalidate).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Title Input", () => {
    it("should allow typing in title field", async () => {
      const user = userEvent.setup();
      renderEditor({ title: "" });

      const titleInput = screen.getByRole("textbox", { name: /title/i });
      await user.type(titleInput, "My Task Title");

      expect(titleInput).toHaveValue("My Task Title");
    });

    it("should have placeholder text", () => {
      renderEditor({ title: "" });
      const titleInput = screen.getByRole("textbox", { name: /title/i });
      expect(titleInput).toHaveAttribute("placeholder");
    });
  });

  describe("Content Area (Tiptap)", () => {
    it("should render Tiptap editor as the content area", () => {
      renderEditor();
      const tiptapEditor = screen.getByLabelText(/rich text editor/i);
      expect(tiptapEditor).toBeInTheDocument();
      expect(tiptapEditor).toHaveClass("tiptap-editor");
    });

    it("should render content from entry JSON", async () => {
      renderEditor({
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing content" }],
            },
          ],
        },
      });

      await waitFor(() => {
        expect(screen.getByText("Existing content")).toBeInTheDocument();
      });
    });
  });

  describe("Topic Selector", () => {
    it("should display available topics when clicked", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("should allow selecting a topic", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));

      const trabajoOption = screen.getByRole("menuitemradio", {
        name: /trabajo/i,
      });
      await user.click(trabajoOption);

      const topicButton = screen.getByRole("button", { name: /topic/i });
      expect(topicButton).toHaveTextContent(/trabajo/i);
    });

    it("should have auto option as first choice", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));

      const options = screen.getAllByRole("menuitemradio");
      expect(options[0]).toHaveTextContent(/auto/i);
    });

    it("should show empty state when there are no topics", async () => {
      const user = userEvent.setup();
      mockTopicsQuery.mockReturnValue({ data: [], isPending: false });
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));
      expect(
        screen.getByText(/no topics yet\. create one in topics section\./i),
      ).toBeInTheDocument();
    });

    it("should close topic menu after selecting a topic option", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));
      expect(
        screen.getByRole("menu", { name: /select topic/i }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("menuitemradio", { name: /salud/i }));
      await waitFor(() => {
        expect(
          screen.queryByRole("menu", { name: /select topic/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("should allow selecting Auto topic option explicitly", async () => {
      const user = userEvent.setup();
      renderEditor({ title: "Has title" });

      await user.click(screen.getByRole("button", { name: /topic/i }));
      await user.click(screen.getByRole("menuitemradio", { name: /auto/i }));

      const topicButton = screen.getByRole("button", { name: /topic/i });
      expect(topicButton).toHaveTextContent(/auto/i);
    });
  });

  describe("Auto-save", () => {
    it("should show auto-save indicator when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(screen.getByLabelText(/auto-save indicator/i)).toBeInTheDocument();
    });

    it("should not have a manual save button (auto-save only)", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(
        screen.queryByRole("button", { name: /^save$/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Expand/Collapse Behavior", () => {
    it("should expand when clicking inside the editor", async () => {
      const user = userEvent.setup();
      renderEditor();

      expect(
        screen.queryByRole("button", { name: /delete/i }),
      ).not.toBeInTheDocument();

      await expandEditor(user);

      expect(
        screen.getByRole("button", { name: /delete/i }),
      ).toBeInTheDocument();
    });

    it("should show bottom toolbar when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(
        screen.getByRole("button", { name: /add content/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /format/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Entry Type Toggle", () => {
    it("should show task type by default for task entries", () => {
      renderEditor({ type: "task" });
      expect(
        screen.getByRole("button", { name: /switch to note/i }),
      ).toBeInTheDocument();
    });

    it("should show note type for note entries", () => {
      renderEditor({ type: "note" });
      expect(
        screen.getByRole("button", { name: /switch to task/i }),
      ).toBeInTheDocument();
    });

    it("should show complete button only for tasks", () => {
      renderEditor({ type: "task" });
      expect(
        screen.getByRole("button", { name: /mark as/i }),
      ).toBeInTheDocument();
    });

    it("should not show complete button for notes", () => {
      renderEditor({ type: "note" });
      expect(
        screen.queryByRole("button", { name: /mark as/i }),
      ).not.toBeInTheDocument();
    });

    it("should toggle task to note when clicking switch button", async () => {
      const user = userEvent.setup();
      renderEditor({ type: "task" });

      await user.click(screen.getByRole("button", { name: /switch to note/i }));

      expect(
        screen.getByRole("button", { name: /switch to task/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /mark as/i }),
      ).not.toBeInTheDocument();
    });

    it("should toggle note to task when clicking switch button", async () => {
      const user = userEvent.setup();
      renderEditor({ type: "note" });

      await user.click(screen.getByRole("button", { name: /switch to task/i }));

      expect(
        screen.getByRole("button", { name: /switch to note/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /mark as/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Task Completion", () => {
    it("should toggle completion button label", async () => {
      const user = userEvent.setup();
      renderEditor({ type: "task", completed: false });

      const completeBtn = screen.getByRole("button", {
        name: /mark as complete/i,
      });
      await user.click(completeBtn);

      expect(
        screen.getByRole("button", { name: /mark as incomplete/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Content Menu Actions", () => {
    it("should open YouTube dialog from content menu action", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      await user.click(
        screen.getByRole("menuitem", { name: /youtube|video/i }),
      );

      expect(
        screen.getByRole("dialog", { name: /embed youtube video/i }),
      ).toBeInTheDocument();
    });

    it("should trigger hidden file input click from attach file action", async () => {
      const user = userEvent.setup();
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

      renderEditor();
      await expandEditor(user);
      await user.click(screen.getByRole("button", { name: /add content/i }));
      await user.click(screen.getByRole("menuitem", { name: /file|attach/i }));

      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it("should attach file via hidden input upload flow", async () => {
      const user = userEvent.setup();
      const putFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", putFetch);

      mockInitUpload.mockResolvedValue({
        attachment: { id: "att-123" },
        presignedPutUrl: "https://s3.example.com/upload",
      });
      mockCompleteUpload.mockResolvedValue(undefined);

      const { container } = renderEditor();
      await expandEditor(user);

      const hiddenInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement | null;
      expect(hiddenInput).not.toBeNull();

      const file = new File(["hello"], "notes.txt", { type: "text/plain" });
      await user.upload(hiddenInput as HTMLInputElement, file);

      await waitFor(() => {
        expect(mockInitUpload).toHaveBeenCalledTimes(1);
        expect(putFetch).toHaveBeenCalledTimes(1);
        expect(mockCompleteUpload).toHaveBeenCalledWith("att-123");
      });

      vi.unstubAllGlobals();
    });

    it("should not complete upload when presigned PUT fails", async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const putFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal("fetch", putFetch);

      mockInitUpload.mockResolvedValue({
        attachment: { id: "att-error" },
        presignedPutUrl: "https://s3.example.com/upload-error",
      });

      const { container } = renderEditor();
      await expandEditor(user);

      const hiddenInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement | null;
      expect(hiddenInput).not.toBeNull();

      const file = new File(["boom"], "broken.txt", { type: "text/plain" });
      await user.upload(hiddenInput as HTMLInputElement, file);

      await waitFor(() => {
        expect(mockInitUpload).toHaveBeenCalledTimes(1);
        expect(putFetch).toHaveBeenCalledTimes(1);
      });
      expect(mockCompleteUpload).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      vi.unstubAllGlobals();
      consoleErrorSpy.mockRestore();
    });

    it("should close youtube dialog when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      await user.click(
        screen.getByRole("menuitem", { name: /youtube|video/i }),
      );
      expect(
        screen.getByRole("dialog", { name: /embed youtube video/i }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^cancel$/i }));
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: /embed youtube video/i }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper labels for title and topic", () => {
      renderEditor();

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/rich text editor/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /topic/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Format and Summary UI", () => {
    it("should open format menu and close it", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      const formatBtn = screen.getByRole("button", { name: /text format/i });
      await user.click(formatBtn);
      expect(
        screen.getByRole("toolbar", { name: /text formatting/i }),
      ).toBeInTheDocument();

      await user.click(formatBtn);
      await waitFor(() => {
        expect(
          screen.queryByRole("toolbar", { name: /text formatting/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("should dismiss summarize error when clicking dismiss button", async () => {
      const user = userEvent.setup();
      mockUseSummaryActions.mockReturnValue({
        isSummarizing: false,
        summarizeError: "Summary failed",
        setSummarizeError: mockSetSummarizeError,
        handleSummarize: mockHandleSummarize,
        handleClearSummary: mockHandleClearSummary,
      });

      renderEditor();
      await user.click(screen.getByRole("button", { name: /dismiss/i }));

      expect(mockSetSummarizeError).toHaveBeenCalledWith(null);
    });

    it("should remove existing summary when remove button is clicked", async () => {
      const user = userEvent.setup();
      renderEditor({ summary: "AI generated summary" });

      await user.click(screen.getByRole("button", { name: /remove summary/i }));
      expect(mockHandleClearSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe("Reminder Dialog", () => {
    it("should schedule reminder from dialog", async () => {
      const user = userEvent.setup();
      mockUseReminderActions.mockReturnValue({
        isReminderDialogOpen: true,
        setIsReminderDialogOpen: mockSetIsReminderDialogOpen,
        activeReminderId: null,
        isReminderSaving: false,
        handleCreateReminder: mockHandleCreateReminder,
        handleRescheduleReminder: mockHandleRescheduleReminder,
        handleCancelReminder: mockHandleCancelReminder,
      });

      renderEditor();
      await user.click(screen.getByRole("button", { name: /^schedule$/i }));

      expect(mockHandleCreateReminder).toHaveBeenCalledTimes(1);
    });

    it("should reschedule and cancel when active reminder exists", async () => {
      const user = userEvent.setup();
      mockUseReminderActions.mockReturnValue({
        isReminderDialogOpen: true,
        setIsReminderDialogOpen: mockSetIsReminderDialogOpen,
        activeReminderId: "rem-1",
        isReminderSaving: false,
        handleCreateReminder: mockHandleCreateReminder,
        handleRescheduleReminder: mockHandleRescheduleReminder,
        handleCancelReminder: mockHandleCancelReminder,
      });

      renderEditor();
      await user.click(screen.getByRole("button", { name: /reschedule/i }));
      await user.click(screen.getByTitle(/cancel reminder/i));

      expect(mockHandleRescheduleReminder).toHaveBeenCalledTimes(1);
      expect(mockHandleCancelReminder).toHaveBeenCalledTimes(1);
    });

    it("should close reminder dialog via close button and backdrop", async () => {
      const user = userEvent.setup();
      mockUseReminderActions.mockReturnValue({
        isReminderDialogOpen: true,
        setIsReminderDialogOpen: mockSetIsReminderDialogOpen,
        activeReminderId: null,
        isReminderSaving: false,
        handleCreateReminder: mockHandleCreateReminder,
        handleRescheduleReminder: mockHandleRescheduleReminder,
        handleCancelReminder: mockHandleCancelReminder,
      });

      renderEditor();

      await user.click(screen.getByRole("button", { name: /^close$/i }));
      await user.click(screen.getByLabelText(/close reminder dialog/i));

      expect(mockSetIsReminderDialogOpen).toHaveBeenCalledWith(false);
    });
  });

  describe("Delete Error Handling", () => {
    it("should close editor on delete 404 response", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const qc = createQueryClient();

      mockDeleteEntryAndInvalidate.mockRejectedValue(
        new ApiError("Not found", 404, "NOT_FOUND"),
      );

      render(
        <QueryClientProvider client={qc}>
          <TaskEditor entry={createMockEntry()} onClose={onClose} />
        </QueryClientProvider>,
      );

      await expandEditor(user);
      await user.click(screen.getByTitle("Delete entry"));

      await waitFor(() => {
        const allDeleteBtns = screen.getAllByRole("button", {
          name: /delete/i,
        });
        expect(allDeleteBtns.length).toBeGreaterThanOrEqual(2);
      });

      const allDeleteBtns = screen.getAllByRole("button", { name: /delete/i });
      await user.click(allDeleteBtns[allDeleteBtns.length - 1]);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it("should log delete errors for non-404 failures", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const qc = createQueryClient();
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockDeleteEntryAndInvalidate.mockRejectedValue(new Error("boom"));

      render(
        <QueryClientProvider client={qc}>
          <TaskEditor entry={createMockEntry()} onClose={onClose} />
        </QueryClientProvider>,
      );

      await expandEditor(user);
      await user.click(screen.getByTitle("Delete entry"));
      await waitFor(() => {
        const allDeleteBtns = screen.getAllByRole("button", {
          name: /delete/i,
        });
        expect(allDeleteBtns.length).toBeGreaterThanOrEqual(2);
      });
      const allDeleteBtns = screen.getAllByRole("button", { name: /delete/i });
      await user.click(allDeleteBtns[allDeleteBtns.length - 1]);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "[TaskEditor] delete failed:",
          expect.any(Error),
        );
      });
      expect(onClose).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should close delete confirmation when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByTitle("Delete entry"));
      expect(
        screen.getByRole("button", { name: /^cancel$/i }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /^cancel$/i }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Optimistic cache updates", () => {
    it("should update cached title immediately when typing", async () => {
      const user = userEvent.setup();
      const qc = createQueryClient();
      qc.setQueryData(["entries", "2024-01-15"], [createMockEntry()]);

      renderEditorWithClient(qc);
      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, "Renamed from optimistic test");

      const cached = qc.getQueryData<ApiEntry[]>(["entries", "2024-01-15"]);
      expect(cached?.[0]?.title).toBe("Renamed from optimistic test");
    });

    it("should update cached topic immediately on topic selection", async () => {
      const user = userEvent.setup();
      const qc = createQueryClient();
      qc.setQueryData(["entries", "2024-01-15"], [createMockEntry()]);

      renderEditorWithClient(qc);
      await expandEditor(user);
      await user.click(screen.getByRole("button", { name: /topic/i }));
      await user.click(screen.getByRole("menuitemradio", { name: "Trabajo" }));

      const cached = qc.getQueryData<ApiEntry[]>(["entries", "2024-01-15"]);
      expect(cached?.[0]?.topicId).toBe("topic-work");
    });

    it("should update cached entry type immediately on toggle", async () => {
      const user = userEvent.setup();
      const qc = createQueryClient();
      qc.setQueryData(["entries", "2024-01-15"], [createMockEntry()]);

      renderEditorWithClient(qc, { type: "task" });
      await user.click(screen.getByRole("button", { name: /switch to note/i }));

      const cached = qc.getQueryData<ApiEntry[]>(["entries", "2024-01-15"]);
      expect(cached?.[0]?.type).toBe("note");
    });

    it("should update cached completion immediately on toggle complete", async () => {
      const user = userEvent.setup();
      const qc = createQueryClient();
      qc.setQueryData(
        ["entries", "2024-01-15"],
        [createMockEntry({ completed: false })],
      );

      renderEditorWithClient(qc, { type: "task", completed: false });
      await user.click(
        screen.getByRole("button", { name: /mark as complete/i }),
      );

      const cached = qc.getQueryData<ApiEntry[]>(["entries", "2024-01-15"]);
      expect(cached?.[0]?.completed).toBe(true);
    });

    it("should flush pending autosave when clicking outside editor", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, "Trigger flush outside click");

      fireEvent.mouseDown(document.body);
      await waitFor(() => {
        expect(mockUpdateEntryAndInvalidate).toHaveBeenCalled();
      });
    });
  });
});
