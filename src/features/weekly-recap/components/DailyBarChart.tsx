"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyBarData {
  /** Short day label, e.g. "Mon" */
  day: string;
  /** Full day label, e.g. "Monday" */
  label: string;
  completed: number;
  pending: number;
}

export interface DailyBarChartProps {
  readonly data: readonly DailyBarData[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DailyBarChart — stacked bar chart showing completed vs pending tasks
 * per weekday using Recharts. Bars animate on mount.
 */
export function DailyBarChart({ data }: DailyBarChartProps) {
  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-white/80 tracking-wide text-center">
        Tasks by Day
      </h3>

      <div className="w-full" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data as DailyBarData[]}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "0.75rem",
                backdropFilter: "blur(12px)",
                color: "rgba(255,255,255,0.8)",
                fontSize: 12,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
              labelFormatter={(value) => {
                const item = data.find((d) => d.day === value);
                return item?.label ?? value;
              }}
            />
            <Bar
              dataKey="completed"
              name="Completed"
              stackId="tasks"
              fill="#34d399"
              radius={[0, 0, 0, 0]}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="pending"
              name="Pending"
              stackId="tasks"
              fill="rgba(255,255,255,0.15)"
              radius={[4, 4, 0, 0]}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
