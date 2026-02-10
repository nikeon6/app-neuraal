import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { WeeklyTaskList, type WeeklyTask } from "./WeeklyTaskList";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const mockTasks: WeeklyTask[] = [
  {
    id: "1",
    title: "Write report",
    topicName: "Work",
    topicColor: "#e11d48",
    completed: true,
    dayLabel: "Monday",
    dateKey: "2026-02-02",
  },
  {
    id: "2",
    title: "Go running",
    topicName: "Health",
    topicColor: "#3b82f6",
    completed: false,
    dayLabel: "Monday",
    dateKey: "2026-02-02",
  },
  {
    id: "3",
    title: "Team meeting",
    topicName: "Work",
    topicColor: "#e11d48",
    completed: true,
    dayLabel: "Tuesday",
    dateKey: "2026-02-03",
  },
  {
    id: "4",
    title: "Read book",
    topicName: "Fun",
    topicColor: "#facc15",
    completed: false,
    dayLabel: "Wednesday",
    dateKey: "2026-02-04",
  },
];

describe("WeeklyTaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the section title", () => {
      render(<WeeklyTaskList tasks={mockTasks} />);

      expect(screen.getByText("Week Tasks")).toBeInTheDocument();
    });

    it("renders all task titles", () => {
      render(<WeeklyTaskList tasks={mockTasks} />);

      expect(screen.getByText("Write report")).toBeInTheDocument();
      expect(screen.getByText("Go running")).toBeInTheDocument();
      expect(screen.getByText("Team meeting")).toBeInTheDocument();
      expect(screen.getByText("Read book")).toBeInTheDocument();
    });

    it("renders filter tabs", () => {
      render(<WeeklyTaskList tasks={mockTasks} />);

      expect(screen.getByRole("button", { name: /by day/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /by topic/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /by status/i })).toBeInTheDocument();
    });

    it("shows topic color dot for each task", () => {
      const { container } = render(<WeeklyTaskList tasks={mockTasks} />);

      // Each task card should have a color dot element
      const dots = container.querySelectorAll("[data-testid='topic-dot']");
      expect(dots.length).toBe(4);
    });
  });

  describe("Filtering", () => {
    it("defaults to 'by day' filter with day group headers", () => {
      render(<WeeklyTaskList tasks={mockTasks} />);

      // Should show day headers
      expect(screen.getByText("Monday")).toBeInTheDocument();
      expect(screen.getByText("Tuesday")).toBeInTheDocument();
      expect(screen.getByText("Wednesday")).toBeInTheDocument();
    });

    it("switches to 'by topic' filter showing topic group headers", async () => {
      const user = userEvent.setup();
      render(<WeeklyTaskList tasks={mockTasks} />);

      await user.click(screen.getByRole("button", { name: /by topic/i }));

      // Topic names appear as group headers (and also as task pills).
      // Use getAllByText since "Work" appears both as header and pill labels.
      expect(screen.getAllByText("Work").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Health").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Fun").length).toBeGreaterThanOrEqual(1);
    });

    it("switches to 'by status' filter showing status group headers", async () => {
      const user = userEvent.setup();
      render(<WeeklyTaskList tasks={mockTasks} />);

      await user.click(screen.getByRole("button", { name: /by status/i }));

      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("shows empty state when no tasks", () => {
      render(<WeeklyTaskList tasks={[]} />);

      expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
    });
  });
});
