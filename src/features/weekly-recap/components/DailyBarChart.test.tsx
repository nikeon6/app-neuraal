import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DailyBarChart, type DailyBarData } from "./DailyBarChart";

let lastTooltipProps: {
  labelFormatter?: (value: string) => string;
} | null = null;

// Mock recharts to render simple testable output
vi.mock("recharts", () => {
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div aria-label="responsive container">{children}</div>
    ),
    BarChart: ({
      children,
      data,
    }: {
      children: React.ReactNode;
      data: unknown[];
    }) => (
      <div aria-label="bar chart" data-count={data.length}>
        {children}
      </div>
    ),
    Bar: ({ dataKey, name }: { dataKey: string; name: string }) => (
      <div aria-label={`${name} bar`} data-key={dataKey} />
    ),
    XAxis: ({ dataKey }: { dataKey: string }) => (
      <div aria-label="x axis" data-key={dataKey} />
    ),
    YAxis: () => <div aria-label="y axis" />,
    CartesianGrid: () => <div aria-label="cartesian grid" />,
    Tooltip: (props: Record<string, unknown>) => {
      lastTooltipProps = props as {
        labelFormatter?: (value: string) => string;
      };
      return <div aria-label="chart tooltip" />;
    },
    Legend: () => <div aria-label="chart legend" />,
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
  beforeEach(() => {
    lastTooltipProps = null;
  });

  describe("Rendering", () => {
    it("renders the chart title", () => {
      render(<DailyBarChart data={mockData} />);

      expect(screen.getByText("Tasks by Day")).toBeInTheDocument();
    });

    it("renders the bar chart with correct data count", () => {
      render(<DailyBarChart data={mockData} />);

      const barChart = screen.getByLabelText("bar chart");
      expect(barChart).toHaveAttribute("data-count", "7");
    });

    it("renders completed and pending bars", () => {
      render(<DailyBarChart data={mockData} />);

      expect(screen.getByLabelText("Completed bar")).toBeInTheDocument();
      expect(screen.getByLabelText("Pending bar")).toBeInTheDocument();
    });

    it("renders X axis with day key", () => {
      render(<DailyBarChart data={mockData} />);

      const xAxis = screen.getByLabelText("x axis");
      expect(xAxis).toHaveAttribute("data-key", "day");
    });

    it("renders within a responsive container", () => {
      render(<DailyBarChart data={mockData} />);

      expect(screen.getByLabelText("responsive container")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("renders with empty data", () => {
      render(<DailyBarChart data={[]} />);

      expect(screen.getByText("Tasks by Day")).toBeInTheDocument();
    });

    it("formats tooltip label using full day when available", () => {
      render(<DailyBarChart data={mockData} />);
      expect(lastTooltipProps?.labelFormatter?.("Mon")).toBe("Monday");
    });

    it("falls back to original tooltip label when day is not found", () => {
      render(<DailyBarChart data={mockData} />);
      expect(lastTooltipProps?.labelFormatter?.("Xxx")).toBe("Xxx");
    });
  });
});
