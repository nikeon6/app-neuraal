import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CompletionDonutChart } from "./CompletionDonutChart";

describe("CompletionDonutChart", () => {
  describe("Rendering", () => {
    it("renders the chart with completed and pending counts", () => {
      render(<CompletionDonutChart completed={7} pending={3} />);

      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("displays the total count in the center", () => {
      render(<CompletionDonutChart completed={5} pending={5} />);

      expect(screen.getByText(/10\s*tasks/i)).toBeInTheDocument();
    });

    it("displays the completion percentage in the center", () => {
      render(<CompletionDonutChart completed={3} pending={7} />);

      // 3 out of 10 = 30%
      expect(screen.getByText("30%")).toBeInTheDocument();
    });

    it("renders SVG with two circle strokes", () => {
      render(<CompletionDonutChart completed={5} pending={5} />);
      expect(
        screen.getByLabelText(/task completion chart/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/pending tasks ring/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/completed tasks ring/i),
      ).toBeInTheDocument();
    });

    it("shows the title 'Task Completion'", () => {
      render(<CompletionDonutChart completed={5} pending={5} />);

      expect(screen.getByText("Task Completion")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles zero tasks gracefully", () => {
      render(<CompletionDonutChart completed={0} pending={0} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
      expect(screen.getByText(/0\s*tasks/i)).toBeInTheDocument();
    });

    it("handles 100% completion", () => {
      render(<CompletionDonutChart completed={10} pending={0} />);

      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("shows 'Completed' and 'Pending' legend labels", () => {
      render(<CompletionDonutChart completed={3} pending={7} />);

      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });
});
