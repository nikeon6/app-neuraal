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
import type { ApiEntry } from "@/shared/api/sdk";
import { useTopicsQuery } from "@/shared/api/queries";
import type {
  TopicNodeCenter,
  TaskCenter,
} from "@/features/topics/types";
import { clamp, median, quadPath, cn } from "@/shared/lib";
// Default anchor positions for topic bubbles (cycled for > 6 topics)
const DEFAULT_ANCHORS = [
  { xPct: 0.2, yPct: 0.25 },
  { xPct: 0.35, yPct: 0.4 },
  { xPct: 0.5, yPct: 0.55 },
  { xPct: 0.25, yPct: 0.65 },
  { xPct: 0.65, yPct: 0.35 },
  { xPct: 0.45, yPct: 0.7 },
] as const;

// ============================================================================
// Configuration Constants
// ============================================================================
// JUNCTION_PULL_LEFT: How far left from the right edge the junction point is placed (no lane)
const JUNCTION_PULL_LEFT = 120;
// JUNCTION_LANE_OFFSET: How far left from the lane's right edge the junction is placed (with lane)
// Higher value = junction further left from calendar, giving more space for branches
const JUNCTION_LANE_OFFSET = 120;
const JUNCTION_FOLLOW = 0.18;
const JUNCTION_TO_NODE_BLEND = 0.65;
const JUNCTION_TO_NODE_BLEND_Y_STACK = 0.40; // Blend for Y in mobile stack mode — lower = junction closer to calendar
const JUNCTION_TO_NODE_BLEND_X_STACK = 0.70; // Blend for X in mobile stack mode (how much junction X follows node)
// Min-trunk hysteresis: prevent junction from snapping to lane center when anchor is close to node
const MIN_TRUNK = 32;
const DIR_HYSTERESIS = 10;
const MIN_TRUNK_PUSH_FACTOR = 0.85;
const NODE_MARGIN = 8;
const NODE_SCALE_STACK = 0.59; // Scale factor for topic nodes in mobile stack mode

// Junction dot (neuron point) parameters
const DOT_RADIUS_BASE = 4.5;
const HALO_RADIUS_BASE = 9;
const DOT_OPACITY = 0.95;
const HALO_OPACITY = 0.14;

/** Applies min-trunk hysteresis so junction does not snap to lane center when desiredX is close to nodeX. */
function applyMinTrunkHysteresis(
  desiredX: number,
  nodeX: number,
  xMin: number,
  xMax: number,
  pushDirRef: { current: Partial<Record<string, 1 | -1>> },
  topicId: string
): number {
  const dist = Math.abs(desiredX - nodeX);
  if (dist >= MIN_TRUNK) return clamp(desiredX, xMin, xMax);
  const dx = desiredX - nodeX;
  const prevDir = pushDirRef.current[topicId];
  let dir: 1 | -1;
  if (prevDir != null && Math.abs(dx) < DIR_HYSTERESIS) {
    dir = prevDir;
  } else if (Math.abs(dx) > 1) {
    dir = dx >= 0 ? 1 : -1;
    pushDirRef.current[topicId] = dir;
  } else {
    dir = prevDir ?? 1;
  }
  const overlap = MIN_TRUNK - dist;
  return clamp(desiredX + dir * overlap * MIN_TRUNK_PUSH_FACTOR, xMin, xMax);
}

// ============================================================================
// Types
// ============================================================================
interface FloatingTopicsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  laneRef?: React.RefObject<HTMLDivElement | null>;
  /** Entries by date (from TanStack Query, e.g. useEntriesForDates). */
  entriesByDate: Record<string, ApiEntry[]>;
  /** Compact mode for landscape mobile — smaller nodes and wires. */
  compact?: boolean;
}

interface DragState {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  containerRect: DOMRect;
  startX: number;
  startY: number;
  hasMoved: boolean; // Track if user actually dragged vs just clicked
  isTouch: boolean;  // Touch inputs need larger drag threshold
}

interface NodePosition {
  x: number;
  y: number;
  r: number;
}

// ============================================================================
// Component
// ============================================================================
export function FloatingTopics({ containerRef, laneRef, entriesByDate, compact = false }: Readonly<FloatingTopicsProps>) {
  // ---------------------------------------------------------------------------
  // Data from TanStack Query
  // ---------------------------------------------------------------------------
  const { data: topics = [] } = useTopicsQuery();

  // ---------------------------------------------------------------------------
  // Store (UI state only)
  // ---------------------------------------------------------------------------
  const topicPositions = useStore((s) => s.topicPositions);
  const setTopicPosition = useStore((s) => s.setTopicPosition);
  const highlightedTopic = useStore((s) => s.highlightedTopic);
  const setHighlightedTopic = useStore((s) => s.setHighlightedTopic);
  // Multi-selection support
  const selectedTopicIds = useStore((s) => s.selectedTopicIds);
  const toggleTopicSelection = useStore((s) => s.toggleTopicSelection);
  const _clearSelection = useStore((s) => s.clearSelection);

  // Build a lookup from API topics (equivalent to old TOPICS constant)
  const topicIdSet = useMemo(() => new Set(topics.map((t) => t.id)), [topics]);
  const topicMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    for (const t of topics) {
      map[t.id] = { name: t.name, color: t.color };
    }
    return map;
  }, [topics]);
  const topicIds = useMemo(() => topics.map((t) => t.id), [topics]);

  // ---------------------------------------------------------------------------
  // State (minimal - only what triggers necessary re-renders)
  // ---------------------------------------------------------------------------
  const [boardSize, setBoardSize] = useState({ 
    w: 1, h: 1, rightW: 0, 
    laneX: 0, laneW: 0, laneTop: 0, laneH: 0 
  });
  
  // Layout mode: "stack" (mobile) or "grid" (desktop)
  // In stack mode, calendar is below; in grid mode, calendar is to the right
  const layoutModeRef = useRef<"stack" | "grid">("grid");
  // State mirror of layoutModeRef for triggering re-renders (e.g., baseTopicCenters needs to recalculate)
  const [isStackLayout, setIsStackLayout] = useState(false);
  const [taskCenters, setTaskCenters] = useState<Record<string, TaskCenter>>({});
  // Day centers for "collapsed mode" wires (wire to day anchor instead of individual tasks)
  const [dayCenters, setDayCenters] = useState<Record<string, { x: number; y: number; dayNumber: number }>>({});

  // ---------------------------------------------------------------------------
  // Refs for imperative updates (no re-renders during drag/animation)
  // ---------------------------------------------------------------------------
  
  // Visual position of nodes (includes drag position)
  // This is the "source of truth" for rendering during drag
  const nodePosRef = useRef<Record<string, NodePosition>>({} as Record<string, NodePosition>);
  
  // DOM element refs for direct manipulation
  const nodeElRef = useRef<Record<string, HTMLButtonElement | null>>({} as Record<string, HTMLButtonElement | null>);
  
  // SVG path refs for imperative "d" updates
  const pathElRef = useRef<Record<string, SVGPathElement | null>>({});
  
  // SVG circle refs for junction dots (neuron points)
  const dotElRef = useRef<Record<string, SVGCircleElement | null>>({});
  const haloElRef = useRef<Record<string, SVGCircleElement | null>>({});
  
  // Junction positions (current and target) - never triggers re-render
  const junctionRef = useRef<Partial<Record<string, { x: number; y: number }>>>({});
  const junctionTargetRef = useRef<Partial<Record<string, { y: number }>>>({});
  const junctionTargetXRef = useRef<Partial<Record<string, { x: number }>>>({});
  
  // Drag state
  const dragRef = useRef<DragState | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  
  // Junction animation RAF
  const junctionRafRef = useRef<number | null>(null);
  
  // Refs for stable access to wireStructure/dayCenters without re-triggering effects
  const wireStructureRef = useRef<typeof wireStructure>([]);
  const dayCentersRef = useRef<typeof dayCenters>({});
  const taskCentersRef = useRef<typeof taskCenters>({});
  
  // Recalc throttling
  const recalcRafRef = useRef<number | null>(null);
  const recalcPendingRef = useRef(false);
  
  // Cached median Y per topic - avoids expensive scans during drag
  // Updated only when wireStructure/taskCenters change, NOT per frame
  const topicMedianYRef = useRef<Partial<Record<string, number>>>({});
  
  // Persistent push direction per topic (for minTrunk logic in stack mode)
  // Prevents snap/discontinuity when crossing the center of the lane
  const pushDirRef = useRef<Partial<Record<string, 1 | -1>>>({});
  
  // Compact ref for imperative callbacks
  const compactRef = useRef(compact);
  compactRef.current = compact;

  // ---------------------------------------------------------------------------
  // Derived data (memoized)
  // ---------------------------------------------------------------------------
  // Flatten all entries across dates, keeping only those with a known topic
  const flatEntries = useMemo(
    () => Object.values(entriesByDate).flat().filter((e) => e.topicId && topicIdSet.has(e.topicId)),
    [entriesByDate, topicIdSet]
  );

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of flatEntries) {
      if (e.topicId) {
        counts[e.topicId] = (counts[e.topicId] || 0) + 1;
      }
    }
    return counts;
  }, [flatEntries]);

  const activeTopics = useMemo(() => {
    return topicIds.filter((id) => (topicCounts[id] ?? 0) > 0);
  }, [topicIds, topicCounts]);

  // Base topic centers (from store positions + defaults)
  // This is used for initial render and as base for drag
  const baseTopicCenters = useMemo((): Partial<Record<string, TopicNodeCenter>> => {
    const leftW = Math.max(0, boardSize.w - boardSize.rightW);
    const margin = 20;

    // If lane is available, position bubbles within the lane
    // In mobile: lane is horizontal (small height), in desktop: lane is vertical (full height)
    const hasLane = boardSize.laneW > 0 && boardSize.laneH > 0;
    
    // X bounds: use lane width if available
    const areaX = hasLane ? boardSize.laneX : margin;
    const areaW = hasLane ? boardSize.laneW : Math.max(1, leftW - margin * 2);
    
    // Y bounds: use lane height if available (critical for mobile horizontal lane)
    const areaTop = hasLane ? boardSize.laneTop : margin;
    const areaH = hasLane ? boardSize.laneH : Math.max(1, boardSize.h - margin * 2);

    const centers: Partial<Record<string, TopicNodeCenter>> = {};

    for (let idx = 0; idx < activeTopics.length; idx++) {
      const id = activeTopics[idx];
      const count = topicCounts[id] ?? 0;
      // Scale radius down in mobile stack mode or compact (landscape) for smaller bubbles
      const baseR = Math.min(65, 20 + count * 8);
      const r = (isStackLayout || compact) ? baseR * NODE_SCALE_STACK : baseR;

      // Cycle through default anchors for positioning
      const anchor = DEFAULT_ANCHORS[idx % DEFAULT_ANCHORS.length];
      const defX = areaX + anchor.xPct * areaW;
      const defY = areaTop + anchor.yPct * areaH;

      const pos = topicPositions[id] ?? { x: defX, y: defY };

      // Bounds depend on whether we have a lane (uses scaled r for correct bounds)
      const minX = hasLane ? boardSize.laneX + r + NODE_MARGIN : r + NODE_MARGIN;
      const maxX = hasLane
        ? Math.max(minX, boardSize.laneX + boardSize.laneW - r - NODE_MARGIN)
        : Math.max(minX, leftW - r - NODE_MARGIN);
      
      // Y bounds: confine to lane area (mobile horizontal lane or desktop vertical lane)
      const minY = hasLane 
        ? boardSize.laneTop + r + NODE_MARGIN 
        : r + NODE_MARGIN;
      const maxY = hasLane
        ? Math.max(minY, boardSize.laneTop + boardSize.laneH - r - NODE_MARGIN)
        : Math.max(minY, boardSize.h - r - NODE_MARGIN);

      centers[id] = { x: clamp(pos.x, minX, maxX), y: clamp(pos.y, minY, maxY), r };
    }

    return centers;
  }, [activeTopics, boardSize, topicCounts, topicPositions, isStackLayout, compact]);

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

    // Calculate lane dimensions if available (including top/height for mobile horizontal lane)
    const lane = laneRef?.current;
    const laneRect = lane?.getBoundingClientRect();
    const laneX = laneRect ? laneRect.left - containerRect.left : 0;
    const laneW = laneRect ? laneRect.width : 0;
    const laneTop = laneRect ? laneRect.top - containerRect.top : 0;
    const laneH = laneRect ? laneRect.height : 0;

    // Detect layout mode: stack (mobile) vs grid (desktop)
    // In stack mode, aside is below the lane; in grid mode, aside is to the right
    // We detect this by checking if lane's bottom edge is above the aside's top edge
    const isStack = laneRect && asideRect && laneRect.bottom <= asideRect.top + 10;
    layoutModeRef.current = isStack ? "stack" : "grid";
    // Update state to trigger re-renders (e.g., baseTopicCenters recalculation for node scaling)
    setIsStackLayout(!!isStack);

    setBoardSize({
      w: Math.max(1, containerRect.width),
      h: Math.max(1, containerRect.height),
      rightW,
      laneX,
      laneW,
      laneTop,
      laneH,
    });

    // Measure task pills from VerticalCalendar (inside aside ONLY, not TasksContainer)
    const taskCenterMap: Record<string, TaskCenter> = {};
    const taskPills = aside?.querySelectorAll('[data-task-id]') ?? [];

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
    // Works for both desktop (vertical scroll) and mobile (horizontal scroll)
    const dayCenterMap: Record<string, { x: number; y: number; dayNumber: number }> = {};
    const dayAnchors = aside?.querySelectorAll('[data-day-anchor="true"]');

    dayAnchors?.forEach((el) => {
      const dateKey = (el as HTMLElement).dataset.dateKey;
      const dayNumberStr = (el as HTMLElement).dataset.dayNumber;
      if (!dateKey || !dayNumberStr) return;

      const r = el.getBoundingClientRect();

      // Check visibility within aside (both vertical AND horizontal for mobile)
      if (asideRect) {
        const isVisible =
          r.top < asideRect.bottom &&
          r.bottom > asideRect.top &&
          r.left < asideRect.right &&
          r.right > asideRect.left;
        if (!isVisible) return;
      }

      // Anchor point depends on layout mode:
      // Desktop (grid): LEFT EDGE X, center Y — branches arrive from the left of the calendar
      // Mobile (stack): center X, TOP EDGE Y — branches arrive from the top of the calendar
      const x = isStack
        ? r.left - containerRect.left + r.width / 2   // mobile: center X
        : r.left - containerRect.left;                 // desktop: left edge X
      const y = isStack
        ? r.top - containerRect.top                    // mobile: top edge Y
        : r.top - containerRect.top + r.height / 2;   // desktop: center Y

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

    // Observe tasks scroll container for size changes (task add/remove)
    // but NOT scroll — task pills we care about are inside aside, not here
    const tasksScrollEl = container.querySelector('.tasks-scrollbar');
    if (tasksScrollEl) {
      ro.observe(tasksScrollEl);
    }

    // Observe scroll in ALL scrollable children of aside (desktop vertical, mobile horizontal, compact vertical)
    // Query by computed overflow style to be Tailwind-version-agnostic
    const calendarScrollEls: Element[] = [];
    if (aside) {
      aside.querySelectorAll('*').forEach((el) => {
        const style = getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' ||
            style.overflowX === 'auto' || style.overflowX === 'scroll') {
          calendarScrollEls.push(el);
        }
      });
      // Fallback: listen on aside itself
      if (calendarScrollEls.length === 0) {
        calendarScrollEls.push(aside);
      }
    }
    for (const el of calendarScrollEls) {
      el.addEventListener("scroll", scheduleRecalc, { passive: true });
    }

    // Window resize as backup
    const handleResize = () => scheduleRecalc();
    window.addEventListener("resize", handleResize);

    // Orientation change (mobile)
    window.addEventListener("orientationchange", handleResize);

    // VisualViewport listeners for Android (browser bar show/hide)
    // This fixes the 100vh bug where the viewport changes without triggering resize
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleResize);
      vv.addEventListener("scroll", handleResize);
    }

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
      window.removeEventListener("orientationchange", handleResize);
      if (vv) {
        vv.removeEventListener("resize", handleResize);
        vv.removeEventListener("scroll", handleResize);
      }
      for (const el of calendarScrollEls) {
        el.removeEventListener("scroll", scheduleRecalc);
      }
    };
  }, [recalc, scheduleRecalc, containerRef, laneRef, compact]);

  useEffect(() => {
    const timeout = setTimeout(scheduleRecalc, 100);
    return () => clearTimeout(timeout);
  }, [entriesByDate, scheduleRecalc]);

  // Recalc when selection changes (task pills appear/disappear in panel)
  useEffect(() => {
    // Small delay to let DOM update with new task pills
    const timeout = setTimeout(scheduleRecalc, 50);
    return () => clearTimeout(timeout);
  }, [selectedTopicIds, scheduleRecalc]);

  // ---------------------------------------------------------------------------
  // Build wire structure EARLY (needed by updateWiresImperative)
  // Keys are stable, geometry (d attribute) updated imperatively
  // 
  // MODE: Collapsed (default) - wires connect to days (1 wire per day with tasks)
  // MODE: Selected (multi-select) - selected topics use wires to individual tasks in panel
  // ---------------------------------------------------------------------------
  const wireStructure = useMemo(() => {
    // Helper: collect visible entry IDs for a topic (for selected mode)
    const getEntryIdsForTopic = (topicId: string): string[] => {
      const ids: string[] = [];
      const allEntries = Object.values(entriesByDate).flat();
      for (const e of allEntries) {
        if (e.topicId === topicId && topicIdSet.has(e.topicId) && taskCenters[e.id]) {
          ids.push(e.id);
        }
      }
      return ids;
    };

    // Helper: collect visible day keys for a topic (for collapsed mode)
    const getDayKeysForTopic = (topicId: string): string[] => {
      const dayKeys: string[] = [];
      const seen = new Set<string>();

      for (const [dateKey, entries] of Object.entries(entriesByDate)) {
        if (seen.has(dateKey)) continue;
        const hasEntry = entries.some((e) => e.topicId === topicId);
        if (!hasEntry) continue;

        // Only include days that have a measured center
        if (dayCenters[dateKey]) {
          dayKeys.push(dateKey);
          seen.add(dateKey);
        }
      }
      return dayKeys;
    };

    return activeTopics
      .map((id) => {
        const color = topicMap[id]?.color ?? "#6b7280";
        const isSelected = selectedTopicIds.includes(id);
        
        if (isSelected) {
          const taskIds = getEntryIdsForTopic(id);
          if (taskIds.length > 0) {
            return { 
              topicId: id, 
              color, 
              taskIds, 
              dayKeys: null,
              mode: 'tasks' as const,
              isSingle: taskIds.length === 1 
            };
          }
          const dayKeys = getDayKeysForTopic(id);
          return dayKeys.length > 0
            ? { topicId: id, color, taskIds: null, dayKeys, mode: 'days' as const, isSingle: dayKeys.length === 1 }
            : null;
        } else {
          const dayKeys = getDayKeysForTopic(id);
          return dayKeys.length > 0
            ? { topicId: id, color, taskIds: null, dayKeys, mode: 'days' as const, isSingle: dayKeys.length === 1 }
            : null;
        }
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
  }, [activeTopics, entriesByDate, taskCenters, dayCenters, selectedTopicIds, topicIdSet, topicMap]);

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
    (topicId: string): number[] => {
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

  const updateWiresForTopic = useCallback((topicId: string) => {
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

    // Curvature varies by layout mode:
    // - Stack (mobile): softer curves since wires go downward to calendar below
    // - Grid (desktop): sharper curves for horizontal wires to calendar on right
    const isStack = layoutModeRef.current === "stack";
    const singleCurve = isStack ? -0.35 : -0.55;
    const trunkCurve = isStack ? -0.45 : -0.7;
    const branchCurve = isStack ? +0.35 : +0.55;

    // Single wire - direct from node to target
    if (items.length === 1) {
      const { x, y } = items[0];
      setPathD(`single-${topicId}`, quadPath(node.x, node.y, x, y, singleCurve));
      return;
    }

    // Multiple targets - need junction
    const j = junctionRef.current[topicId];
    if (!j) return;

    // Update trunk paths
    const trunkPath = quadPath(node.x, node.y, j.x, j.y, trunkCurve);
    setPathD(`trunk-${topicId}`, trunkPath);
    setPathD(`trunk-dash-${topicId}`, trunkPath);

    // Update branch paths
    items.forEach(({ id, x, y }) => {
      setPathD(`branch-${topicId}-${id}`, quadPath(j.x, j.y, x, y, branchCurve));
    });

    // Update junction dot position (scaled in stack/compact mode)
    const shouldScale = isStack || compactRef.current;
    const dotR = shouldScale ? DOT_RADIUS_BASE * NODE_SCALE_STACK : DOT_RADIUS_BASE;
    const haloR = shouldScale ? HALO_RADIUS_BASE * NODE_SCALE_STACK : HALO_RADIUS_BASE;
    setCirclePos(haloElRef.current[`halo-${topicId}`], j.x, j.y, haloR);
    setCirclePos(dotElRef.current[`dot-${topicId}`], j.x, j.y, dotR);
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
  // Update wires when taskCenters or dayCenters change (scroll, resize, etc.)
  // This ensures wires follow the calendar scroll
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    updateWiresImperative();
  }, [taskCenters, dayCenters, updateWiresImperative]);

  // ---------------------------------------------------------------------------
  // Keep refs in sync for stable access without re-triggering junction effect
  // ---------------------------------------------------------------------------
  useEffect(() => { wireStructureRef.current = wireStructure; }, [wireStructure]);
  useEffect(() => { dayCentersRef.current = dayCenters; }, [dayCenters]);
  useEffect(() => { taskCentersRef.current = taskCenters; }, [taskCenters]);

  // ---------------------------------------------------------------------------
  // Junction animation loop (runs independently, no setState per frame)
  // Handles both desktop (grid) and mobile (stack) layouts
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    const leftW = Math.max(0, boardSize.w - boardSize.rightW);
    if (boardSize.w <= 1 || boardSize.h <= 1) return;

    const hasLane = boardSize.laneW > 0 && boardSize.laneH > 0;
    const isStack = layoutModeRef.current === "stack";
    
    // Lane padding for stack mode
    const lanePad = 16;
    const xMinLane = boardSize.laneX + lanePad;
    const xMaxLane = boardSize.laneX + boardSize.laneW - lanePad;
    
    // Y bounds for stack mode
    const yMinLane = boardSize.laneTop + lanePad;
    const yMaxLane = boardSize.laneTop + boardSize.laneH - lanePad;

    // Helper: get anchor X (median of target Xs) for a topic
    const getAnchorX = (topicId: string): number | null => {
      const wire = wireStructureRef.current.find(w => w.topicId === topicId);
      if (!wire) return null;
      
      const xs: number[] = [];
      if (wire.mode === 'days' && wire.dayKeys) {
        for (const key of wire.dayKeys) {
          const center = dayCentersRef.current[key];
          if (center) xs.push(center.x);
        }
      } else if (wire.mode === 'tasks' && wire.taskIds) {
        for (const taskId of wire.taskIds) {
          const center = taskCentersRef.current[taskId];
          if (center) xs.push(center.x);
        }
      }
      return xs.length > 0 ? median(xs) : null;
    };

    // Initialize/update junction positions and targets
    for (const id of activeTopics) {
      const node = nodePosRef.current[id] || baseTopicCenters[id];
      if (!node) continue;

      if (isStack && hasLane) {
        // ===== MOBILE STACK =====
        // Initialize junction only if it doesn't exist (don't reset on every render!)
        if (!junctionRef.current[id]) {
          junctionRef.current[id] = { x: node.x, y: node.y };
        }
        
        // Calculate target X (blend anchorX with node.x) and store in targetXRef
        const anchorX = getAnchorX(id) ?? (boardSize.laneX + boardSize.laneW * 0.6);
        let desiredX = clamp(
          anchorX * (1 - JUNCTION_TO_NODE_BLEND_X_STACK) + node.x * JUNCTION_TO_NODE_BLEND_X_STACK,
          xMinLane,
          xMaxLane
        );
        desiredX = applyMinTrunkHysteresis(desiredX, node.x, xMinLane, xMaxLane, pushDirRef, id);

        junctionTargetXRef.current[id] = { x: desiredX };
        
        // Calculate target Y (use stack-specific blend to push junction closer to calendar)
        const ys = getTargetYsForTopic(id);
        const medY = ys.length > 0 ? median(ys) : node.y;
        const targetY = clamp(
          medY * (1 - JUNCTION_TO_NODE_BLEND_Y_STACK) + node.y * JUNCTION_TO_NODE_BLEND_Y_STACK,
          yMinLane,
          yMaxLane
        );
        junctionTargetRef.current[id] = { y: targetY };
        
      } else {
        // ===== DESKTOP GRID / FALLBACK =====
        let xWanted: number;
        let xMin: number;
        let xMax: number;

        if (hasLane) {
          // DESKTOP GRID: Junction X near right edge of lane (before calendar)
          xWanted = boardSize.laneX + boardSize.laneW - JUNCTION_LANE_OFFSET;
          xMin = node.x + node.r + 24;
          xMax = boardSize.laneX + boardSize.laneW - 20;
        } else {
          // FALLBACK: No lane, use leftW
          xWanted = leftW - JUNCTION_PULL_LEFT;
          xMin = node.x + node.r + 24;
          xMax = leftW - 10;
        }

        const x = clamp(xWanted, xMin, xMax);

        const existing = junctionRef.current[id];
        if (existing) {
          existing.x = x;
        } else {
          junctionRef.current[id] = { x, y: node.y };
        }

        // Calculate target Y
        const ys = getTargetYsForTopic(id);
        if (ys.length > 0) {
          const medY = median(ys);
          const minY = 20;
          const maxY = boardSize.h - 20;
          
          const targetY = clamp(
            medY * (1 - JUNCTION_TO_NODE_BLEND) + node.y * JUNCTION_TO_NODE_BLEND,
            minY,
            maxY
          );
          junctionTargetRef.current[id] = { y: targetY };
        }
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
        const tarY = junctionTargetRef.current[id];
        if (!cur || !tarY) continue;

        // Animate Y
        let ny = cur.y + (tarY.y - cur.y) * JUNCTION_FOLLOW;
        if (isStack && hasLane) {
          ny = clamp(ny, yMinLane, yMaxLane);
        }
        if (Math.abs(ny - cur.y) > 0.05) {
          cur.y = ny;
          needsMore = true;
        } else {
          cur.y = tarY.y;
        }

        // Animate X only in stack mode (desktop X is set directly above)
        if (isStack && hasLane) {
          const tarX = junctionTargetXRef.current[id];
          if (tarX) {
            let nx = cur.x + (tarX.x - cur.x) * JUNCTION_FOLLOW;
            nx = clamp(nx, xMinLane, xMaxLane);
            if (Math.abs(tarX.x - cur.x) > 0.05) {
              cur.x = nx;
              needsMore = true;
            } else {
              cur.x = tarX.x;
            }
          }
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
  // Respects mobile/desktop layout bounds
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

      // Update junction position in rAF for stable timing
      // - DESKTOP (grid): animate Y (vertical follow), X stays near calendar
      // - MOBILE (stack): animate X (horizontal follow), Y stays centered in lane
      if (node && j) {
        const isStack = layoutModeRef.current === "stack";
        const hasLane = boardSize.laneH > 0 && boardSize.laneW > 0;
        const lanePad = 16;
        
        if (isStack && hasLane) {
          // ===== MOBILE STACK: Junction X follows node (like Y does in desktop) =====
          const xMin = boardSize.laneX + lanePad;
          const xMax = boardSize.laneX + boardSize.laneW - lanePad;
          
          // Get median X of anchor targets
          const wire = wireStructureRef.current.find(w => w.topicId === topicId);
          const xs: number[] = [];
          if (wire?.mode === 'days' && wire.dayKeys) {
            for (const key of wire.dayKeys) {
              const c = dayCentersRef.current[key];
              if (c) xs.push(c.x);
            }
          } else if (wire?.mode === 'tasks' && wire.taskIds) {
            for (const taskId of wire.taskIds) {
              const c = taskCentersRef.current[taskId];
              if (c) xs.push(c.x);
            }
          }
          const anchorX = xs.length > 0 ? median(xs) : (boardSize.laneX + boardSize.laneW * 0.6);
          
          // Blend anchor X with node X (junction follows the node)
          let desiredX = clamp(
            anchorX * (1 - JUNCTION_TO_NODE_BLEND_X_STACK) + node.x * JUNCTION_TO_NODE_BLEND_X_STACK,
            xMin,
            xMax
          );
          desiredX = applyMinTrunkHysteresis(desiredX, node.x, xMin, xMax, pushDirRef, topicId);

          // Smooth interpolation for X
          j.x = j.x + (desiredX - j.x) * DRAG_JUNCTION_FOLLOW;
          
          // Keep target X in sync so it persists when drag ends
          junctionTargetXRef.current[topicId] = { x: desiredX };
          
          // Y: keep stable in center of lane (don't jump around)
          const yMin = boardSize.laneTop + lanePad;
          const yMax = boardSize.laneTop + boardSize.laneH - lanePad;
          const medY = topicMedianYRef.current[topicId];
          const desiredY = medY != null 
            ? clamp(medY * (1 - JUNCTION_TO_NODE_BLEND_Y_STACK) + node.y * JUNCTION_TO_NODE_BLEND_Y_STACK, yMin, yMax)
            : clamp(boardSize.laneTop + boardSize.laneH * 0.5, yMin, yMax);
          j.y = j.y + (desiredY - j.y) * 0.15; // Slower Y easing in stack
          
          // Keep target Y in sync too
          junctionTargetRef.current[topicId] = { y: desiredY };
          
        } else {
          // ===== DESKTOP GRID: Junction Y follows node (original behavior) =====
          const medY = topicMedianYRef.current[topicId];
          if (medY != null) {
            const minY = 20;
            const maxY = boardSize.h - 20;
            
            const desiredY = clamp(
              medY * (1 - JUNCTION_TO_NODE_BLEND) + node.y * JUNCTION_TO_NODE_BLEND,
              minY,
              maxY
            );
            // Smooth interpolation for natural feel
            j.y = j.y + (desiredY - j.y) * DRAG_JUNCTION_FOLLOW;
            // Keep target in sync for when drag ends
            junctionTargetRef.current[topicId] = { y: desiredY };
          }
        }
      }

      // Update wires for ONLY the dragged topic (not all topics)
      updateWiresForTopic(topicId);

      // Continue loop while dragging
      dragRafRef.current = requestAnimationFrame(loop);
    };

    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(loop);
  }, [boardSize, updateWiresForTopic]);

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
    (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const container = containerRef?.current;
      const node = nodePosRef.current[id];
      if (!container || !node) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const containerRect = container.getBoundingClientRect();
      const px = e.clientX - containerRect.left;
      const py = e.clientY - containerRect.top;

      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const hasLane = boardSize.laneW > 0 && boardSize.laneH > 0;
      const minX = hasLane ? boardSize.laneX + node.r + NODE_MARGIN : node.r + NODE_MARGIN;
      const maxX = hasLane
        ? Math.max(minX, boardSize.laneX + boardSize.laneW - node.r - NODE_MARGIN)
        : Math.max(minX, leftW - node.r - NODE_MARGIN);
      // Y bounds: use lane bounds when available (matches baseTopicCenters; critical for mobile horizontal strip)
      const minY = hasLane
        ? boardSize.laneTop + node.r + NODE_MARGIN
        : node.r + NODE_MARGIN;
      const maxY = hasLane
        ? Math.max(minY, boardSize.laneTop + boardSize.laneH - node.r - NODE_MARGIN)
        : Math.max(minY, boardSize.h - node.r - NODE_MARGIN);

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
        isTouch: e.pointerType === "touch",
      };

      latestPointerRef.current = { x: px, y: py };

      // Start the drag animation loop
      startDragLoop();
    },
    [containerRef, boardSize, startDragLoop]
  );

  const handlePointerMove = useCallback(
    (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (drag?.id !== id || drag?.pointerId !== e.pointerId) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      // Calculate position IMMEDIATELY on each pointer event for instant response
      // NO setState here! This is key for 60fps performance
      const px = e.clientX - drag.containerRect.left;
      const py = e.clientY - drag.containerRect.top;

      // Check if user has moved enough to be considered a drag
      // Touch inputs need a larger threshold (15px) because finger taps are imprecise
      const dragThreshold = drag.isTouch ? 15 : 5;
      const dx = Math.abs(px - drag.startX);
      const dy = Math.abs(py - drag.startY);
      if (dx > dragThreshold || dy > dragThreshold) {
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

      // Update junction X (only in DESKTOP/FALLBACK - stack X is animated in startDragLoop)
      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const hasLane = boardSize.laneW > 0 && boardSize.laneH > 0;
      const isStack = layoutModeRef.current === "stack";
      const j = junctionRef.current[id];
      
      if (j && currentNode) {
        // MOBILE STACK: j.x is animated in startDragLoop rAF for smooth following
        // Don't set j.x here to avoid fighting with the rAF loop
        if (isStack && hasLane) {
          // Let startDragLoop handle junction position
          // Just store node position for the loop to use (already done above)
        } else if (hasLane) {
          // DESKTOP GRID: j.x stays near calendar edge
          const xWanted = boardSize.laneX + boardSize.laneW - JUNCTION_LANE_OFFSET;
          const xMin = nx + currentNode.r + 24;
          const xMax = boardSize.laneX + boardSize.laneW - 20;
          j.x = clamp(xWanted, xMin, xMax);
        } else {
          // FALLBACK: no lane
          const xWanted = leftW - JUNCTION_PULL_LEFT;
          const xMin = nx + currentNode.r + 24;
          const xMax = leftW - 10;
          j.x = clamp(xWanted, xMin, xMax);
        }
        // NOTE: junction.y is updated in startDragLoop rAF for stable timing
      }

      // Store pointer position (used for debugging if needed)
      latestPointerRef.current = { x: px, y: py };
    },
    [boardSize]
  );

  const handlePointerUp = useCallback(
    (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
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
          // User just clicked (no movement), toggle selection (multi-select)
          toggleTopicSelection(id);
        }

        // On touch, clear highlightedTopic since onMouseLeave doesn't fire reliably
        // This prevents the dimming logic from keeping the last tapped topic "highlighted"
        if (drag.isTouch) {
          setHighlightedTopic(null);
        }

        dragRef.current = null;
        latestPointerRef.current = null;
      }

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [setTopicPosition, stopDragLoop, toggleTopicSelection, setHighlightedTopic]
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
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 15 }}
    >
      {/* SVG Wires - structure is React-driven, geometry updated imperatively */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        {wireStructure.map((wire) => {
          // Dimming logic:
          // - If there's a selection, dim topics NOT in selection
          // - If no selection but hover, dim topics NOT being hovered
          const hasSelection = selectedTopicIds.length > 0;
          const isSelected = selectedTopicIds.includes(wire.topicId);
          const dim = hasSelection
            ? !isSelected
            : (highlightedTopic && wire.topicId !== highlightedTopic);
          
          // When dimmed, make wires almost invisible (0.02-0.04) to focus on highlighted/selected topic
          const trunkOpacity = dim ? 0.03 : 0.25;
          const branchOpacity = dim ? 0.04 : 0.3;
          
          // Scale stroke widths in stack mode for proportional visuals
          const wireScale = (isStackLayout || compact) ? 0.85 : 1;
          
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
                  strokeWidth={(dim ? 1 : 2) * wireScale}
                  strokeOpacity={dim ? 0.04 : 0.3}
                  strokeDasharray="4 8"
                />
              </g>
            );
          }

          // Check if this topic is highlighted/selected for visual feedback
          const isHot = highlightedTopic === wire.topicId;

          return (
            <g key={wire.topicId}>
              {/* Trunk - solid */}
              <path
                ref={(el) => { pathElRef.current[`trunk-${wire.topicId}`] = el; }}
                d="" // Will be set imperatively
                stroke={wire.color}
                fill="none"
                strokeLinecap="round"
                strokeWidth={(dim ? 2 : 3) * wireScale}
                strokeOpacity={trunkOpacity}
              />
              {/* Trunk - dashed overlay */}
              <path
                ref={(el) => { pathElRef.current[`trunk-dash-${wire.topicId}`] = el; }}
                d="" // Will be set imperatively
                stroke={wire.color}
                fill="none"
                strokeLinecap="round"
                strokeWidth={(dim ? 1 : 2) * wireScale}
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
                  strokeWidth={(dim ? 1 : 1.5) * wireScale}
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
                  isSelected && "selected"
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
                  isSelected && "selected"
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

        const isSelected = selectedTopicIds.includes(id);

        return (
          <button
            type="button"
            key={id}
            ref={(el) => { nodeElRef.current[id] = el; }}
            aria-label={`${isSelected ? 'Deselect' : 'Select'} topic ${topicMap[id]?.name ?? id}`}
            aria-pressed={isSelected}
            onMouseEnter={() => { if (!isStackLayout) setHighlightedTopic(id); }}
            onMouseLeave={() => { if (!isStackLayout) setHighlightedTopic(null); }}
            onPointerDown={handlePointerDown(id)}
            onPointerMove={handlePointerMove(id)}
            onPointerUp={handlePointerUp(id)}
            onPointerCancel={handlePointerUp(id)}
            className={cn(
              "topic-node pointer-events-auto absolute",
              isSelected && "ring-2 ring-white/50 ring-offset-2 ring-offset-transparent"
            )}
            style={{
              // Position is controlled imperatively during drag via left/top
              left: node.x - node.r,
              top: node.y - node.r,
              width: node.r * 2,
              height: node.r * 2,
              background: topicMap[id]?.color ?? "#6b7280",
              touchAction: "none",
            }}
            title={`${topicMap[id]?.name ?? id} (${topicCounts[id] ?? 0} entries) - Click to ${isSelected ? 'deselect' : 'select'}`}
          >
            <div className="topic-label">
              <div className="topic-name">{topicMap[id]?.name ?? "?"}</div>
              <div className="topic-count">{topicCounts[id] ?? 0}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
