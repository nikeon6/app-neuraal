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
import { clamp, median, quadPath, isDefaultTopicId, cn } from "@/shared/lib";

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

// Junction dot (neuron point) parameters
const DOT_RADIUS_BASE = 4.5;
const HALO_RADIUS_BASE = 9;
const DOT_OPACITY = 0.95;
const HALO_OPACITY = 0.14;

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
  startX: number;
  startY: number;
  hasMoved: boolean; // Track if user actually dragged vs just clicked
}

interface NodePosition {
  x: number;
  y: number;
  r: number;
}

// ============================================================================
// Component
// ============================================================================
export function FloatingTopics({ containerRef, laneRef }: Readonly<FloatingTopicsProps>) {
  // ---------------------------------------------------------------------------
  // Store selectors (optimized - only subscribe to what we need)
  // ---------------------------------------------------------------------------
  const tasksByDay = useStore((s) => s.tasksByDay);
  const topicPositions = useStore((s) => s.topicPositions);
  const setTopicPosition = useStore((s) => s.setTopicPosition);
  const highlightedTopic = useStore((s) => s.highlightedTopic);
  const setHighlightedTopic = useStore((s) => s.setHighlightedTopic);
  const expandedTopicId = useStore((s) => s.expandedTopicId);
  const toggleExpandedTopic = useStore((s) => s.toggleExpandedTopic);

  // ---------------------------------------------------------------------------
  // State (minimal - only what triggers necessary re-renders)
  // ---------------------------------------------------------------------------
  const [boardSize, setBoardSize] = useState({ w: 1, h: 1, rightW: 0, laneX: 0, laneW: 0 });
  const [taskCenters, setTaskCenters] = useState<Record<string, TaskCenter>>({});
  // Day centers for "collapsed mode" wires (wire to day anchor instead of individual tasks)
  const [dayCenters, setDayCenters] = useState<Record<string, { x: number; y: number; dayNumber: number }>>({});

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
  
  // SVG circle refs for junction dots (neuron points)
  const dotElRef = useRef<Record<string, SVGCircleElement | null>>({});
  const haloElRef = useRef<Record<string, SVGCircleElement | null>>({});
  
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
  
  // Cached median Y per topic - avoids expensive scans during drag
  // Updated only when wireStructure/taskCenters change, NOT per frame
  const topicMedianYRef = useRef<Partial<Record<DefaultTopicId, number>>>({});

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
        if (dragRef.current?.id !== id) {
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

    // Measure task pills (for expanded mode - wire to tasks)
    const taskCenterMap: Record<string, TaskCenter> = {};
    const taskPills = container.querySelectorAll('[data-task-id]');

    taskPills.forEach((el) => {
      const taskId = (el as HTMLElement).dataset.taskId;
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
        taskCenterMap[taskId] = { x, y };
      }
    });

    setTaskCenters(taskCenterMap);

    // Measure day anchors (for collapsed mode - wire to days)
    const dayCenterMap: Record<string, { x: number; y: number; dayNumber: number }> = {};
    const dayAnchors = aside?.querySelectorAll('[data-day-anchor="true"]');

    dayAnchors?.forEach((el) => {
      const dateKey = (el as HTMLElement).dataset.dateKey;
      const dayNumberStr = (el as HTMLElement).dataset.dayNumber;
      if (!dateKey || !dayNumberStr) return;

      const r = el.getBoundingClientRect();

      // Check visibility within aside
      if (asideRect) {
        const isVisible =
          r.top < asideRect.bottom &&
          r.bottom > asideRect.top;
        if (!isVisible) return;
      }

      // Anchor point: left edge of day row, vertically centered
      const x = r.left - containerRect.left;
      const y = r.top - containerRect.top + r.height / 2;

      if (y > 0 && y < containerRect.height && x > 0) {
        dayCenterMap[dateKey] = { x, y, dayNumber: Number.parseInt(dayNumberStr, 10) };
      }
    });

    setDayCenters(dayCenterMap);
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

  // Recalc when expandedTopicId changes (task pills appear/disappear)
  useEffect(() => {
    // Small delay to let DOM update with new task pills
    const timeout = setTimeout(scheduleRecalc, 50);
    return () => clearTimeout(timeout);
  }, [expandedTopicId, scheduleRecalc]);

  // ---------------------------------------------------------------------------
  // Build wire structure EARLY (needed by updateWiresImperative)
  // Keys are stable, geometry (d attribute) updated imperatively
  // 
  // MODE: Collapsed (default) - wires connect to days (1 wire per day with tasks)
  // MODE: Expanded - only the expanded topic uses wires to individual tasks
  // ---------------------------------------------------------------------------
  const wireStructure = useMemo(() => {
    // Helper: collect visible task IDs for a topic (for expanded mode)
    const getTaskIdsForTopic = (topicId: DefaultTopicId): string[] => {
      const ids: string[] = [];
      const allTasks = Object.values(tasksByDay).flat();
      for (const t of allTasks) {
        if (t.topicId === topicId && TOPICS[t.topicId] && taskCenters[t.id]) {
          ids.push(t.id);
        }
      }
      return ids;
    };

    // Helper: collect visible day keys for a topic (for collapsed mode)
    const getDayKeysForTopic = (topicId: DefaultTopicId): string[] => {
      const dayKeys: string[] = [];
      const seenDays = new Set<number>();
      
      for (const [dayStr, tasks] of Object.entries(tasksByDay)) {
        const dayNumber = Number.parseInt(dayStr, 10);
        if (seenDays.has(dayNumber)) continue;
        
        // Check if this day has tasks for this topic
        const hasTopicTask = tasks.some((t) => t.topicId === topicId);
        if (!hasTopicTask) continue;

        // Find the dateKey for this dayNumber in dayCenters
        for (const [dateKey, center] of Object.entries(dayCenters)) {
          if (center.dayNumber === dayNumber) {
            dayKeys.push(dateKey);
            seenDays.add(dayNumber);
            break;
          }
        }
      }
      return dayKeys;
    };

    return activeTopics
      .map((id) => {
        const isExpanded = id === expandedTopicId;
        
        if (isExpanded) {
          // Expanded mode: wire to individual tasks
          const taskIds = getTaskIdsForTopic(id);
          return taskIds.length > 0
            ? { 
                topicId: id, 
                color: TOPICS[id].color, 
                taskIds, 
                dayKeys: null,
                mode: 'tasks' as const,
                isSingle: taskIds.length === 1 
              }
            : null;
        } else {
          // Collapsed mode: wire to days
          const dayKeys = getDayKeysForTopic(id);
          return dayKeys.length > 0
            ? { 
                topicId: id, 
                color: TOPICS[id].color, 
                taskIds: null, 
                dayKeys,
                mode: 'days' as const,
                isSingle: dayKeys.length === 1 
              }
            : null;
        }
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
  }, [activeTopics, tasksByDay, taskCenters, dayCenters, expandedTopicId]);

  // ---------------------------------------------------------------------------
  // Cache median Y per topic - updated when wireStructure/taskCenters/dayCenters change
  // This avoids expensive scans during drag (NO per-frame computation)
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    for (const wire of wireStructure) {
      let ys: number[];
      
      if (wire.mode === 'tasks' && wire.taskIds) {
        ys = wire.taskIds
          .map((taskId) => taskCenters[taskId]?.y)
          .filter((y): y is number => y != null);
      } else if (wire.mode === 'days' && wire.dayKeys) {
        ys = wire.dayKeys
          .map((dateKey) => dayCenters[dateKey]?.y)
          .filter((y): y is number => y != null);
      } else {
        continue;
      }
      
      if (ys.length > 0) {
        topicMedianYRef.current[wire.topicId] = median(ys);
      }
    }
  }, [wireStructure, taskCenters, dayCenters]);

  // ---------------------------------------------------------------------------
  // Get target Ys for a topic (for junction calculation) - used in non-drag contexts
  // Returns task Ys for expanded topic, day Ys for collapsed topics
  // ---------------------------------------------------------------------------
  const getTargetYsForTopic = useCallback(
    (topicId: DefaultTopicId): number[] => {
      const wire = wireStructure.find(w => w.topicId === topicId);
      if (!wire) return [];

      const ys: number[] = [];
      
      if (wire.mode === 'tasks' && wire.taskIds) {
        for (const taskId of wire.taskIds) {
          const c = taskCenters[taskId];
          if (c) ys.push(c.y);
        }
      } else if (wire.mode === 'days' && wire.dayKeys) {
        for (const dateKey of wire.dayKeys) {
          const c = dayCenters[dateKey];
          if (c) ys.push(c.y);
        }
      }
      
      return ys;
    },
    [wireStructure, taskCenters, dayCenters]
  );

  // ---------------------------------------------------------------------------
  // Update SVG paths for a SINGLE topic - used during drag for performance
  // Only updates paths for the specified topic, no iteration over all topics
  // ---------------------------------------------------------------------------
  // Helper: update a single SVG path element
  const setPathD = (key: string, d: string) => {
    pathElRef.current[key]?.setAttribute("d", d);
  };

  // Helper: update junction dot circle attributes
  const setCirclePos = (
    el: SVGCircleElement | null | undefined,
    x: number,
    y: number,
    r: number
  ) => {
    if (!el) return;
    el.setAttribute("cx", String(x));
    el.setAttribute("cy", String(y));
    el.setAttribute("r", String(r));
  };

  const updateWiresForTopic = useCallback((topicId: DefaultTopicId) => {
    const wire = wireStructure.find(w => w.topicId === topicId);
    const node = nodePosRef.current[topicId];
    if (!wire || !node) return;

    // Build items based on mode (tasks or days)
    let items: { id: string; x: number; y: number }[];
    
    if (wire.mode === 'tasks' && wire.taskIds) {
      // Expanded mode: connect to individual tasks
      items = wire.taskIds
        .map((id) => (taskCenters[id] ? { id, ...taskCenters[id] } : null))
        .filter((item): item is NonNullable<typeof item> => item !== null);
    } else if (wire.mode === 'days' && wire.dayKeys) {
      // Collapsed mode: connect to days
      items = wire.dayKeys
        .map((dateKey) => (dayCenters[dateKey] ? { id: dateKey, ...dayCenters[dateKey] } : null))
        .filter((item): item is NonNullable<typeof item> => item !== null);
    } else {
      return;
    }

    if (items.length === 0) return;

    // Single wire - direct from node to target
    if (items.length === 1) {
      const { x, y } = items[0];
      setPathD(`single-${topicId}`, quadPath(node.x, node.y, x, y, -0.55));
      return;
    }

    // Multiple targets - need junction
    const j = junctionRef.current[topicId];
    if (!j) return;

    // Update trunk paths
    const trunkPath = quadPath(node.x, node.y, j.x, j.y, -0.7);
    setPathD(`trunk-${topicId}`, trunkPath);
    setPathD(`trunk-dash-${topicId}`, trunkPath);

    // Update branch paths
    items.forEach(({ id, x, y }) => {
      setPathD(`branch-${topicId}-${id}`, quadPath(j.x, j.y, x, y, +0.55));
    });

    // Update junction dot position
    setCirclePos(haloElRef.current[`halo-${topicId}`], j.x, j.y, HALO_RADIUS_BASE);
    setCirclePos(dotElRef.current[`dot-${topicId}`], j.x, j.y, DOT_RADIUS_BASE);
  }, [wireStructure, taskCenters, dayCenters]);

  // ---------------------------------------------------------------------------
  // Update ALL SVG paths - used for global updates (mount, layout changes)
  // Calls updateWiresForTopic for each topic
  // ---------------------------------------------------------------------------
  const updateWiresImperative = useCallback(() => {
    for (const wire of wireStructure) {
      updateWiresForTopic(wire.topicId);
    }
  }, [wireStructure, updateWiresForTopic]);

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

      const ys = getTargetYsForTopic(id);
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
    // SKIP topic being dragged to avoid conflict with drag loop
    const step = () => {
      let needsMore = false;
      const draggingId = dragRef.current?.id;

      for (const id of activeTopics) {
        // Skip the topic being dragged - drag loop handles it
        if (draggingId === id) continue;

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

        // Update wires for this topic only
        updateWiresForTopic(id);
      }

      if (needsMore) {
        junctionRafRef.current = requestAnimationFrame(step);
      } else {
        junctionRafRef.current = null;
      }
    };

    // Initial wire update for all topics
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
  }, [activeTopics, boardSize, baseTopicCenters, getTargetYsForTopic, updateWiresImperative, updateWiresForTopic]);

  // ---------------------------------------------------------------------------
  // Drag animation loop - updates ONLY the dragged topic
  // Junction.y is updated HERE (not in pointermove) for stable timing
  // ---------------------------------------------------------------------------
  const DRAG_JUNCTION_FOLLOW = 0.35; // Faster easing during drag for responsiveness

  const startDragLoop = useCallback(() => {
    const loop = () => {
      const drag = dragRef.current;
      
      if (!drag) {
        dragRafRef.current = null;
        return;
      }

      const topicId = drag.id;
      const node = nodePosRef.current[topicId];
      const j = junctionRef.current[topicId];

      // Update junction.Y in rAF for stable timing (moved from pointermove)
      if (node && j) {
        const medY = topicMedianYRef.current[topicId];
        if (medY != null) {
          const desiredY = clamp(
            medY * (1 - JUNCTION_TO_NODE_BLEND) + node.y * JUNCTION_TO_NODE_BLEND,
            20,
            boardSize.h - 20
          );
          // Smooth interpolation for natural feel
          j.y = j.y + (desiredY - j.y) * DRAG_JUNCTION_FOLLOW;
          // Keep target in sync for when drag ends
          junctionTargetRef.current[topicId] = { y: desiredY };
        }
      }

      // Update wires for ONLY the dragged topic (not all topics)
      updateWiresForTopic(topicId);

      // Continue loop while dragging
      dragRafRef.current = requestAnimationFrame(loop);
    };

    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(loop);
  }, [boardSize.h, updateWiresForTopic]);

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
        startX: px,
        startY: py,
        hasMoved: false,
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
      if (drag?.id !== id || drag?.pointerId !== e.pointerId) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      // Calculate position IMMEDIATELY on each pointer event for instant response
      // NO setState here! This is key for 60fps performance
      const px = e.clientX - drag.containerRect.left;
      const py = e.clientY - drag.containerRect.top;

      // Check if user has moved enough to be considered a drag (5px threshold)
      const dx = Math.abs(px - drag.startX);
      const dy = Math.abs(py - drag.startY);
      if (dx > 5 || dy > 5) {
        drag.hasMoved = true;
      }
      
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

      // Update junction X only (Y is updated in rAF loop for stable timing)
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
        // NOTE: junction.y is updated in startDragLoop rAF for stable timing
      }

      // Store pointer position (used for debugging if needed)
      latestPointerRef.current = { x: px, y: py };
    },
    [boardSize]
  );

  const handlePointerUp = useCallback(
    (id: DefaultTopicId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      
      if (drag?.id === id && drag?.pointerId === e.pointerId) {
        // Stop the drag animation loop
        stopDragLoop();

        // If user actually dragged, commit position; otherwise toggle expanded state
        if (drag.hasMoved) {
          // Commit final position to store
          // The element already has the correct left/top from handlePointerMove
          const finalPos = nodePosRef.current[id];
          if (finalPos) {
            setTopicPosition(id, { x: finalPos.x, y: finalPos.y });
          }
        } else {
          // User just clicked (no movement), toggle expanded state
          toggleExpandedTopic(id);
        }

        dragRef.current = null;
        latestPointerRef.current = null;
      }

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [setTopicPosition, stopDragLoop, toggleExpandedTopic]
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
          // When dimmed, make wires almost invisible (0.02-0.04) to focus on highlighted topic
          const trunkOpacity = dim ? 0.03 : 0.25;
          const branchOpacity = dim ? 0.04 : 0.3;
          
          // Get the branch IDs based on mode
          const branchIds = wire.mode === 'tasks' ? (wire.taskIds || []) : (wire.dayKeys || []);

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
                  strokeOpacity={dim ? 0.04 : 0.3}
                  strokeDasharray="4 8"
                />
              </g>
            );
          }

          // Check if this topic is highlighted/expanded for visual feedback
          const isHot = highlightedTopic === wire.topicId;
          const isExpanded = expandedTopicId === wire.topicId;

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
                strokeOpacity={dim ? 0.02 : 0.12}
                strokeDasharray="4 8"
              />
              {/* Branches - to tasks or days depending on mode */}
              {branchIds.map((branchId) => (
                <path
                  key={branchId}
                  ref={(el) => { pathElRef.current[`branch-${wire.topicId}-${branchId}`] = el; }}
                  d="" // Will be set imperatively
                  stroke={wire.color}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={dim ? 1 : 1.5}
                  strokeOpacity={branchOpacity}
                  strokeDasharray="4 8"
                />
              ))}
              {/* Junction dot (neuron point) - rendered LAST to be on top */}
              {/* Halo (glow effect - cheaper than filter) */}
              <circle
                ref={(el) => { haloElRef.current[`halo-${wire.topicId}`] = el; }}
                cx="0" cy="0" r="0" // Will be set imperatively
                fill={wire.color}
                fillOpacity={dim ? HALO_OPACITY * 0.15 : HALO_OPACITY}
                className={cn(
                  "junction-halo",
                  isHot && "hot",
                  isExpanded && "expanded"
                )}
                style={{ transformOrigin: "center", pointerEvents: "none" }}
              />
              {/* Dot (solid center) */}
              <circle
                ref={(el) => { dotElRef.current[`dot-${wire.topicId}`] = el; }}
                cx="0" cy="0" r="0" // Will be set imperatively
                fill={wire.color}
                fillOpacity={dim ? DOT_OPACITY * 0.15 : DOT_OPACITY}
                className={cn(
                  "junction-dot",
                  isHot && "hot",
                  isExpanded && "expanded"
                )}
                style={{ transformOrigin: "center", pointerEvents: "none" }}
              />
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

        const isExpanded = expandedTopicId === id;

        return (
          <button
            type="button"
            key={id}
            ref={(el) => { nodeElRef.current[id] = el; }}
            aria-label={`${isExpanded ? 'Colapsar' : 'Expandir'} nodo de ${TOPICS[id].name}`}
            aria-pressed={isExpanded}
            onMouseEnter={() => setHighlightedTopic(id)}
            onMouseLeave={() => setHighlightedTopic(null)}
            onPointerDown={handlePointerDown(id)}
            onPointerMove={handlePointerMove(id)}
            onPointerUp={handlePointerUp(id)}
            onPointerCancel={handlePointerUp(id)}
            className={cn(
              "topic-node pointer-events-auto absolute",
              isExpanded && "ring-2 ring-white/40 ring-offset-2 ring-offset-transparent"
            )}
            style={{
              // Position is controlled imperatively during drag via left/top
              left: node.x - node.r,
              top: node.y - node.r,
              width: node.r * 2,
              height: node.r * 2,
              background: TOPICS[id].color,
              touchAction: "none",
            }}
            title={`${TOPICS[id].name} (${topicCounts[id]} tareas) - Click para ${isExpanded ? 'colapsar' : 'expandir'}`}
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
