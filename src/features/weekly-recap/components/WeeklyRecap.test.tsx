import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock store
const mockSelectedDate = new Date(2026, 1, 4); // Feb 4, 2026 (Wednesday)
vi.mock("@/shared/store", () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ selectedDate: mockSelectedDate }),
}));

// Mock queries
const mockEntriesByDate: Record<string, unknown[]> = {
  "2026-02-02": [
    {
      id: "1",
      type: "task",
      title: "Write report",
      topicId: "t1",
      completed: true,
      date: "2026-02-02",
    },
    {
      id: "2",
      type: "task",
      title: "Go running",
      topicId: "t2",
      completed: false,
      date: "2026-02-02",
    },
    {
      id: "3",
      type: "note",
      title: "Meeting notes",
      topicId: null,
      completed: null,
      date: "2026-02-02",
    },
  ],
  "2026-02-03": [
    {
      id: "4",
      type: "task",
      title: "Team meeting",
      topicId: "t1",
      completed: true,
      date: "2026-02-03",
    },
  ],
};
const mockTopics = [
  { id: "t1", userId: "u1", name: "Work", color: "#e11d48", createdAt: "" },
  { id: "t2", userId: "u1", name: "Health", color: "#3b82f6", createdAt: "" },
];

vi.mock("@/shared/api/queries", () => ({
  useEntriesForDates: () => ({
    entriesByDate: mockEntriesByDate,
    isPending: false,
  }),
  useTopicsQuery: () => ({
    data: mockTopics,
  }),
}));

// Mock child components to isolate container tests
vi.mock("./CompletionDonutChart", () => ({
  CompletionDonutChart: ({
    completed,
    pending,
  }: {
    completed: number;
    pending: number;
  }) => (
    <div aria-label="completion donut chart">
      Donut: {completed}/{pending}
    </div>
  ),
}));

vi.mock("./TopicBubbleChart", () => ({
  TopicBubbleChart: ({ data }: { data: unknown[] }) => (
    <div aria-label="topic bubble chart">Bubbles: {data.length} topics</div>
  ),
}));

vi.mock("./DailyBarChart", () => ({
  DailyBarChart: ({ data }: { data: unknown[] }) => (
    <div aria-label="daily bar chart">Bars: {data.length} days</div>
  ),
}));

vi.mock("./WeeklyTaskList", () => ({
  WeeklyTaskList: ({ tasks }: { tasks: unknown[] }) => (
    <div aria-label="weekly task list">Tasks: {tasks.length}</div>
  ),
}));

// Import after mocks
import { WeeklyRecap } from "./WeeklyRecap";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WeeklyRecap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders all chart components", () => {
      renderWithProviders(<WeeklyRecap />);

      expect(
        screen.getByLabelText("completion donut chart"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("topic bubble chart")).toBeInTheDocument();
      expect(screen.getByLabelText("daily bar chart")).toBeInTheDocument();
    });

    it("renders the task list", () => {
      renderWithProviders(<WeeklyRecap />);

      expect(screen.getByLabelText("weekly task list")).toBeInTheDocument();
    });

    it("passes correct completion counts to donut chart (only tasks, not notes)", () => {
      renderWithProviders(<WeeklyRecap />);

      // 3 tasks total (excludes the 1 note): 2 completed, 1 pending
      expect(screen.getByLabelText("completion donut chart")).toHaveTextContent(
        "2/1",
      );
    });

    it("passes 7 days of data to bar chart", () => {
      renderWithProviders(<WeeklyRecap />);

      expect(screen.getByLabelText("daily bar chart")).toHaveTextContent(
        "7 days",
      );
    });

    it("passes only tasks (not notes) to task list", () => {
      renderWithProviders(<WeeklyRecap />);

      // 3 tasks (note excluded)
      expect(screen.getByLabelText("weekly task list")).toHaveTextContent(
        "Tasks: 3",
      );
    });

    it("passes topic distribution data to bubble chart", () => {
      renderWithProviders(<WeeklyRecap />);

      // 2 topics (Work + Health)
      expect(screen.getByLabelText("topic bubble chart")).toHaveTextContent(
        "2 topics",
      );
    });
  });
});
