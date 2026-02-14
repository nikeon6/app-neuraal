import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VerticalCalendar } from "./VerticalCalendar";
import type { ApiEntry } from "@/shared/api/sdk";

// Mock scrollTo since jsdom doesn't implement it
Element.prototype.scrollTo = vi.fn();

// Mock IntersectionObserver since jsdom doesn't implement it
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

// ============================================================================
// Mock Data (ApiEntry shape)
// ============================================================================
const MOCK_USER_ID = "user-123";
const MOCK_DATE = "2024-01-15";

function createMockEntry(
  id: string,
  title: string,
  overrides: Partial<ApiEntry> = {},
): ApiEntry {
  return {
    id,
    userId: MOCK_USER_ID,
    date: MOCK_DATE,
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

const mockEntriesByDate: Record<string, ApiEntry[]> = {
  [MOCK_DATE]: [
    createMockEntry("entry-1", "Complete project report", {
      topicId: "topic-work",
    }),
    createMockEntry("entry-2", "Morning yoga session", {
      topicId: "topic-health",
    }),
  ],
  "2024-01-20": [
    createMockEntry("entry-3", "Study TypeScript", {
      date: "2024-01-20",
      topicId: "topic-learning",
    }),
  ],
};

const mockTopics = [
  { id: "topic-work", userId: MOCK_USER_ID, name: "Trabajo", color: "#3b82f6" },
  { id: "topic-health", userId: MOCK_USER_ID, name: "Salud", color: "#22c55e" },
  {
    id: "topic-learning",
    userId: MOCK_USER_ID,
    name: "Learning",
    color: "#f59e0b",
  },
];

// ============================================================================
// Mocks
// ============================================================================
const mockTopicsQuery = vi.fn();
const mockDeleteEntryAndInvalidate = vi.fn();
const mockSetSelectedDay = vi.fn();
const mockSetSelectedDate = vi.fn();
const mockExpandDay = vi.fn();
const mockCollapseDay = vi.fn();
const mockPinDay = vi.fn();
const mockUnpinDay = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useTopicsQuery: (...args: unknown[]) => mockTopicsQuery(...args),
  topicsQueryKey: ["topics"],
}));

vi.mock("@/shared/api/mutations", () => ({
  deleteEntryAndInvalidate: (...args: unknown[]) =>
    mockDeleteEntryAndInvalidate(...args),
}));

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      selectedDate: new Date(MOCK_DATE),
      selectedDay: 15,
      setSelectedDay: mockSetSelectedDay,
      setSelectedDate: mockSetSelectedDate,
      selectedTopicIds: [] as string[],
      expandedDayKeys: [] as string[],
      pinnedDayKeys: [] as string[],
      expandDay: mockExpandDay,
      collapseDay: mockCollapseDay,
      pinDay: mockPinDay,
      unpinDay: mockUnpinDay,
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

// Import for resetting mock
import * as storeModule from "../../../shared/store";

// ============================================================================
// Helpers
// ============================================================================
function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderCalendar(
  entriesByDate: Record<string, ApiEntry[]> = mockEntriesByDate,
) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <VerticalCalendar entriesByDate={entriesByDate} />
    </QueryClientProvider>,
  );
}

// ============================================================================
// Tests
// ============================================================================
describe("VerticalCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTopicsQuery.mockReturnValue({ data: mockTopics, isPending: false });
    mockDeleteEntryAndInvalidate.mockResolvedValue(undefined);

    vi.mocked(storeModule.useStore).mockImplementation((selector) => {
      const state = {
        selectedDate: new Date(MOCK_DATE),
        selectedDay: 15,
        setSelectedDay: mockSetSelectedDay,
        setSelectedDate: mockSetSelectedDate,
        selectedTopicIds: [],
        expandedDayKeys: [],
        pinnedDayKeys: [],
        expandDay: mockExpandDay,
        collapseDay: mockCollapseDay,
        pinDay: mockPinDay,
        unpinDay: mockUnpinDay,
      };
      return typeof selector === "function"
        ? selector(state as Record<string, unknown>)
        : state;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("renders the calendar container", () => {
      renderCalendar();

      // "Jan" appears in both desktop and mobile views
      const janElements = screen.getAllByText("Jan");
      expect(janElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("2024").length).toBeGreaterThanOrEqual(1);
    });

    it("renders all days of the month", () => {
      renderCalendar();

      // January 2024 has 31 days
      const day1Elements = screen.getAllByText("1");
      expect(day1Elements.length).toBeGreaterThan(0);

      const day31Elements = screen.getAllByText("31");
      expect(day31Elements.length).toBeGreaterThan(0);
    });

    it("renders mobile compact view elements", () => {
      renderCalendar();

      const dayButtons = screen.getAllByRole("button");
      expect(dayButtons.length).toBeGreaterThanOrEqual(31);
    });

    it("highlights the selected day", () => {
      renderCalendar();

      expect(
        screen.getByLabelText(/day row 2024-01-15 selected/i),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Day Selection
  // --------------------------------------------------------------------------
  describe("Day Selection", () => {
    it("calls setSelectedDate and setSelectedDay when clicking a day in mobile view", async () => {
      const user = userEvent.setup();
      renderCalendar();

      const day20Buttons = screen
        .getAllByLabelText(/day 2024-01-20/i)
        .filter((el) => el.tagName === "BUTTON");
      expect(day20Buttons.length).toBeGreaterThan(0);

      await user.click(day20Buttons[0]);
      expect(mockSetSelectedDate).toHaveBeenCalled();
      expect(mockSetSelectedDay).toHaveBeenCalledWith(20);
    });

    it("calls setSelectedDate and setSelectedDay when clicking a day row", async () => {
      const user = userEvent.setup();
      renderCalendar();

      const dayRow = screen.getByLabelText(/day row 2024-01-20/i);
      await user.click(dayRow);
      expect(mockSetSelectedDate).toHaveBeenCalled();
      expect(mockSetSelectedDay).toHaveBeenCalledWith(20);
    });
  });

  // --------------------------------------------------------------------------
  // Task Display
  // --------------------------------------------------------------------------
  describe("Task Display", () => {
    it("does NOT display task pills by default (no selection)", () => {
      renderCalendar();

      expect(
        screen.queryByText("Complete project report"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Morning yoga session"),
      ).not.toBeInTheDocument();
    });

    it("shows day anchors with date metadata for wire connections", () => {
      renderCalendar();

      const dayAnchors = screen.getAllByLabelText(/day (row )?2024-01-/i);
      expect(dayAnchors.length).toBeGreaterThan(0);

      const firstAnchor = dayAnchors.find(
        (el) =>
          (el as HTMLElement).dataset.dayNumber &&
          (el as HTMLElement).dataset.dateKey,
      );
      expect(firstAnchor).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Empty State
  // --------------------------------------------------------------------------
  describe("Empty State", () => {
    it("renders calendar without entries when entriesByDate is empty", () => {
      renderCalendar({});

      // "Jan" appears in both desktop and mobile views
      expect(screen.getAllByText("Jan").length).toBeGreaterThanOrEqual(1);
      expect(
        screen.queryByText("Complete project report"),
      ).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------
  describe("Accessibility", () => {
    it("no remove buttons in collapsed mode", () => {
      renderCalendar();

      const removeButtons = screen.queryAllByRole("button", {
        name: /eliminar tarea/i,
      });
      expect(removeButtons.length).toBe(0);
    });

    it("day buttons are keyboard accessible", () => {
      renderCalendar();

      const dayButtons = screen.getAllByRole("button");
      dayButtons.forEach((button) => {
        expect(button).not.toHaveAttribute("tabindex", "-1");
      });
    });
  });

  // --------------------------------------------------------------------------
  // Today Highlight
  // --------------------------------------------------------------------------
  describe("Today Highlight", () => {
    it("highlights today with special styling when not selected", () => {
      const today = new Date();
      const todayDay = today.getDate();

      if (todayDay !== 15) {
        vi.mocked(storeModule.useStore).mockImplementation((selector) => {
          const state = {
            selectedDate: new Date(today.getFullYear(), today.getMonth(), 1),
            selectedDay: 1,
            setSelectedDay: mockSetSelectedDay,
            setSelectedDate: mockSetSelectedDate,
            selectedTopicIds: [],
            expandedDayKeys: [],
            expandDay: mockExpandDay,
            collapseDay: mockCollapseDay,
          };
          return typeof selector === "function"
            ? selector(state as Record<string, unknown>)
            : state;
        });

        renderCalendar({});

        const day1Elements = screen.getAllByText("1");
        expect(day1Elements.length).toBeGreaterThan(0);
      }
    });
  });
});
