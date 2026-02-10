"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  forceSimulation,
  forceX,
  forceY,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicBubbleData {
  topicId: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
}

interface BubbleNode extends SimulationNodeDatum {
  topicId: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
  radius: number;
}

interface RenderedBubble {
  topicId: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
  radius: number;
  x: number;
  y: number;
}

export interface TopicBubbleChartProps {
  readonly data: readonly TopicBubbleData[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_SIZE = 280;
const CENTER = CHART_SIZE / 2;
const MIN_RADIUS = 24;
const MAX_RADIUS = 60;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TopicBubbleChart — D3 force-based circle packing chart.
 *
 * Each bubble represents a topic. Size is proportional to task count.
 * Bubbles animate from the center to their equilibrium positions
 * via d3-force simulation.
 */
export function TopicBubbleChart({ data }: TopicBubbleChartProps) {
  const [bubbles, setBubbles] = useState<RenderedBubble[]>([]);
  const [opacity, setOpacity] = useState(0);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);

  // Calculate radii based on counts
  const maxCount = useMemo(
    () => Math.max(...data.map((d) => d.count), 1),
    [data]
  );

  useEffect(() => {
    if (data.length === 0) {
      setBubbles([]);
      return;
    }

    // Create simulation nodes
    const nodes: BubbleNode[] = data.map((d) => {
      const t = maxCount > 1 ? d.count / maxCount : 1;
      const radius = MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
      return {
        ...d,
        radius,
        x: CENTER + (Math.random() - 0.5) * 20,
        y: CENTER + (Math.random() - 0.5) * 20,
      };
    });

    // Stop any previous simulation
    simulationRef.current?.stop();

    const simulation = forceSimulation(nodes)
      .force("x", forceX(CENTER).strength(0.05))
      .force("y", forceY(CENTER).strength(0.05))
      .force(
        "collide",
        forceCollide<BubbleNode>((d) => d.radius + 3).strength(0.8)
      )
      .alpha(0.8)
      .alphaDecay(0.02);

    simulationRef.current = simulation;

    simulation.on("tick", () => {
      setBubbles(
        nodes.map((n) => ({
          topicId: n.topicId,
          name: n.name,
          color: n.color,
          count: n.count,
          percentage: n.percentage,
          radius: n.radius,
          x: n.x ?? CENTER,
          y: n.y ?? CENTER,
        }))
      );
    });

    // Fade in
    requestAnimationFrame(() => setOpacity(1));

    return () => {
      simulation.stop();
    };
  }, [data, maxCount]);

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col items-center gap-3">
      <h3 className="text-sm font-semibold text-white/80 tracking-wide">
        Tasks by Topic
      </h3>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-white/30 text-sm">
          No tasks this week
        </div>
      ) : (
        <svg
          width={CHART_SIZE}
          height={CHART_SIZE}
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
          className="overflow-visible"
          style={{
            opacity,
            transition: "opacity 0.5s ease-in",
          }}
        >
          {bubbles.map((b) => (
            <g key={b.topicId} transform={`translate(${b.x}, ${b.y})`}>
              {/* Bubble */}
              <circle
                r={b.radius}
                fill={b.color}
                opacity={0.2}
                stroke={b.color}
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />
              {/* Glow */}
              <circle
                r={b.radius * 0.85}
                fill={b.color}
                opacity={0.1}
              />
              {/* Topic name */}
              <text
                textAnchor="middle"
                y={b.radius > 35 ? -10 : -6}
                fill="white"
                fontSize={b.radius > 35 ? 11 : 9}
                fontWeight={600}
                opacity={0.9}
              >
                {b.name}
              </text>
              {/* Count */}
              <text
                textAnchor="middle"
                y={b.radius > 35 ? 8 : 6}
                fill="white"
                fontSize={b.radius > 35 ? 16 : 13}
                fontWeight={700}
                opacity={0.95}
              >
                {b.count}
              </text>
              {/* Percentage (only if bubble is large enough) */}
              {b.radius > 30 && (
                <text
                  textAnchor="middle"
                  y={b.radius > 35 ? 22 : 18}
                  fill="white"
                  fontSize={9}
                  fontWeight={500}
                  opacity={0.7}
                >
                  {b.percentage}%
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
