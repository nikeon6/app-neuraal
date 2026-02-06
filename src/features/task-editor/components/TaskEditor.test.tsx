import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskEditor } from "./TaskEditor";
import type { ApiEntry } from "@/shared/api/sdk";

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

vi.mock("@/shared/api/queries", () => ({
  useTopicsQuery: (...args: unknown[]) => mockTopicsQuery(...args),
  entriesQueryKey: (dateKey: string) => ["entries", dateKey],
  topicsQueryKey: ["topics"],
}));

const mockSummarizeEntryAndInvalidate = vi.fn();
const mockCreateReminderAndInvalidate = vi.fn();
const mockUpdateReminderAndInvalidate = vi.fn();

vi.mock("@/shared/api/mutations", () => ({
  updateEntryAndInvalidate: (...args: unknown[]) => mockUpdateEntryAndInvalidate(...args),
  deleteEntryAndInvalidate: (...args: unknown[]) => mockDeleteEntryAndInvalidate(...args),
  summarizeEntryAndInvalidate: (...args: unknown[]) => mockSummarizeEntryAndInvalidate(...args),
  createReminderAndInvalidate: (...args: unknown[]) => mockCreateReminderAndInvalidate(...args),
  updateReminderAndInvalidate: (...args: unknown[]) => mockUpdateReminderAndInvalidate(...args),
}));

vi.mock("@/shared/api/sdk/entries", () => ({
  autoTopicEntry: vi.fn().mockResolvedValue({ entryId: "entry-test", selectedTopicId: null, score: null }),
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
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================
describe("TaskEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTopicsQuery.mockReturnValue({ data: mockTopics, isPending: false });
    mockUpdateEntryAndInvalidate.mockResolvedValue(createMockEntry({ version: 2 }));
    mockDeleteEntryAndInvalidate.mockResolvedValue(undefined);
  });

  const expandEditor = async (user: ReturnType<typeof userEvent.setup>) => {
    const editor = screen.getByTestId("task-editor");
    await user.click(editor);
  };

  describe("Rendering", () => {
    it("should render the component", () => {
      renderEditor();
      expect(screen.getByTestId("task-editor")).toBeInTheDocument();
    });

    it("should render title input field", () => {
      renderEditor();
      expect(screen.getByRole("textbox", { name: /title/i })).toBeInTheDocument();
    });

    it("should render content area", () => {
      renderEditor();
      expect(screen.getByRole("textbox", { name: /content/i })).toBeInTheDocument();
    });

    it("should render topic selector", () => {
      renderEditor();
      expect(screen.getByRole("button", { name: /topic/i })).toBeInTheDocument();
    });

    it("should initialize title from entry prop", () => {
      renderEditor({ title: "My Custom Title" });
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("My Custom Title");
    });
  });

  describe("Bottom Left Buttons", () => {
    it("should render content button when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(screen.getByRole("button", { name: /add content/i })).toBeInTheDocument();
    });

    it("should render format button when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(screen.getByRole("button", { name: /format/i })).toBeInTheDocument();
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
      expect(screen.getByRole("menuitem", { name: /image/i })).toBeInTheDocument();
    });

    it("should show code snippet option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(screen.getByRole("menuitem", { name: /code/i })).toBeInTheDocument();
    });

    it("should show YouTube video option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(screen.getByRole("menuitem", { name: /youtube|video/i })).toBeInTheDocument();
    });

    it("should show file attachment option in content dropdown", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      await user.click(screen.getByRole("button", { name: /add content/i }));
      expect(screen.getByRole("menuitem", { name: /file|attach/i })).toBeInTheDocument();
    });
  });

  describe("Top Right Buttons", () => {
    it("should render reminder button", () => {
      renderEditor();
      expect(screen.getByRole("button", { name: /reminder/i })).toBeInTheDocument();
    });

    it("should render summarize button", () => {
      renderEditor();
      expect(screen.getByRole("button", { name: /summarize/i })).toBeInTheDocument();
    });
  });

  describe("Delete Button", () => {
    it("should render delete button when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
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
        const allDeleteBtns = screen.getAllByRole("button", { name: /delete/i });
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

  describe("Content Area", () => {
    it("should allow typing in content area", async () => {
      const user = userEvent.setup();
      renderEditor();

      const contentArea = screen.getByRole("textbox", { name: /content/i });
      await user.type(contentArea, "My task content here");

      expect(contentArea).toHaveValue("My task content here");
    });

    it("should be a textarea element", () => {
      renderEditor();
      const contentArea = screen.getByRole("textbox", { name: /content/i });
      expect(contentArea.tagName.toLowerCase()).toBe("textarea");
    });
  });

  describe("Topic Selector", () => {
    it("should display available topics when clicked", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("should allow selecting a topic", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));

      const trabajoOption = screen.getByRole("option", { name: /trabajo/i });
      await user.click(trabajoOption);

      const topicButton = screen.getByRole("button", { name: /topic/i });
      expect(topicButton).toHaveTextContent(/trabajo/i);
    });

    it("should have auto option as first choice", async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole("button", { name: /topic/i }));

      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveTextContent(/auto/i);
    });
  });

  describe("Auto-save", () => {
    it("should show auto-save indicator when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(screen.getByTestId("auto-save-indicator")).toBeInTheDocument();
    });

    it("should not have a manual save button (auto-save only)", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    });
  });

  describe("Expand/Collapse Behavior", () => {
    it("should expand when clicking inside the editor", async () => {
      const user = userEvent.setup();
      renderEditor();

      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();

      await expandEditor(user);

      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("should show bottom toolbar when expanded", async () => {
      const user = userEvent.setup();
      renderEditor();
      await expandEditor(user);

      expect(screen.getByRole("button", { name: /add content/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /format/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe("Entry Type Toggle", () => {
    it("should show task type by default for task entries", () => {
      renderEditor({ type: "task" });
      expect(screen.getByRole("button", { name: /switch to note/i })).toBeInTheDocument();
    });

    it("should show note type for note entries", () => {
      renderEditor({ type: "note" });
      expect(screen.getByRole("button", { name: /switch to task/i })).toBeInTheDocument();
    });

    it("should show complete button only for tasks", () => {
      renderEditor({ type: "task" });
      expect(screen.getByRole("button", { name: /mark as/i })).toBeInTheDocument();
    });

    it("should not show complete button for notes", () => {
      renderEditor({ type: "note" });
      expect(screen.queryByRole("button", { name: /mark as/i })).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper labels for all inputs", () => {
      renderEditor();

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /content/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /topic/i })).toBeInTheDocument();
    });
  });
});
