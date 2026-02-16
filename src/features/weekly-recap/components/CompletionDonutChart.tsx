"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompletionDonutChartProps {
  /** Number of completed tasks */
  readonly completed: number;
  /** Number of pending tasks */
  readonly pending: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE = 160;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CompletionDonutChart — animated SVG donut chart showing
 * completed vs pending task ratio.
 *
 * The arc fills progressively via CSS transition on stroke-dashoffset.
 */
export function CompletionDonutChart({
  completed,
  pending,
}: CompletionDonutChartProps) {
  const total = completed + pending;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Animate from 0 to target on mount
  const [animatedOffset, setAnimatedOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    // Small delay to ensure the initial render (full offset) paints first
    const timer = setTimeout(() => {
      const target =
        total > 0
          ? CIRCUMFERENCE - (completed / total) * CIRCUMFERENCE
          : CIRCUMFERENCE;
      setAnimatedOffset(target);
    }, 50);
    return () => clearTimeout(timer);
  }, [completed, total]);

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col items-center gap-4">
      {/* Title */}
      <h3 className="text-sm font-semibold text-white/80 tracking-wide">
        Task Completion
      </h3>

      {/* Donut SVG */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-label="Task completion chart"
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            aria-label="Pending tasks ring"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE_WIDTH}
          />
          {/* Completed arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            aria-label="Completed tasks ring"
            fill="none"
            stroke="url(#completionGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animatedOffset}
            style={{
              transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient
              id="completionGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{percentage}%</span>
          <span className="text-[11px] text-white/40">{total} tasks</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-white/60">Completed</span>
          <span className="text-white font-semibold ml-0.5">{completed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle className="w-3.5 h-3.5 text-white/25" />
          <span className="text-white/60">Pending</span>
          <span className="text-white font-semibold ml-0.5">{pending}</span>
        </div>
      </div>
    </div>
  );
}
