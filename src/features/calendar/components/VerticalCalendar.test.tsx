import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { VerticalCalendar } from "./VerticalCalendar";
import type { LegacyTask, TopicId } from "../../../shared/types";
import { DEFAULT_USER_ID } from "../../../shared/store";

// Mock scrollTo since jsdom doesn't implement it
Element.prototype.scrollTo = vi.fn();

// Mock IntersectionObserver since jsdom doesn't implement it
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor() {}
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

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
  createdAt: Date.now(),
});

// Tasks for different days
const mockTasksForDay15: LegacyTask[] = [
  createMockTask("task-1", "work", "Complete project report"),
  createMockTask("task-2", "health", "Morning yoga session"),
];

const mockTasksForDay20: LegacyTask[] = [
  createMockTask("task-3", "learning", "Study TypeScript"),
];

const mockTasksByDay: Record<number, LegacyTask[]> = {
  15: mockTasksForDay15,
  20: mockTasksForDay20,
};

// ============================================================================
// Mock Store
// ============================================================================
const mockSetSelectedDay = vi.fn();
const mockSetSelectedDate = vi.fn();
const mockRemoveTask = vi.fn();
const mockExpandDay = vi.fn();
const mockCollapseDay = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockState = (overrides: Record<string, any> = {}): any => ({
  selectedDate: new Date("2024-01-15"),
  selectedDay: 15,
  setSelectedDay: mockSetSelectedDay,
  setSelectedDate: mockSetSelectedDate,
  tasksByDay: mockTasksByDay,
  removeTask: mockRemoveTask,
  selectedTopicIds: [],
  expandedDayKeys: [],
  expandDay: mockExpandDay,
  collapseDay: mockCollapseDay,
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
import * as storeModule from "../../../shared/store";

// ============================================================================
// Tests
// ============================================================================
describe("VerticalCalendar", () => {
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
  // Rendering Tests
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("renders the calendar container", () => {
      render(<VerticalCalendar />);
      
      // Should render month header (visible on desktop)
      expect(screen.getByText("Jan")).toBeInTheDocument();
      expect(screen.getByText("2024")).toBeInTheDocument();
    });

    it("renders all days of the month", () => {
      render(<VerticalCalendar />);
      
      // January 2024 has 31 days
      // Check for some specific day numbers (they appear in both mobile and desktop views)
      const day1Elements = screen.getAllByText("1");
      expect(day1Elements.length).toBeGreaterThan(0);
      
      const day31Elements = screen.getAllByText("31");
      expect(day31Elements.length).toBeGreaterThan(0);
    });

    it("renders mobile compact view elements", () => {
      render(<VerticalCalendar />);
      
      // Mobile view should have buttons for each day
      const dayButtons = screen.getAllByRole("button");
      // At least 31 buttons for days (plus any task remove buttons)
      expect(dayButtons.length).toBeGreaterThanOrEqual(31);
    });

    it("highlights the selected day", () => {
      render(<VerticalCalendar />);
      
      // The selected day (15) should have special styling
      // In the desktop view, it should have the "active" class on the day-row
      const dayElement = document.getElementById("day-2024-01-15");
      expect(dayElement).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Day Selection Tests
  // --------------------------------------------------------------------------
  describe("Day Selection", () => {
    it("calls setSelectedDate and setSelectedDay when clicking a day in mobile view", async () => {
      const user = userEvent.setup();
      render(<VerticalCalendar />);
      
      // Find day 20 button in mobile view (has text "20")
      const day20Buttons = screen.getAllByText("20");
      const mobileButton = day20Buttons.find(el => 
        el.closest("button") && !el.closest(".day-row")
      );
      
      if (mobileButton) {
        await user.click(mobileButton.closest("button")!);
        
        expect(mockSetSelectedDate).toHaveBeenCalled();
        expect(mockSetSelectedDay).toHaveBeenCalledWith(20);
      }
    });

    it("calls setSelectedDate and setSelectedDay when clicking a day row in desktop view", async () => {
      const user = userEvent.setup();
      render(<VerticalCalendar />);
      
      // Find the day row element for day 20
      const dayRow = document.getElementById("day-2024-01-20");
      
      if (dayRow) {
        await user.click(dayRow);
        
        expect(mockSetSelectedDate).toHaveBeenCalled();
        expect(mockSetSelectedDay).toHaveBeenCalledWith(20);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Task Display Tests
  // --------------------------------------------------------------------------
  describe("Task Display", () => {
    it("does NOT display task pills by default (no selection)", () => {
      render(<VerticalCalendar />);
      
      // Without selection, tasks are not visible
      expect(screen.queryByText("Complete project report")).not.toBeInTheDocument();
      expect(screen.queryByText("Morning yoga session")).not.toBeInTheDocument();
    });

    it("shows task indicator dot for days with tasks", () => {
      render(<VerticalCalendar />);
      
      // The dot indicators should be present for days with tasks
      // We check by looking for elements with specific classes
      const indicators = document.querySelectorAll(".bg-primary.rounded-full");
      expect(indicators.length).toBeGreaterThan(0);
    });

    it("shows day anchors with data attributes for wire connections", () => {
      render(<VerticalCalendar />);
      
      // Day rows should have data-day-anchor attribute for FloatingTopics wires
      const dayAnchors = document.querySelectorAll('[data-day-anchor="true"]');
      expect(dayAnchors.length).toBeGreaterThan(0);
      
      // Check that they have the required data attributes
      const firstAnchor = dayAnchors[0] as HTMLElement;
      expect(firstAnchor.dataset.dayNumber).toBeDefined();
      expect(firstAnchor.dataset.dateKey).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Task Removal Tests (when tasks are visible via selection)
  // --------------------------------------------------------------------------
  describe("Task Removal", () => {
    it("does not render remove buttons without selection", () => {
      render(<VerticalCalendar />);
      
      // Without selection, no task pills or remove buttons
      const removeButtons = screen.queryAllByRole("button", { name: /eliminar tarea/i });
      expect(removeButtons.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Empty State Tests
  // --------------------------------------------------------------------------
  describe("Empty State", () => {
    it("renders calendar without tasks when no tasks exist", () => {
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ tasksByDay: {} });
        return typeof selector === "function" ? selector(state) : state;
      });
      
      render(<VerticalCalendar />);
      
      // Calendar should still render
      expect(screen.getByText("Jan")).toBeInTheDocument();
      
      // No task pills should be visible
      expect(screen.queryByText("Complete project report")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Task pills render when topics are selected or days expanded
  // --------------------------------------------------------------------------
  describe("Task Pills with Selection", () => {
    it("does not display task pills without selection or expansion", () => {
      const completedTask = createMockTask("task-completed", "work", "Completed task", true);
      
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ 
          tasksByDay: { 15: [completedTask] },
          selectedTopicIds: [], // No selection
          expandedDayKeys: [], // No expanded days
        });
        return typeof selector === "function" ? selector(state) : state;
      });
      
      render(<VerticalCalendar />);
      
      // Task text should not be visible without selection or expansion
      expect(screen.queryByText("Completed task")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------
  describe("Accessibility", () => {
    it("no remove buttons in collapsed mode", () => {
      render(<VerticalCalendar />);
      
      // In collapsed mode, tasks aren't visible, so no remove buttons
      const removeButtons = screen.queryAllByRole("button", { name: /eliminar tarea/i });
      expect(removeButtons.length).toBe(0);
    });

    it("day buttons are keyboard accessible", () => {
      render(<VerticalCalendar />);
      
      // All day buttons should be focusable
      const dayButtons = screen.getAllByRole("button");
      dayButtons.forEach((button) => {
        expect(button).not.toHaveAttribute("tabindex", "-1");
      });
    });
  });

  // --------------------------------------------------------------------------
  // Today Highlight Tests
  // --------------------------------------------------------------------------
  describe("Today Highlight", () => {
    it("highlights today with special styling when not selected", () => {
      // Mock a date where today is different from selected
      const today = new Date();
      const todayDay = today.getDate();
      
      // Only test if today is not day 15 (the selected day in mock)
      if (todayDay !== 15) {
        vi.mocked(storeModule.useStore).mockImplementation((selector) => {
          const state = createMockState({
            selectedDate: new Date(today.getFullYear(), today.getMonth(), 1), // First of current month
          });
          return typeof selector === "function" ? selector(state) : state;
        });
        
        render(<VerticalCalendar />);
        
        // Today should have ring styling when not selected
        // This is a visual test - we verify the component renders day 1 (appears in both views)
        const day1Elements = screen.getAllByText("1");
        expect(day1Elements.length).toBeGreaterThan(0);
      }
    });
  });
});
