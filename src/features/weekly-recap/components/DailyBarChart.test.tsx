import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DailyBarChart, type DailyBarData } from "./DailyBarChart";

// Mock recharts to render simple testable output
vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
      <div data-testid="bar-chart" data-count={data.length}>
        {children}
      </div>
    ),
    Bar: ({ dataKey, name }: { dataKey: string; name: string }) => (
      <div data-testid={`bar-${dataKey}`} data-name={name} />
    ),
    XAxis: ({ dataKey }: { dataKey: string }) => (
      <div data-testid="x-axis" data-key={dataKey} />
    ),
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
  };
});

const mockData: DailyBarData[] = [
  { day: "Mon", label: "Monday", completed: 3, pending: 2 },
  { day: "Tue", label: "Tuesday", completed: 1, pending: 4 },
  { day: "Wed", label: "Wednesday", completed: 5, pending: 0 },
  { day: "Thu", label: "Thursday", completed: 0, pending: 0 },
  { day: "Fri", label: "Friday", completed: 2, pending: 1 },
  { day: "Sat", label: "Saturday", completed: 0, pending: 0 },
  { day: "Sun", label: "Sunday", completed: 1, pending: 1 },
];

describe("DailyBarChart", () => {
  describe("Rendering", () => {
    it("renders the chart title", () => {
      render(<DailyBarChart data={mockData} />);

      expect(screen.getByText("Tasks by Day")).toBeInTheDocument();
    });

    it("renders the bar chart with correct data count", () => {
      render(<DailyBarChart data={mockData} />);

      const barChart = screen.getByTestId("bar-chart");
      expect(barChart).toHaveAttribute("data-count", "7");
    });

    it("renders completed and pending bars", () => {
      render(<DailyBarChart data={mockData} />);

      expect(screen.getByTestId("bar-completed")).toBeInTheDocument();
      expect(screen.getByTestId("bar-pending")).toBeInTheDocument();
    });

    it("renders X axis with day key", () => {
      render(<DailyBarChart data={mockData} />);

      const xAxis = screen.getByTestId("x-axis");
      expect(xAxis).toHaveAttribute("data-key", "day");
    });

    it("renders within a responsive container", () => {
      render(<DailyBarChart data={mockData} />);

      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("renders with empty data", () => {
      render(<DailyBarChart data={[]} />);

      expect(screen.getByText("Tasks by Day")).toBeInTheDocument();
    });
  });
});
