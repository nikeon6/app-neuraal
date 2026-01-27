"use client";

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { useStore } from "@/lib/store";
import { TOPICS, type TopicId } from "@/domain/types";
import { clamp, median, quadPath } from "@/lib/utils";

// Configuration constants
const JUNCTION_PULL_LEFT = 120;
const JUNCTION_FOLLOW = 0.18;
const JUNCTION_TO_NODE_BLEND = 0.65;
const NODE_MARGIN = 8;

interface FloatingTopicsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function FloatingTopics({ containerRef }: FloatingTopicsProps) {
  const {
    tasksByDay,
    topicPositions,
    setTopicPosition,
    highlightedTopic,
    setHighlightedTopic,
  } = useStore();

  const [boardSize, setBoardSize] = useState({ w: 1, h: 1, rightW: 0 });
  const [taskCenters, setTaskCenters] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Junction positions for smooth wire animation
  const junctionRef = useRef<
    Partial<Record<TopicId, { x: number; y: number }>>
  >({});
  const junctionTargetRef = useRef<Partial<Record<TopicId, { y: number }>>>({});
  const [junctionPositions, setJunctionPositions] = useState<
    Partial<Record<TopicId, { x: number; y: number }>>
  >({});
  const [, setJunctionTick] = useState(0);

  // Drag state
  const dragRef = useRef<{
    id: TopicId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Flatten all tasks
  const flatTasks = useMemo(
    () => Object.values(tasksByDay).flat(),
    [tasksByDay]
  );

  // Count tasks per topic
  const topicCounts = useMemo(() => {
    const counts: Record<TopicId, number> = { work: 0, health: 0, fun: 0 };
    for (const t of flatTasks) counts[t.topicId]++;
    return counts;
  }, [flatTasks]);

  // Active topics (with at least one task)
  const activeTopics = useMemo(() => {
    return (Object.keys(TOPICS) as TopicId[]).filter(
      (id) => topicCounts[id] > 0
    );
  }, [topicCounts]);

  // Recalculate positions
  const recalc = useCallback(() => {
    const container = containerRef?.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    
    // Find the calendar aside
    const aside = container.querySelector('aside');
    const asideRect = aside?.getBoundingClientRect();
    const rightW = asideRect ? asideRect.width : 0;
    const asideLeft = asideRect ? asideRect.left - containerRect.left : containerRect.width;

    setBoardSize({
      w: Math.max(1, containerRect.width),
      h: Math.max(1, containerRect.height),
      rightW,
    });

    const centers: Record<string, { x: number; y: number }> = {};

    // Find all visible task pills in the DOM
    const taskPills = container.querySelectorAll('[data-task-id]');
    
    taskPills.forEach((el) => {
      const taskId = el.getAttribute('data-task-id');
      if (!taskId) return;

      const r = el.getBoundingClientRect();
      
      // Check if the element is actually visible (within the aside's visible area)
      if (asideRect) {
        const isVisible = 
          r.top < asideRect.bottom && 
          r.bottom > asideRect.top &&
          r.left < asideRect.right &&
          r.right > asideRect.left;
        
        if (!isVisible) return;
      }
      
      // Calculate position - anchor point on the LEFT side of the task pill
      const x = r.left - containerRect.left;
      const y = r.top - containerRect.top + r.height / 2;

      // Only include if within visible bounds
      if (y > 0 && y < containerRect.height && x > 0) {
        centers[taskId] = { x, y };
      }
    });

    setTaskCenters(centers);
  }, [containerRef]);

  // Setup observers
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    // Initial calculation with delay
    const initialTimeout = setTimeout(recalc, 200);

    // Resize observer
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(recalc);
    });
    ro.observe(container);

    // Find scroll container in calendar and observe it
    const aside = container.querySelector('aside');
    if (aside) {
      ro.observe(aside);
      
      // Find the scrollable element
      const scrollEl = aside.querySelector('.overflow-y-auto') || aside;
      scrollEl.addEventListener("scroll", recalc, { passive: true });
      
      // Cleanup function needs this reference
      const cleanup = () => {
        scrollEl.removeEventListener("scroll", recalc);
      };
      
      // Window resize
      window.addEventListener("resize", recalc);

      // Mutation observer for DOM changes
      const mo = new MutationObserver(() => {
        setTimeout(recalc, 50);
      });
      mo.observe(container, { childList: true, subtree: true });

      return () => {
        clearTimeout(initialTimeout);
        ro.disconnect();
        mo.disconnect();
        window.removeEventListener("resize", recalc);
        cleanup();
      };
    }

    window.addEventListener("resize", recalc);
    return () => {
      clearTimeout(initialTimeout);
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [recalc, containerRef]);

  // Recalculate when tasks change
  useEffect(() => {
    const timeout = setTimeout(recalc, 100);
    return () => clearTimeout(timeout);
  }, [tasksByDay, recalc]);

  // Calculate topic node centers and radii
  const topicCenters = useMemo(() => {
    const leftW = Math.max(0, boardSize.w - boardSize.rightW);
    const margin = 40;
    const areaW = Math.max(1, leftW - margin * 2);
    const areaH = Math.max(1, boardSize.h - margin * 2);

    const centers: Partial<
      Record<TopicId, { x: number; y: number; r: number }>
    > = {};

    for (const id of activeTopics) {
      const count = topicCounts[id];
      const r = Math.min(65, 20 + count * 8);

      const anchor = TOPICS[id].anchor;
      const defX = margin + anchor.xPct * areaW;
      const defY = margin + anchor.yPct * areaH;

      const pos = topicPositions[id] ?? { x: defX, y: defY };

      const minX = r + NODE_MARGIN;
      const maxX = Math.max(minX, leftW - r - NODE_MARGIN);
      const minY = r + NODE_MARGIN;
      const maxY = Math.max(minY, boardSize.h - r - NODE_MARGIN);

      centers[id] = { x: clamp(pos.x, minX, maxX), y: clamp(pos.y, minY, maxY), r };
    }

    return centers;
  }, [activeTopics, boardSize, topicCounts, topicPositions]);

  // Helper functions for junction calculations
  const getTaskYsForTopic = useCallback(
    (topicId: TopicId): number[] => {
      const ys: number[] = [];
      for (const tasks of Object.values(tasksByDay)) {
        for (const t of tasks) {
          if (t.topicId !== topicId) continue;
          const c = taskCenters[t.id];
          if (!c) continue;
          ys.push(c.y);
        }
      }
      return ys;
    },
    [tasksByDay, taskCenters]
  );

  const collectJunctionPositions = useCallback(() => {
    const positions: Partial<Record<TopicId, { x: number; y: number }>> = {};
    for (const id of activeTopics) {
      const pos = junctionRef.current[id];
      if (pos) positions[id] = { ...pos };
    }
    return positions;
  }, [activeTopics]);

  // Junction animation
  useLayoutEffect(() => {
    const leftW = Math.max(0, boardSize.w - boardSize.rightW);
    if (leftW <= 1 || boardSize.h <= 1) return;

    // Update X positions
    for (const id of activeTopics) {
      const node = topicCenters[id];
      if (!node) continue;

      const xWanted = leftW - JUNCTION_PULL_LEFT;
      const xMin = node.x + node.r + 24;
      const xMax = leftW - 10;
      const x = clamp(xWanted, xMin, xMax);

      const existing = junctionRef.current[id];
      if (existing) {
        existing.x = x;
      } else {
        junctionRef.current[id] = { x, y: node.y };
      }
    }

    // Update target Y positions
    for (const id of activeTopics) {
      const node = topicCenters[id];
      if (!node) continue;

      const ys = getTaskYsForTopic(id);
      if (ys.length === 0) continue;

      const medY = median(ys);
      const targetY = clamp(
        medY * (1 - JUNCTION_TO_NODE_BLEND) + node.y * JUNCTION_TO_NODE_BLEND,
        20,
        boardSize.h - 20
      );
      junctionTargetRef.current[id] = { y: targetY };
    }

    // Animation
    let animationId: number;
    const step = () => {
      let changed = false;

      for (const id of activeTopics) {
        const cur = junctionRef.current[id];
        const tar = junctionTargetRef.current[id];
        if (!cur || !tar) continue;

        const ny = cur.y + (tar.y - cur.y) * JUNCTION_FOLLOW;
        if (Math.abs(ny - cur.y) > 0.05) {
          cur.y = ny;
          changed = true;
        } else {
          cur.y = tar.y;
        }
      }

      if (changed) {
        setJunctionPositions(collectJunctionPositions());
        setJunctionTick((t) => t + 1);
        animationId = requestAnimationFrame(step);
      }
    };

    setJunctionPositions(collectJunctionPositions());
    animationId = requestAnimationFrame(step);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [
    activeTopics,
    boardSize,
    taskCenters,
    topicCenters,
    getTaskYsForTopic,
    collectJunctionPositions,
  ]);

  // Build wire bundles - only for visible tasks
  const bundles = useMemo(() => {
    type Branch = { key: string; d: string };
    type Bundle = {
      topicId: TopicId;
      color: string;
      trunk?: string;
      branches: Branch[];
      single?: string;
    };

    const out: Bundle[] = [];

    for (const id of activeTopics) {
      const node = topicCenters[id];
      const j = junctionPositions[id];
      if (!node) continue;

      // Collect visible tasks for this topic
      const items: Array<{ id: string; x: number; y: number }> = [];
      for (const tasks of Object.values(tasksByDay)) {
        for (const t of tasks) {
          if (t.topicId !== id) continue;
          const c = taskCenters[t.id];
          if (!c) continue;
          items.push({ id: t.id, x: c.x, y: c.y });
        }
      }

      // Skip if no visible tasks
      if (items.length === 0) continue;

      if (items.length === 1) {
        const only = items[0];
        out.push({
          topicId: id,
          color: TOPICS[id].color,
          branches: [],
          single: quadPath(node.x, node.y, only.x, only.y, -0.55),
        });
        continue;
      }

      // Need junction for multiple tasks
      if (!j) continue;

      const trunk = quadPath(node.x, node.y, j.x, j.y, -0.7);
      const branches: Branch[] = items.map((p) => ({
        key: p.id,
        d: quadPath(j.x, j.y, p.x, p.y, +0.55),
      }));

      out.push({ topicId: id, color: TOPICS[id].color, trunk, branches });
    }

    return out;
  }, [activeTopics, junctionPositions, topicCenters, tasksByDay, taskCenters]);

  // Drag handlers
  const handlePointerDown =
    (id: TopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const container = containerRef?.current;
      const c = topicCenters[id];
      if (!container || !c) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      dragRef.current = {
        id,
        pointerId: e.pointerId,
        offsetX: px - c.x,
        offsetY: py - c.y,
      };

      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const minX = c.r + NODE_MARGIN;
      const maxX = Math.max(minX, leftW - c.r - NODE_MARGIN);
      const minY = c.r + NODE_MARGIN;
      const maxY = Math.max(minY, boardSize.h - c.r - NODE_MARGIN);

      const nx = clamp(px - dragRef.current.offsetX, minX, maxX);
      const ny = clamp(py - dragRef.current.offsetY, minY, maxY);

      setTopicPosition(id, { x: nx, y: ny });
    };

  const handlePointerMove =
    (id: TopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const container = containerRef?.current;
      const c = topicCenters[id];
      const drag = dragRef.current;

      if (!container || !c || !drag) return;
      if (drag.id !== id || drag.pointerId !== e.pointerId) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const minX = c.r + NODE_MARGIN;
      const maxX = Math.max(minX, leftW - c.r - NODE_MARGIN);
      const minY = c.r + NODE_MARGIN;
      const maxY = Math.max(minY, boardSize.h - c.r - NODE_MARGIN);

      const nx = clamp(px - drag.offsetX, minX, maxX);
      const ny = clamp(py - drag.offsetY, minY, maxY);

      setTopicPosition(id, { x: nx, y: ny });
    };

  const handlePointerUp =
    () => (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (drag && drag.pointerId === e.pointerId) dragRef.current = null;

      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      {/* SVG Wires */}
      <svg
        className="absolute inset-0"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        {bundles.map((b) => {
          const dim = highlightedTopic && b.topicId !== highlightedTopic;
          const trunkOpacity = dim ? 0.08 : 0.25;
          const branchOpacity = dim ? 0.1 : 0.3;

          if (b.single) {
            return (
              <g key={b.topicId}>
                <path
                  d={b.single}
                  stroke={b.color}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={dim ? 1 : 2}
                  strokeOpacity={dim ? 0.1 : 0.3}
                  strokeDasharray="4 8"
                />
              </g>
            );
          }

          return (
            <g key={b.topicId}>
              {b.trunk && (
                <>
                  <path
                    d={b.trunk}
                    stroke={b.color}
                    fill="none"
                    strokeLinecap="round"
                    strokeWidth={dim ? 2 : 3}
                    strokeOpacity={trunkOpacity}
                  />
                  <path
                    d={b.trunk}
                    stroke={b.color}
                    fill="none"
                    strokeLinecap="round"
                    strokeWidth={dim ? 1 : 2}
                    strokeOpacity={dim ? 0.05 : 0.12}
                    strokeDasharray="4 8"
                  />
                </>
              )}
              {b.branches.map((br) => (
                <path
                  key={br.key}
                  d={br.d}
                  stroke={b.color}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={dim ? 1 : 1.5}
                  strokeOpacity={branchOpacity}
                  strokeDasharray="4 8"
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Floating Topic Nodes */}
      {activeTopics.map((id) => {
        const c = topicCenters[id];
        if (!c) return null;

        return (
          <button
            type="button"
            key={id}
            aria-label={`Mover nodo de ${TOPICS[id].name}`}
            onMouseEnter={() => setHighlightedTopic(id)}
            onMouseLeave={() => setHighlightedTopic(null)}
            onPointerDown={handlePointerDown(id)}
            onPointerMove={handlePointerMove(id)}
            onPointerUp={handlePointerUp()}
            onPointerCancel={handlePointerUp()}
            className="topic-node pointer-events-auto"
            style={{
              left: c.x - c.r,
              top: c.y - c.r,
              width: c.r * 2,
              height: c.r * 2,
              background: TOPICS[id].color,
              touchAction: "none",
            }}
            title={`${TOPICS[id].name} (${topicCounts[id]} tareas)`}
          >
            <div className="topic-label">
              <div className="topic-name">{TOPICS[id].name}</div>
              <div className="topic-count">{topicCounts[id]}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
