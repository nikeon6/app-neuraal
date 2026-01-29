import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TasksContainer } from "./TasksContainer";
import type { LegacyTask, TopicId } from "@/shared/types";
import { DEFAULT_USER_ID } from "@/shared/store";

// ============================================================================
// Mock Data
// ============================================================================
const createMockTask = (
  id: string,
  topicId: TopicId,
  title: string,
  completed: boolean = false
): LegacyTask => ({
  id,
  title,
  topicId,
  completed,
  userId: DEFAULT_USER_ID,
});

// Tasks for day 15 (selected day)
const mockTasksForDay15: LegacyTask[] = [
  createMockTask("task-1", "work", "Complete project report"),
  createMockTask("task-2", "health", "Morning yoga session"),
  createMockTask("task-3", "learning", "Study TypeScript patterns"),
];

// Tasks for day 16 (different day)
const mockTasksForDay16: LegacyTask[] = [
  createMockTask("task-4", "work", "Team meeting"),
  createMockTask("task-5", "fun", "Watch movie"),
];

const mockTasksByDay: Record<number, LegacyTask[]> = {
  15: mockTasksForDay15,
  16: mockTasksForDay16,
};

// Empty tasks (for testing empty state)
const emptyTasksByDay: Record<number, LegacyTask[]> = {};

// ============================================================================
// Mock Store
// ============================================================================
const mockAddTask = vi.fn();
const mockRemoveTask = vi.fn();
const mockReorderTasks = vi.fn();

const createMockState = (overrides = {}) => ({
  selectedDay: 15,
  selectedDate: new Date("2024-01-15"),
  tasksByDay: mockTasksByDay,
  addTask: mockAddTask,
  removeTask: mockRemoveTask,
  reorderTasks: mockReorderTasks,
  ...overrides,
});

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector) => {
    const state = createMockState();
    return typeof selector === "function" ? selector(state) : state;
  }),
  DEFAULT_USER_ID: "user_demo",
}));

// Import for resetting mock
import * as storeModule from "@/shared/store";

// ============================================================================
// Tests
// ============================================================================
describe("TasksContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset store mock to default state
    vi.mocked(storeModule.useStore).mockImplementation((selector) => {
      const state = createMockState();
      return typeof selector === "function" ? selector(state) : state;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("should render the container", () => {
      render(<TasksContainer />);
      expect(screen.getByTestId("tasks-container")).toBeInTheDocument();
    });

    it("should render TaskEditors for the selected day tasks", () => {
      render(<TasksContainer />);
      
      // Should render 3 TaskEditor wrappers for day 15
      const taskEditorWrappers = screen.getAllByTestId(/^task-editor-wrapper-/);
      expect(taskEditorWrappers).toHaveLength(3);
    });

    it("should NOT render tasks from other days", () => {
      render(<TasksContainer />);
      
      // Tasks from day 16 should NOT have wrappers
      expect(screen.queryByTestId("task-editor-wrapper-task-4")).not.toBeInTheDocument();
      expect(screen.queryByTestId("task-editor-wrapper-task-5")).not.toBeInTheDocument();
    });

    it("should render one TaskEditor per task", () => {
      render(<TasksContainer />);
      
      // Each task should have its own editor wrapper
      expect(screen.getByTestId("task-editor-wrapper-task-1")).toBeInTheDocument();
      expect(screen.getByTestId("task-editor-wrapper-task-2")).toBeInTheDocument();
      expect(screen.getByTestId("task-editor-wrapper-task-3")).toBeInTheDocument();
    });

    it("should render empty state when no tasks for selected day", () => {
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ tasksByDay: emptyTasksByDay });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TasksContainer />);
      
      expect(screen.getByTestId("tasks-empty-state")).toBeInTheDocument();
      expect(screen.getByText(/no hay tareas|no tasks/i)).toBeInTheDocument();
    });

    it("should render add task button", () => {
      render(<TasksContainer />);
      
      const addButton = screen.getByTestId("add-task-button");
      expect(addButton).toBeInTheDocument();
    });

    it("should render add button below the TaskEditors", () => {
      render(<TasksContainer />);
      
      const container = screen.getByTestId("tasks-container");
      const addButton = within(container).getByTestId("add-task-button");
      
      // Add button should be in the container
      expect(addButton).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Scrolling
  // --------------------------------------------------------------------------
  describe("Scrolling", () => {
    it("should have scrollable container", () => {
      render(<TasksContainer />);
      
      const scrollContainer = screen.getByTestId("tasks-scroll-container");
      expect(scrollContainer).toBeInTheDocument();
      
      // Should have overflow-y-auto class (Tailwind)
      expect(scrollContainer).toHaveClass("overflow-y-auto");
    });

    it("should have single column layout", () => {
      render(<TasksContainer />);
      
      const container = screen.getByTestId("tasks-container");
      // Container should use flex column
      expect(container).toHaveClass("flex-col");
    });
  });

  // --------------------------------------------------------------------------
  // Add Task Button
  // --------------------------------------------------------------------------
  describe("Add Task Button", () => {
    it("should have plus icon in add button", () => {
      render(<TasksContainer />);
      
      const addButton = screen.getByTestId("add-task-button");
      // Button should contain a Plus icon (SVG)
      const svg = addButton.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should call addTask when add button is clicked", async () => {
      const user = userEvent.setup();
      render(<TasksContainer />);
      
      const addButton = screen.getByTestId("add-task-button");
      await user.click(addButton);
      
      // Should trigger add task action
      expect(mockAddTask).toHaveBeenCalled();
    });

    it("should add task to the selected day", async () => {
      const user = userEvent.setup();
      render(<TasksContainer />);
      
      const addButton = screen.getByTestId("add-task-button");
      await user.click(addButton);
      
      // First argument should be the selected day (15)
      expect(mockAddTask).toHaveBeenCalledWith(
        15,
        expect.any(String),
        expect.any(String)
      );
    });
  });

  // --------------------------------------------------------------------------
  // Drag and Drop Reordering
  // --------------------------------------------------------------------------
  describe("Drag and Drop", () => {
    it("should have draggable task editor wrappers", () => {
      render(<TasksContainer />);
      
      const wrappers = screen.getAllByTestId(/^task-editor-wrapper-/);
      wrappers.forEach((wrapper) => {
        // Each wrapper should be draggable
        expect(wrapper.getAttribute("draggable")).toBe("true");
      });
    });

    it("should have drag handle on each task", () => {
      render(<TasksContainer />);
      
      const wrappers = screen.getAllByTestId(/^task-editor-wrapper-/);
      wrappers.forEach((wrapper) => {
        const dragHandle = within(wrapper).queryByTestId("drag-handle") ||
                          within(wrapper).queryByLabelText(/drag|mover|reorder/i);
        expect(dragHandle).toBeInTheDocument();
      });
    });

    it("should update visual order during drag", async () => {
      render(<TasksContainer />);
      
      const wrappers = screen.getAllByTestId(/^task-editor-wrapper-/);
      const firstWrapper = wrappers[0];
      
      // Simulate drag start with dataTransfer mock
      const dragStartEvent = new Event("dragstart", { bubbles: true });
      Object.defineProperty(dragStartEvent, "dataTransfer", {
        value: {
          effectAllowed: "",
          setData: vi.fn(),
        },
      });
      
      fireEvent(firstWrapper, dragStartEvent);
      
      // First wrapper should have dragging state
      await waitFor(() => {
        expect(firstWrapper).toHaveAttribute("aria-grabbed", "true");
      });
    });

    it("should call reorderTasks on drop", async () => {
      render(<TasksContainer />);
      
      const wrappers = screen.getAllByTestId(/^task-editor-wrapper-/);
      const firstWrapper = wrappers[0];
      const lastWrapper = wrappers[2];
      
      // Create drag events with dataTransfer mock
      const createDragEvent = (type: string) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: {
            effectAllowed: "",
            dropEffect: "",
            setData: vi.fn(),
            getData: vi.fn(() => "task-1"),
          },
        });
        return event;
      };
      
      // Simulate drag and drop sequence
      fireEvent(firstWrapper, createDragEvent("dragstart"));
      fireEvent(lastWrapper, createDragEvent("dragover"));
      fireEvent(lastWrapper, createDragEvent("drop"));
      fireEvent(firstWrapper, createDragEvent("dragend"));
      
      // Should call reorderTasks with new order
      expect(mockReorderTasks).toHaveBeenCalledWith(
        15, // selected day
        expect.any(Array) // new task order
      );
    });

    it("should only allow vertical reordering", () => {
      render(<TasksContainer />);
      
      const container = screen.getByTestId("tasks-container");
      // Should have flex-col for vertical-only layout
      expect(container).toHaveClass("flex-col");
    });
  });

  // --------------------------------------------------------------------------
  // TaskEditor Integration
  // --------------------------------------------------------------------------
  describe("TaskEditor Integration", () => {
    it("should pass task data to TaskEditor", () => {
      render(<TasksContainer />);
      
      // Each wrapper should exist with correct task id
      const wrapper1 = screen.getByTestId("task-editor-wrapper-task-1");
      const wrapper2 = screen.getByTestId("task-editor-wrapper-task-2");
      const wrapper3 = screen.getByTestId("task-editor-wrapper-task-3");
      
      expect(wrapper1).toBeInTheDocument();
      expect(wrapper2).toBeInTheDocument();
      expect(wrapper3).toBeInTheDocument();
    });

    it("should show completed state for completed tasks", () => {
      // Add a completed task
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({
          tasksByDay: {
            15: [
              createMockTask("task-completed", "work", "Completed task", true),
              ...mockTasksForDay15,
            ],
          },
        });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TasksContainer />);
      
      const completedWrapper = screen.getByTestId("task-editor-wrapper-task-completed");
      // Should have completed data attribute
      expect(completedWrapper).toHaveAttribute("data-completed", "true");
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------
  describe("Accessibility", () => {
    it("should have accessible container role", () => {
      render(<TasksContainer />);
      
      const container = screen.getByTestId("tasks-container");
      expect(container).toHaveAttribute("role", "list");
    });

    it("should have accessible task wrapper roles", () => {
      render(<TasksContainer />);
      
      const wrappers = screen.getAllByTestId(/^task-editor-wrapper-/);
      wrappers.forEach((wrapper) => {
        expect(wrapper).toHaveAttribute("role", "listitem");
      });
    });

    it("should announce drag status to screen readers", () => {
      render(<TasksContainer />);
      
      const firstWrapper = screen.getByTestId("task-editor-wrapper-task-1");
      
      // Should have aria attributes for drag status
      expect(firstWrapper).toHaveAttribute("aria-grabbed");
    });

    it("should be navigable with keyboard", async () => {
      const user = userEvent.setup();
      render(<TasksContainer />);
      
      // Tab through elements
      await user.tab();
      
      // First interactive element should be focused
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  // --------------------------------------------------------------------------
  // Day Change
  // --------------------------------------------------------------------------
  describe("Day Selection Changes", () => {
    it("should update TaskEditors when selected day changes", () => {
      const { rerender } = render(<TasksContainer />);
      
      // Initially showing day 15 tasks
      expect(screen.getByTestId("task-editor-wrapper-task-1")).toBeInTheDocument();
      
      // Change to day 16
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ selectedDay: 16 });
        return typeof selector === "function" ? selector(state) : state;
      });
      
      rerender(<TasksContainer />);
      
      // Should now show day 16 tasks
      expect(screen.getByTestId("task-editor-wrapper-task-4")).toBeInTheDocument();
      expect(screen.queryByTestId("task-editor-wrapper-task-1")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("should handle day with single task", () => {
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({
          tasksByDay: {
            15: [createMockTask("single-task", "work", "Only task")],
          },
        });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TasksContainer />);
      
      expect(screen.getByTestId("task-editor-wrapper-single-task")).toBeInTheDocument();
      expect(screen.getAllByTestId(/^task-editor-wrapper-/)).toHaveLength(1);
    });

    it("should handle many tasks (scrollable)", () => {
      const manyTasks = Array.from({ length: 20 }, (_, i) =>
        createMockTask(`task-${i}`, "work", `Task number ${i + 1}`)
      );

      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({
          tasksByDay: { 15: manyTasks },
        });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TasksContainer />);
      
      const wrappers = screen.getAllByTestId(/^task-editor-wrapper-/);
      expect(wrappers).toHaveLength(20);
      
      // Scroll container should be present
      expect(screen.getByTestId("tasks-scroll-container")).toBeInTheDocument();
    });

    it("should handle tasks with long titles", () => {
      const longTitle = "This is a very long task title that should be handled properly";
      
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({
          tasksByDay: {
            15: [createMockTask("long-task", "work", longTitle)],
          },
        });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TasksContainer />);
      
      expect(screen.getByTestId("task-editor-wrapper-long-task")).toBeInTheDocument();
    });
  });
});
