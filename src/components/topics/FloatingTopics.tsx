"use client";

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStore } from "@/lib/store";
import { TOPICS, type TopicId } from "@/domain/types";
import { clamp, median, quadPath } from "@/lib/utils";

// Configuration constants
const TASK_ANCHOR_INSET = 6;
const JUNCTION_PULL_LEFT = 180;
const JUNCTION_FOLLOW = 0.14;
const JUNCTION_TO_NODE_BLEND = 0.77;

interface FloatingTopicsProps {
  taskRefs: React.RefObject<Map<string, HTMLDivElement | null>>;
  calendarRef: React.RefObject<HTMLDivElement | null>;
}

export function FloatingTopics({ taskRefs, calendarRef }: FloatingTopicsProps) {
  const {
    tasksByDay,
    topicPositions,
    setTopicPosition,
    highlightedTopic,
    setHighlightedTopic,
  } = useStore();

  const boardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [boardSize, setBoardSize] = useState({ w: 1, h: 1, rightW: 0 });
  const [taskCenters, setTaskCenters] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Junction positions for smooth wire animation
  const junctionRef = useRef<
    Partial<Record<TopicId, { x: number; y: number }>>
  >({});
  const junctionTargetRef = useRef<Partial<Record<TopicId, { y: number }>>>({});
  const junctionRaf = useRef<number | null>(null);
  const [junctionPositions, setJunctionPositions] = useState<
    Partial<Record<TopicId, { x: number; y: number }>>
  >({});
  const [junctionTick, setJunctionTick] = useState(0);

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

  // Recalculate task positions
  const recalc = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;

    const b = board.getBoundingClientRect();
    const rightW = calendarRef?.current
      ? calendarRef.current.getBoundingClientRect().width
      : 0;

    setBoardSize({ w: Math.max(1, b.width), h: Math.max(1, b.height), rightW });

    const centers: Record<string, { x: number; y: number }> = {};
    const scroller = calendarRef?.current;
    const s = scroller ? scroller.getBoundingClientRect() : null;

    if (taskRefs.current) {
      for (const t of flatTasks) {
        const el = taskRefs.current.get(t.id);
        if (!el) continue;

        const r = el.getBoundingClientRect();

        // Only include visible tasks
        if (s) {
          const visible =
            r.bottom >= s.top &&
            r.top <= s.bottom &&
            r.right >= s.left &&
            r.left <= s.right;
          if (!visible) continue;
        }

        // Anchor from left side of task pill
        centers[t.id] = {
          x: r.left - b.left + TASK_ANCHOR_INSET,
          y: r.top - b.top + r.height / 2,
        };
      }
    }

    setTaskCenters(centers);
  }, [flatTasks, taskRefs, calendarRef]);

  const scheduleRecalc = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recalc();
    });
  }, [recalc]);

  // Setup resize and scroll observers
  useLayoutEffect(() => {
    recalc();

    const board = boardRef.current;
    if (!board) return;

    const ro = new ResizeObserver(() => recalc());
    ro.observe(board);
    if (calendarRef?.current) ro.observe(calendarRef.current);

    const scroller = calendarRef?.current;
    if (scroller)
      scroller.addEventListener("scroll", scheduleRecalc, { passive: true });

    window.addEventListener("resize", recalc);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
      if (scroller) scroller.removeEventListener("scroll", scheduleRecalc);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [recalc, scheduleRecalc, calendarRef]);

  // Calculate topic node centers and radii
  const topicCenters = useMemo(() => {
    const leftW = Math.max(0, boardSize.w - boardSize.rightW);
    const margin = 60;
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

      const minX = r + 20;
      const maxX = Math.max(minX, leftW - r - 20);
      const minY = r + 20;
      const maxY = Math.max(minY, boardSize.h - r - 20);

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

    // Animation step
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
        junctionRaf.current = requestAnimationFrame(step);
      } else {
        junctionRaf.current = null;
      }
    };

    // Initial positions
    const initialPositions = collectJunctionPositions();
    if (Object.keys(initialPositions).length > 0) {
      requestAnimationFrame(() => {
        setJunctionPositions((prev) => ({ ...prev, ...initialPositions }));
      });
    }

    if (junctionRaf.current) cancelAnimationFrame(junctionRaf.current);
    junctionRaf.current = requestAnimationFrame(step);

    return () => {
      if (junctionRaf.current) cancelAnimationFrame(junctionRaf.current);
      junctionRaf.current = null;
    };
  }, [
    activeTopics,
    boardSize,
    taskCenters,
    topicCenters,
    getTaskYsForTopic,
    collectJunctionPositions,
  ]);

  // Build wire bundles
  const bundles = useMemo(() => {
    void junctionTick; // Force re-render dependency

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
      if (!node || !j) continue;

      const items: Array<{ id: string; x: number; y: number }> = [];
      for (const tasks of Object.values(tasksByDay)) {
        for (const t of tasks) {
          if (t.topicId !== id) continue;
          const c = taskCenters[t.id];
          if (!c) continue;
          items.push({ id: t.id, x: c.x, y: c.y });
        }
      }

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

      const trunk = quadPath(node.x, node.y, j.x, j.y, -0.7);
      const branches: Branch[] = items.map((p) => ({
        key: p.id,
        d: quadPath(j.x, j.y, p.x, p.y, +0.55),
      }));

      out.push({ topicId: id, color: TOPICS[id].color, trunk, branches });
    }

    return out;
  }, [activeTopics, junctionTick, junctionPositions, topicCenters, tasksByDay, taskCenters]);

  // Drag handlers
  const handlePointerDown =
    (id: TopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const board = boardRef.current;
      const c = topicCenters[id];
      if (!board || !c) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const b = board.getBoundingClientRect();
      const px = e.clientX - b.left;
      const py = e.clientY - b.top;

      dragRef.current = {
        id,
        pointerId: e.pointerId,
        offsetX: px - c.x,
        offsetY: py - c.y,
      };

      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const minX = c.r + 20;
      const maxX = Math.max(minX, leftW - c.r - 20);
      const minY = c.r + 20;
      const maxY = Math.max(minY, boardSize.h - c.r - 20);

      const nx = clamp(px - dragRef.current.offsetX, minX, maxX);
      const ny = clamp(py - dragRef.current.offsetY, minY, maxY);

      setTopicPosition(id, { x: nx, y: ny });
    };

  const handlePointerMove =
    (id: TopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const board = boardRef.current;
      const c = topicCenters[id];
      const drag = dragRef.current;

      if (!board || !c || !drag) return;
      if (drag.id !== id || drag.pointerId !== e.pointerId) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      const b = board.getBoundingClientRect();
      const px = e.clientX - b.left;
      const py = e.clientY - b.top;

      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const minX = c.r + 20;
      const maxX = Math.max(minX, leftW - c.r - 20);
      const minY = c.r + 20;
      const maxY = Math.max(minY, boardSize.h - c.r - 20);

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
    <div ref={boardRef} className="absolute inset-0 overflow-hidden">
      {/* SVG Wires */}
      <svg
        className="wires"
        width="100%"
        height="100%"
        viewBox={`0 0 ${boardSize.w} ${boardSize.h}`}
        preserveAspectRatio="none"
      >
        {bundles.map((b) => {
          const dim = highlightedTopic && b.topicId !== highlightedTopic;
          const trunkOpacity = dim ? 0.03 : 0.18;
          const branchOpacity = dim ? 0.04 : 0.24;

          if (b.single) {
            return (
              <g key={b.topicId}>
                <path
                  d={b.single}
                  stroke={b.color}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={dim ? 1 : 1.6}
                  strokeOpacity={dim ? 0.06 : 0.22}
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
                    strokeWidth={dim ? 1.4 : 3}
                    strokeOpacity={trunkOpacity}
                  />
                  <path
                    d={b.trunk}
                    stroke={b.color}
                    fill="none"
                    strokeLinecap="round"
                    strokeWidth={dim ? 1 : 2.2}
                    strokeOpacity={dim ? 0.03 : 0.1}
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
                  strokeWidth={dim ? 1 : 1.7}
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
            className="topic-node"
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
