"use client";

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { useStore } from "@/shared/store";
import type { DefaultTopicId } from "@/shared/types";
import type {
  TopicNodeCenter,
  TaskCenter,
} from "@/features/topics/types";
import { TOPICS, TOPIC_IDS } from "@/shared/constants";
import { clamp, median, quadPath, isDefaultTopicId } from "@/shared/lib";

// ============================================================================
// Configuration Constants
// ============================================================================
// JUNCTION_PULL_LEFT: How far left from the right edge the junction point is placed (no lane)
const JUNCTION_PULL_LEFT = 120;
// JUNCTION_LANE_OFFSET: How far left from the lane's right edge the junction is placed (with lane)
// Higher value = junction further left from calendar, giving more space for branches
const JUNCTION_LANE_OFFSET = 80;
const JUNCTION_FOLLOW = 0.18;
const JUNCTION_TO_NODE_BLEND = 0.65;
const NODE_MARGIN = 8;

// ============================================================================
// Types
// ============================================================================
interface FloatingTopicsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  laneRef?: React.RefObject<HTMLDivElement | null>;
}

interface DragState {
  id: DefaultTopicId;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  containerRect: DOMRect;
}

interface NodePosition {
  x: number;
  y: number;
  r: number;
}

// ============================================================================
// Component
// ============================================================================
export function FloatingTopics({ containerRef, laneRef }: FloatingTopicsProps) {
  // ---------------------------------------------------------------------------
  // Store selectors (optimized - only subscribe to what we need)
  // ---------------------------------------------------------------------------
  const tasksByDay = useStore((s) => s.tasksByDay);
  const topicPositions = useStore((s) => s.topicPositions);
  const setTopicPosition = useStore((s) => s.setTopicPosition);
  const highlightedTopic = useStore((s) => s.highlightedTopic);
  const setHighlightedTopic = useStore((s) => s.setHighlightedTopic);

  // ---------------------------------------------------------------------------
  // State (minimal - only what triggers necessary re-renders)
  // ---------------------------------------------------------------------------
  const [boardSize, setBoardSize] = useState({ w: 1, h: 1, rightW: 0, laneX: 0, laneW: 0 });
  const [taskCenters, setTaskCenters] = useState<Record<string, TaskCenter>>({});

  // ---------------------------------------------------------------------------
  // Refs for imperative updates (no re-renders during drag/animation)
  // ---------------------------------------------------------------------------
  
  // Visual position of nodes (includes drag position)
  // This is the "source of truth" for rendering during drag
  const nodePosRef = useRef<Record<DefaultTopicId, NodePosition>>({} as Record<DefaultTopicId, NodePosition>);
  
  // DOM element refs for direct manipulation
  const nodeElRef = useRef<Record<DefaultTopicId, HTMLButtonElement | null>>({} as Record<DefaultTopicId, HTMLButtonElement | null>);
  
  // SVG path refs for imperative "d" updates
  const pathElRef = useRef<Record<string, SVGPathElement | null>>({});
  
  // Junction positions (current and target) - never triggers re-render
  const junctionRef = useRef<Partial<Record<DefaultTopicId, { x: number; y: number }>>>({});
  const junctionTargetRef = useRef<Partial<Record<DefaultTopicId, { y: number }>>>({});
  
  // Drag state
  const dragRef = useRef<DragState | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  
  // Junction animation RAF
  const junctionRafRef = useRef<number | null>(null);
  
  // Recalc throttling
  const recalcRafRef = useRef<number | null>(null);
  const recalcPendingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Derived data (memoized)
  // ---------------------------------------------------------------------------
  const flatTasks = useMemo(
    () => Object.values(tasksByDay).flat().filter((t) => isDefaultTopicId(t.topicId)),
    [tasksByDay]
  );

  const topicCounts = useMemo(() => {
    const counts: Partial<Record<DefaultTopicId, number>> = {};
    for (const t of flatTasks) {
      if (isDefaultTopicId(t.topicId)) {
        counts[t.topicId] = (counts[t.topicId] || 0) + 1;
      }
    }
    return counts as Record<DefaultTopicId, number>;
  }, [flatTasks]);

  const activeTopics = useMemo(() => {
    return TOPIC_IDS.filter((id) => topicCounts[id] > 0);
  }, [topicCounts]);

  // Base topic centers (from store positions + defaults)
  // This is used for initial render and as base for drag
  const baseTopicCenters = useMemo((): Partial<Record<DefaultTopicId, TopicNodeCenter>> => {
    const leftW = Math.max(0, boardSize.w - boardSize.rightW);
    const margin = 40;
    const areaH = Math.max(1, boardSize.h - margin * 2);

    // If lane is available, position bubbles within the lane
    // Otherwise, use the entire left area (mobile fallback)
    const hasLane = boardSize.laneW > 0;
    const areaX = hasLane ? boardSize.laneX : margin;
    const areaW = hasLane ? boardSize.laneW : Math.max(1, leftW - margin * 2);

    const centers: Partial<Record<DefaultTopicId, TopicNodeCenter>> = {};

    for (const id of activeTopics) {
      const count = topicCounts[id];
      const r = Math.min(65, 20 + count * 8);

      const anchor = TOPICS[id].anchor;
      const defX = areaX + anchor.xPct * areaW;
      const defY = margin + anchor.yPct * areaH;

      const pos = topicPositions[id] ?? { x: defX, y: defY };

      // Bounds depend on whether we have a lane
      const minX = hasLane ? boardSize.laneX + r + NODE_MARGIN : r + NODE_MARGIN;
      const maxX = hasLane
        ? Math.max(minX, boardSize.laneX + boardSize.laneW - r - NODE_MARGIN)
        : Math.max(minX, leftW - r - NODE_MARGIN);
      const minY = r + NODE_MARGIN;
      const maxY = Math.max(minY, boardSize.h - r - NODE_MARGIN);

      centers[id] = { x: clamp(pos.x, minX, maxX), y: clamp(pos.y, minY, maxY), r };
    }

    return centers;
  }, [activeTopics, boardSize, topicCounts, topicPositions]);

  // ---------------------------------------------------------------------------
  // Initialize/sync nodePosRef from baseTopicCenters AND update DOM
  // This fixes the resize bug where bubbles didn't move because React
  // rendered with stale nodePosRef values before useLayoutEffect ran.
  // Now we imperatively update the DOM elements directly.
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    for (const id of activeTopics) {
      const base = baseTopicCenters[id];
      if (base) {
        // Only update if not currently dragging this node
        if (!dragRef.current || dragRef.current.id !== id) {
          nodePosRef.current[id] = { x: base.x, y: base.y, r: base.r };
          
          // CRITICAL: Update DOM directly so bubbles move on resize
          const el = nodeElRef.current[id];
          if (el) {
            el.style.left = `${base.x - base.r}px`;
            el.style.top = `${base.y - base.r}px`;
            el.style.width = `${base.r * 2}px`;
            el.style.height = `${base.r * 2}px`;
          }
        }
      }
    }
  }, [activeTopics, baseTopicCenters]);

  // ---------------------------------------------------------------------------
  // Recalc with RAF throttling
  // ---------------------------------------------------------------------------
  const recalc = useCallback(() => {
    const container = containerRef?.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const aside = container.querySelector('aside');
    const asideRect = aside?.getBoundingClientRect();
    const rightW = asideRect ? asideRect.width : 0;

    // Calculate lane dimensions if available
    const lane = laneRef?.current;
    const laneRect = lane?.getBoundingClientRect();
    const laneX = laneRect ? laneRect.left - containerRect.left : 0;
    const laneW = laneRect ? laneRect.width : 0;

    setBoardSize({
      w: Math.max(1, containerRect.width),
      h: Math.max(1, containerRect.height),
      rightW,
      laneX,
      laneW,
    });

    const centers: Record<string, TaskCenter> = {};
    const taskPills = container.querySelectorAll('[data-task-id]');

    taskPills.forEach((el) => {
      const taskId = el.getAttribute('data-task-id');
      if (!taskId) return;

      const r = el.getBoundingClientRect();

      if (asideRect) {
        const isVisible =
          r.top < asideRect.bottom &&
          r.bottom > asideRect.top &&
          r.left < asideRect.right &&
          r.right > asideRect.left;
        if (!isVisible) return;
      }

      const x = r.left - containerRect.left;
      const y = r.top - containerRect.top + r.height / 2;

      if (y > 0 && y < containerRect.height && x > 0) {
        centers[taskId] = { x, y };
      }
    });

    setTaskCenters(centers);
  }, [containerRef, laneRef]);

  // Throttled recalc - max once per frame
  const scheduleRecalc = useCallback(() => {
    if (recalcPendingRef.current) return;
    recalcPendingRef.current = true;
    
    recalcRafRef.current = requestAnimationFrame(() => {
      recalcPendingRef.current = false;
      recalc();
    });
  }, [recalc]);

  // ---------------------------------------------------------------------------
  // Setup observers with throttled recalc
  // FIX: Added observation of laneRef and improved resize handling
  // The bug was that resize events weren't properly triggering recalc
  // because the ResizeObserver wasn't observing all relevant elements.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    // Initial calculation with slight delay for DOM to settle
    const initialTimeout = setTimeout(recalc, 100);
    // Second recalc for layout stabilization
    const secondTimeout = setTimeout(recalc, 300);

    const ro = new ResizeObserver(() => {
      scheduleRecalc();
    });
    
    // Observe main container
    ro.observe(container);
    
    // Observe lane if available (critical for grid layout changes)
    const lane = laneRef?.current;
    if (lane) {
      ro.observe(lane);
    }

    // Observe aside/calendar
    const aside = container.querySelector('aside');
    if (aside) {
      ro.observe(aside);
    }

    // Find tasks scroll container and observe it too
    const tasksScrollEl = container.querySelector('.tasks-scrollbar');
    if (tasksScrollEl) {
      ro.observe(tasksScrollEl);
      tasksScrollEl.addEventListener("scroll", scheduleRecalc, { passive: true });
    }

    // Also observe scroll in calendar
    const calendarScrollEl = aside?.querySelector('.overflow-y-auto') || aside;
    if (calendarScrollEl) {
      calendarScrollEl.addEventListener("scroll", scheduleRecalc, { passive: true });
    }

    // Window resize as backup
    const handleResize = () => scheduleRecalc();
    window.addEventListener("resize", handleResize);

    // Mutation observer for DOM changes (task add/remove)
    const mo = new MutationObserver(() => {
      scheduleRecalc();
    });
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
      if (recalcRafRef.current) cancelAnimationFrame(recalcRafRef.current);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", handleResize);
      if (tasksScrollEl) {
        tasksScrollEl.removeEventListener("scroll", scheduleRecalc);
      }
      if (calendarScrollEl) {
        calendarScrollEl.removeEventListener("scroll", scheduleRecalc);
      }
    };
  }, [recalc, scheduleRecalc, containerRef, laneRef]);

  useEffect(() => {
    const timeout = setTimeout(scheduleRecalc, 100);
    return () => clearTimeout(timeout);
  }, [tasksByDay, scheduleRecalc]);

  // ---------------------------------------------------------------------------
  // Get task Ys for a topic (for junction calculation)
  // ---------------------------------------------------------------------------
  const getTaskYsForTopic = useCallback(
    (topicId: DefaultTopicId): number[] => {
      const ys: number[] = [];
      for (const tasks of Object.values(tasksByDay)) {
        for (const t of tasks) {
          if (t.topicId !== topicId || !isDefaultTopicId(t.topicId)) continue;
          const c = taskCenters[t.id];
          if (!c) continue;
          ys.push(c.y);
        }
      }
      return ys;
    },
    [tasksByDay, taskCenters]
  );

  // ---------------------------------------------------------------------------
  // Update SVG paths imperatively
  // This is called from the animation loop - no setState!
  // ---------------------------------------------------------------------------
  const updateWiresImperative = useCallback(() => {
    for (const id of activeTopics) {
      const node = nodePosRef.current[id];
      if (!node) continue;

      // Collect visible tasks for this topic
      const items: Array<{ id: string; x: number; y: number }> = [];
      for (const tasks of Object.values(tasksByDay)) {
        for (const t of tasks) {
          if (t.topicId !== id || !TOPICS[t.topicId]) continue;
          const c = taskCenters[t.id];
          if (!c) continue;
          items.push({ id: t.id, x: c.x, y: c.y });
        }
      }

      if (items.length === 0) continue;

      if (items.length === 1) {
        // Single wire - direct from node to task
        const only = items[0];
        const pathKey = `single-${id}`;
        const pathEl = pathElRef.current[pathKey];
        if (pathEl) {
          pathEl.setAttribute("d", quadPath(node.x, node.y, only.x, only.y, -0.55));
        }
      } else {
        // Multiple tasks - need junction
        const j = junctionRef.current[id];
        if (!j) continue;

        // Update trunk
        const trunkKey = `trunk-${id}`;
        const trunkEl = pathElRef.current[trunkKey];
        if (trunkEl) {
          trunkEl.setAttribute("d", quadPath(node.x, node.y, j.x, j.y, -0.7));
        }
        const trunkDashKey = `trunk-dash-${id}`;
        const trunkDashEl = pathElRef.current[trunkDashKey];
        if (trunkDashEl) {
          trunkDashEl.setAttribute("d", quadPath(node.x, node.y, j.x, j.y, -0.7));
        }

        // Update branches
        for (const item of items) {
          const branchKey = `branch-${id}-${item.id}`;
          const branchEl = pathElRef.current[branchKey];
          if (branchEl) {
            branchEl.setAttribute("d", quadPath(j.x, j.y, item.x, item.y, +0.55));
          }
        }
      }
    }
  }, [activeTopics, tasksByDay, taskCenters]);

  // ---------------------------------------------------------------------------
  // Junction animation loop (runs independently, no setState per frame)
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    const leftW = Math.max(0, boardSize.w - boardSize.rightW);
    if (leftW <= 1 || boardSize.h <= 1) return;

    const hasLane = boardSize.laneW > 0;

    // Initialize/update junction X positions and targets
    for (const id of activeTopics) {
      const node = nodePosRef.current[id] || baseTopicCenters[id];
      if (!node) continue;

      // Junction should be offset from right edge of lane (or left area)
      // JUNCTION_LANE_OFFSET controls how far left the branches start from the calendar
      const xWanted = hasLane
        ? boardSize.laneX + boardSize.laneW - JUNCTION_LANE_OFFSET
        : leftW - JUNCTION_PULL_LEFT;
      const xMin = node.x + node.r + 24;
      const xMax = hasLane
        ? boardSize.laneX + boardSize.laneW - 20
        : leftW - 10;
      const x = clamp(xWanted, xMin, xMax);

      const existing = junctionRef.current[id];
      if (existing) {
        existing.x = x;
      } else {
        junctionRef.current[id] = { x, y: node.y };
      }

      const ys = getTaskYsForTopic(id);
      if (ys.length > 0) {
        const medY = median(ys);
        const targetY = clamp(
          medY * (1 - JUNCTION_TO_NODE_BLEND) + node.y * JUNCTION_TO_NODE_BLEND,
          20,
          boardSize.h - 20
        );
        junctionTargetRef.current[id] = { y: targetY };
      }
    }

    // Animation step - no setState, just update refs and DOM
    const step = () => {
      let needsMore = false;

      for (const id of activeTopics) {
        const cur = junctionRef.current[id];
        const tar = junctionTargetRef.current[id];
        if (!cur || !tar) continue;

        const ny = cur.y + (tar.y - cur.y) * JUNCTION_FOLLOW;
        if (Math.abs(ny - cur.y) > 0.05) {
          cur.y = ny;
          needsMore = true;
        } else {
          cur.y = tar.y;
        }
      }

      // Update wires imperatively
      updateWiresImperative();

      if (needsMore) {
        junctionRafRef.current = requestAnimationFrame(step);
      } else {
        junctionRafRef.current = null;
      }
    };

    // Initial wire update
    updateWiresImperative();
    
    // Start animation
    if (junctionRafRef.current) cancelAnimationFrame(junctionRafRef.current);
    junctionRafRef.current = requestAnimationFrame(step);

    return () => {
      if (junctionRafRef.current) {
        cancelAnimationFrame(junctionRafRef.current);
        junctionRafRef.current = null;
      }
    };
  }, [activeTopics, boardSize, baseTopicCenters, getTaskYsForTopic, updateWiresImperative]);

  // ---------------------------------------------------------------------------
  // Drag animation loop
  // Uses transform for GPU acceleration, no setState during drag
  // ---------------------------------------------------------------------------
  const startDragLoop = useCallback(() => {
    // This loop only updates the wires during drag
    // The node position is updated directly in pointermove for zero-lag response
    const loop = () => {
      const drag = dragRef.current;
      
      if (!drag) {
        dragRafRef.current = null;
        return;
      }

      // Update wires to follow the dragging node (wires can lag slightly, node cannot)
      updateWiresImperative();

      // Continue loop while dragging
      dragRafRef.current = requestAnimationFrame(loop);
    };

    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(loop);
  }, [updateWiresImperative]);

  const stopDragLoop = useCallback(() => {
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Pointer event handlers
  // ---------------------------------------------------------------------------
  const handlePointerDown = useCallback(
    (id: DefaultTopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const container = containerRef?.current;
      const node = nodePosRef.current[id];
      if (!container || !node) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const containerRect = container.getBoundingClientRect();
      const px = e.clientX - containerRect.left;
      const py = e.clientY - containerRect.top;

      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const hasLane = boardSize.laneW > 0;
      const minX = hasLane ? boardSize.laneX + node.r + NODE_MARGIN : node.r + NODE_MARGIN;
      const maxX = hasLane
        ? Math.max(minX, boardSize.laneX + boardSize.laneW - node.r - NODE_MARGIN)
        : Math.max(minX, leftW - node.r - NODE_MARGIN);
      const minY = node.r + NODE_MARGIN;
      const maxY = Math.max(minY, boardSize.h - node.r - NODE_MARGIN);

      // Store drag state
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        offsetX: px - node.x,
        offsetY: py - node.y,
        bounds: { minX, maxX, minY, maxY },
        containerRect,
      };

      latestPointerRef.current = { x: px, y: py };

      // Start the drag animation loop
      startDragLoop();
    },
    [containerRef, boardSize, startDragLoop]
  );

  const handlePointerMove = useCallback(
    (id: DefaultTopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      // Calculate position IMMEDIATELY on each pointer event for instant response
      // NO setState here! This is key for 60fps performance
      const px = e.clientX - drag.containerRect.left;
      const py = e.clientY - drag.containerRect.top;
      
      const { offsetX, offsetY, bounds } = drag;
      const { minX, maxX, minY, maxY } = bounds;
      
      const nx = clamp(px - offsetX, minX, maxX);
      const ny = clamp(py - offsetY, minY, maxY);

      // Update ref (source of truth)
      const currentNode = nodePosRef.current[id];
      if (currentNode) {
        currentNode.x = nx;
        currentNode.y = ny;
      }

      // Update DOM IMMEDIATELY using left/top (simpler, no transform sync issues)
      // This ensures the node follows the pointer with zero lag
      const el = nodeElRef.current[id];
      if (el && currentNode) {
        el.style.left = `${nx - currentNode.r}px`;
        el.style.top = `${ny - currentNode.r}px`;
      }

      // Update junction X to follow node immediately
      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const hasLane = boardSize.laneW > 0;
      const j = junctionRef.current[id];
      if (j && currentNode) {
        const xWanted = hasLane
          ? boardSize.laneX + boardSize.laneW - JUNCTION_LANE_OFFSET
          : leftW - JUNCTION_PULL_LEFT;
        const xMin = nx + currentNode.r + 24;
        const xMax = hasLane
          ? boardSize.laneX + boardSize.laneW - 20
          : leftW - 10;
        j.x = clamp(xWanted, xMin, xMax);
      }

      // Store for rAF loop (wires update in rAF for performance)
      latestPointerRef.current = { x: px, y: py };
    },
    [boardSize]
  );

  const handlePointerUp = useCallback(
    (id: DefaultTopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      
      if (drag && drag.id === id && drag.pointerId === e.pointerId) {
        // Stop the drag animation loop
        stopDragLoop();

        // Commit final position to store
        // The element already has the correct left/top from handlePointerMove
        const finalPos = nodePosRef.current[id];
        if (finalPos) {
          setTopicPosition(id, { x: finalPos.x, y: finalPos.y });
        }

        dragRef.current = null;
        latestPointerRef.current = null;
      }

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [setTopicPosition, stopDragLoop]
  );

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      if (junctionRafRef.current) cancelAnimationFrame(junctionRafRef.current);
      if (recalcRafRef.current) cancelAnimationFrame(recalcRafRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Build initial wire structure (keys are stable)
  // Geometry (d attribute) will be updated imperatively
  // ---------------------------------------------------------------------------
  const wireStructure = useMemo(() => {
    const structure: Array<{
      topicId: DefaultTopicId;
      color: string;
      taskIds: string[];
      isSingle: boolean;
    }> = [];

    for (const id of activeTopics) {
      const items: string[] = [];
      for (const tasks of Object.values(tasksByDay)) {
        for (const t of tasks) {
          if (t.topicId !== id || !TOPICS[t.topicId]) continue;
          if (taskCenters[t.id]) {
            items.push(t.id);
          }
        }
      }

      if (items.length > 0) {
        structure.push({
          topicId: id,
          color: TOPICS[id].color,
          taskIds: items,
          isSingle: items.length === 1,
        });
      }
    }

    return structure;
  }, [activeTopics, tasksByDay, taskCenters]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      {/* SVG Wires - structure is React-driven, geometry updated imperatively */}
      <svg
        className="absolute inset-0"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        {wireStructure.map((wire) => {
          const dim = highlightedTopic && wire.topicId !== highlightedTopic;
          const trunkOpacity = dim ? 0.08 : 0.25;
          const branchOpacity = dim ? 0.1 : 0.3;

          if (wire.isSingle) {
            return (
              <g key={wire.topicId}>
                <path
                  ref={(el) => { pathElRef.current[`single-${wire.topicId}`] = el; }}
                  d="" // Will be set imperatively
                  stroke={wire.color}
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
            <g key={wire.topicId}>
              {/* Trunk - solid */}
              <path
                ref={(el) => { pathElRef.current[`trunk-${wire.topicId}`] = el; }}
                d="" // Will be set imperatively
                stroke={wire.color}
                fill="none"
                strokeLinecap="round"
                strokeWidth={dim ? 2 : 3}
                strokeOpacity={trunkOpacity}
              />
              {/* Trunk - dashed overlay */}
              <path
                ref={(el) => { pathElRef.current[`trunk-dash-${wire.topicId}`] = el; }}
                d="" // Will be set imperatively
                stroke={wire.color}
                fill="none"
                strokeLinecap="round"
                strokeWidth={dim ? 1 : 2}
                strokeOpacity={dim ? 0.05 : 0.12}
                strokeDasharray="4 8"
              />
              {/* Branches */}
              {wire.taskIds.map((taskId) => (
                <path
                  key={taskId}
                  ref={(el) => { pathElRef.current[`branch-${wire.topicId}-${taskId}`] = el; }}
                  d="" // Will be set imperatively
                  stroke={wire.color}
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
        const base = baseTopicCenters[id];
        if (!base) return null;

        // Initialize nodePosRef if needed
        if (!nodePosRef.current[id]) {
          nodePosRef.current[id] = { x: base.x, y: base.y, r: base.r };
        }

        const node = nodePosRef.current[id];

        return (
          <button
            type="button"
            key={id}
            ref={(el) => { nodeElRef.current[id] = el; }}
            aria-label={`Mover nodo de ${TOPICS[id].name}`}
            onMouseEnter={() => setHighlightedTopic(id)}
            onMouseLeave={() => setHighlightedTopic(null)}
            onPointerDown={handlePointerDown(id)}
            onPointerMove={handlePointerMove(id)}
            onPointerUp={handlePointerUp(id)}
            onPointerCancel={handlePointerUp(id)}
            className="topic-node pointer-events-auto absolute"
            style={{
              // Position is controlled imperatively during drag via left/top
              left: node.x - node.r,
              top: node.y - node.r,
              width: node.r * 2,
              height: node.r * 2,
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
