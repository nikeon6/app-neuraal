import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TopicBubbleChart, type TopicBubbleData } from "./TopicBubbleChart";

// The force simulation runs async ticks; advance timers to settle
vi.useFakeTimers({ shouldAdvanceTime: true });

const mockData: TopicBubbleData[] = [
  { topicId: "t1", name: "Work", color: "#e11d48", count: 5, percentage: 50 },
  { topicId: "t2", name: "Health", color: "#3b82f6", count: 3, percentage: 30 },
  { topicId: "t3", name: "Fun", color: "#facc15", count: 2, percentage: 20 },
];

describe("TopicBubbleChart", () => {
  describe("Rendering", () => {
    it("renders the chart title", () => {
      render(<TopicBubbleChart data={mockData} />);

      expect(screen.getByText("Tasks by Topic")).toBeInTheDocument();
    });

    it("renders bubbles for each topic after simulation settles", async () => {
      render(<TopicBubbleChart data={mockData} />);

      // Wait for D3 force simulation ticks to render bubbles
      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(screen.getByText("Health")).toBeInTheDocument();
        expect(screen.getByText("Fun")).toBeInTheDocument();
      });
    });

    it("displays task count in each bubble", async () => {
      render(<TopicBubbleChart data={mockData} />);

      await waitFor(() => {
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
      });
    });

    it("renders an SVG element", () => {
      render(<TopicBubbleChart data={mockData} />);
      expect(screen.getByLabelText(/topic bubbles chart/i)).toBeInTheDocument();
    });

    it("renders chart graphic together with topic labels", async () => {
      render(<TopicBubbleChart data={mockData} />);

      await waitFor(() => {
        expect(
          screen.getByLabelText(/topic bubbles chart/i),
        ).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(screen.getByText("Health")).toBeInTheDocument();
        expect(screen.getByText("Fun")).toBeInTheDocument();
      });
    });
  });

  describe("Edge cases", () => {
    it("shows empty state when no data", () => {
      render(<TopicBubbleChart data={[]} />);

      expect(screen.getByText("Tasks by Topic")).toBeInTheDocument();
      expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
    });

    it("handles single topic", async () => {
      const single: TopicBubbleData[] = [
        {
          topicId: "t1",
          name: "Work",
          color: "#e11d48",
          count: 10,
          percentage: 100,
        },
      ];
      render(<TopicBubbleChart data={single} />);

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(screen.getByText("10")).toBeInTheDocument();
      });
    });
  });
});
