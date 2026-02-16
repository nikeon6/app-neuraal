import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksContainer } from "./TasksContainer";
import type { ApiEntry } from "@/shared/api/sdk";

// ============================================================================
// Mock Data — ApiEntry shape (matching openapi-types)
// ============================================================================
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

const mockEntries: ApiEntry[] = [
  createMockEntry("entry-1", "Complete project report", {
    topicId: "topic-work",
  }),
  createMockEntry("entry-2", "Morning yoga session", {
    topicId: "topic-health",
  }),
  createMockEntry("entry-3", "Study TypeScript patterns", {
    topicId: "topic-learning",
  }),
];

const mockTopics = [
  { id: "topic-work", userId: "user-123", name: "Work", color: "#3b82f6" },
  { id: "topic-health", userId: "user-123", name: "Health", color: "#22c55e" },
  {
    id: "topic-learning",
    userId: "user-123",
    name: "Learning",
    color: "#f59e0b",
  },
];

// ============================================================================
// Mock modules
// ============================================================================

// --- TanStack Query hooks ---------------------------------------------------
const mockEntriesByDateQuery = vi.fn();
const mockTopicsQuery = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useEntriesByDateQuery: (...args: unknown[]) =>
    mockEntriesByDateQuery(...args),
  useTopicsQuery: (...args: unknown[]) => mockTopicsQuery(...args),
  entriesQueryKey: (dateKey: string) => ["entries", dateKey],
  topicsQueryKey: ["topics"],
}));

// --- Mutations --------------------------------------------------------------
const mockCreateEntryAndInvalidate = vi.fn();

vi.mock("@/shared/api/mutations", () => ({
  createEntryAndInvalidate: (...args: unknown[]) =>
    mockCreateEntryAndInvalidate(...args),
}));

// --- Store (only UI state — dateKey selector) --------------------------------
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
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },
}));

// --- TaskEditor (render minimal stub to keep tests focused) ------------------
vi.mock("@/features/task-editor", () => ({
  TaskEditor: ({ entry }: { entry: ApiEntry }) => (
    <div aria-label="Task editor" data-task-id={entry.id}>
      {entry.title}
    </div>
  ),
}));

// --- Hooks used internally (auto-scroll + ordered IDs) ----------------------
vi.mock("../hooks", () => ({
  useAutoScrollOnDrag: () => ({
    containerRef: { current: null },
    startAutoScroll: vi.fn(),
    stopAutoScroll: vi.fn(),
    updatePointerPosition: vi.fn(),
  }),
  useOrderedTaskIds: ({ tasks }: { tasks: ApiEntry[] }) => ({
    orderedIds: tasks.map((t) => t.id),
    setOrderedIds: vi.fn(),
    commitOrder: vi.fn(),
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = createQueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ============================================================================
// Tests
// ============================================================================
describe("TasksContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: entries for today, topics loaded
    mockEntriesByDateQuery.mockReturnValue({
      data: mockEntries,
      isPending: false,
      isError: false,
    });

    mockTopicsQuery.mockReturnValue({
      data: mockTopics,
      isPending: false,
    });

    mockCreateEntryAndInvalidate.mockResolvedValue(
      createMockEntry("entry-new", "New task"),
    );
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("should render the container", () => {
      renderWithProviders(<TasksContainer />);
      expect(screen.getByLabelText(/tasks container/i)).toBeInTheDocument();
    });

    it("should render one TaskEditorWrapper per entry", () => {
      renderWithProviders(<TasksContainer />);

      const wrappers = screen.getAllByRole("listitem");
      expect(wrappers).toHaveLength(3);
    });

    it("should render the correct entries by ID", () => {
      renderWithProviders(<TasksContainer />);

      expect(
        screen.getByRole("listitem", { name: /task item entry-1/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("listitem", { name: /task item entry-2/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("listitem", { name: /task item entry-3/i }),
      ).toBeInTheDocument();
    });

    it("should render empty state when no entries for the day", () => {
      mockEntriesByDateQuery.mockReturnValue({
        data: [],
        isPending: false,
        isError: false,
      });

      renderWithProviders(<TasksContainer />);

      expect(screen.getByLabelText(/tasks empty state/i)).toBeInTheDocument();
      expect(screen.getByText(/no entries/i)).toBeInTheDocument();
    });

    it("should render loading state when query is pending and no cached data", () => {
      mockEntriesByDateQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
      });

      renderWithProviders(<TasksContainer />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("should render add task button", () => {
      renderWithProviders(<TasksContainer />);

      expect(
        screen.getByRole("button", { name: /add new task/i }),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Scrolling
  // --------------------------------------------------------------------------
  describe("Scrolling", () => {
    it("should have scrollable container", () => {
      renderWithProviders(<TasksContainer />);

      const scrollContainer = screen.getByLabelText(/tasks list/i);
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass("overflow-y-auto");
    });

    it("should have vertical column layout", () => {
      renderWithProviders(<TasksContainer />);

      const container = screen.getByLabelText(/tasks container/i);
      expect(container).toHaveClass("flex-col");
    });
  });

  // --------------------------------------------------------------------------
  // Add Task Button
  // --------------------------------------------------------------------------
  describe("Add Task Button", () => {
    it("should expose an accessible add-task control", () => {
      renderWithProviders(<TasksContainer />);

      expect(
        screen.getByRole("button", { name: /add new task/i }),
      ).toBeInTheDocument();
    });

    it("should call createEntryAndInvalidate when clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TasksContainer />);

      const addButton = screen.getByRole("button", { name: /add new task/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockCreateEntryAndInvalidate).toHaveBeenCalledTimes(1);
      });

      // First arg is queryClient (object), second arg is the entry body
      const callArgs = mockCreateEntryAndInvalidate.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        date: "2024-01-15",
        type: "task",
        title: "New task",
      });
    });

    it("should assign null topicId (Auto mode) when topics exist", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TasksContainer />);

      await user.click(screen.getByRole("button", { name: /add new task/i }));

      await waitFor(() => {
        const callArgs = mockCreateEntryAndInvalidate.mock.calls[0];
        expect(callArgs[1].topicId).toBeNull();
      });
    });

    it("should send null topicId when no topics exist", async () => {
      mockTopicsQuery.mockReturnValue({ data: [], isPending: false });
      const user = userEvent.setup();
      renderWithProviders(<TasksContainer />);

      await user.click(screen.getByRole("button", { name: /add new task/i }));

      await waitFor(() => {
        const callArgs = mockCreateEntryAndInvalidate.mock.calls[0];
        expect(callArgs[1].topicId).toBeNull();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Drag and Drop
  // --------------------------------------------------------------------------
  describe("Drag and Drop", () => {
    it("should have drag handles on each task", () => {
      renderWithProviders(<TasksContainer />);

      const dragHandles = screen.getAllByRole("button", {
        name: /drag to reorder/i,
      });
      expect(dragHandles).toHaveLength(3);
    });

    it("should have drag handles with correct cursor and touch classes", () => {
      renderWithProviders(<TasksContainer />);

      const dragHandles = screen.getAllByRole("button", {
        name: /drag to reorder/i,
      });
      dragHandles.forEach((handle) => {
        expect(handle).toHaveClass("touch-none");
        expect(handle).toHaveClass("cursor-grab");
      });
    });

    it("should have a drag handle inside each wrapper", () => {
      renderWithProviders(<TasksContainer />);

      const wrappers = screen.getAllByRole("listitem");
      wrappers.forEach((wrapper) => {
        const handle = within(wrapper).getByRole("button", {
          name: /drag to reorder/i,
        });
        expect(handle).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // TaskEditor Integration
  // --------------------------------------------------------------------------
  describe("TaskEditor Integration", () => {
    it("should pass entry data to TaskEditor", () => {
      renderWithProviders(<TasksContainer />);

      const editors = screen.getAllByLabelText(/task editor/i);
      expect(editors).toHaveLength(3);

      // Verify entry IDs are passed
      expect(editors[0]).toHaveAttribute("data-task-id", "entry-1");
      expect(editors[1]).toHaveAttribute("data-task-id", "entry-2");
      expect(editors[2]).toHaveAttribute("data-task-id", "entry-3");
    });

    it("should show completed data attribute for completed entries", () => {
      mockEntriesByDateQuery.mockReturnValue({
        data: [
          createMockEntry("entry-done", "Done task", { completed: true }),
          ...mockEntries,
        ],
        isPending: false,
        isError: false,
      });

      renderWithProviders(<TasksContainer />);

      const completedWrapper = screen.getByRole("listitem", {
        name: /task item entry-done/i,
      });
      expect(completedWrapper).toHaveAttribute("data-completed", "true");
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------
  describe("Accessibility", () => {
    it("should have list role on the container", () => {
      renderWithProviders(<TasksContainer />);

      const container = screen.getByLabelText(/tasks container/i);
      expect(container).toHaveAttribute("role", "list");
    });

    it("should have listitem role on each task wrapper", () => {
      renderWithProviders(<TasksContainer />);

      const wrappers = screen.getAllByRole("listitem");
      wrappers.forEach((wrapper) => {
        expect(wrapper).toHaveAttribute("role", "listitem");
      });
    });

    it("should have aria-label on drag handles", () => {
      renderWithProviders(<TasksContainer />);

      const handles = screen.getAllByRole("button", {
        name: /drag to reorder/i,
      });
      handles.forEach((handle) => {
        expect(handle).toHaveAttribute("aria-label", "Drag to reorder");
      });
    });

    it("should have aria-label on the add button", () => {
      renderWithProviders(<TasksContainer />);

      const addBtn = screen.getByRole("button", { name: /add new task/i });
      expect(addBtn).toHaveAttribute("aria-label", "Add new task");
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("should handle a single entry", () => {
      mockEntriesByDateQuery.mockReturnValue({
        data: [createMockEntry("single", "Only entry")],
        isPending: false,
        isError: false,
      });

      renderWithProviders(<TasksContainer />);

      expect(
        screen.getByRole("listitem", { name: /task item single/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    it("should handle many entries", () => {
      const many = Array.from({ length: 20 }, (_, i) =>
        createMockEntry(`e-${i}`, `Task ${i + 1}`),
      );

      mockEntriesByDateQuery.mockReturnValue({
        data: many,
        isPending: false,
        isError: false,
      });

      renderWithProviders(<TasksContainer />);

      expect(screen.getAllByRole("listitem")).toHaveLength(20);
      expect(screen.getByLabelText(/tasks list/i)).toBeInTheDocument();
    });
  });
});
