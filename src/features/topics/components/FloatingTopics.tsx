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
import type { TopicNodeCenter, TaskCenter } from "@/features/topics/types";
import { clamp, median, quadPath, cn } from "@/shared/lib";
// Default anchor positions for topic bubbles (max 12 topics)
const DEFAULT_ANCHORS = [
  { xPct: 0.2, yPct: 0.25 },
  { xPct: 0.35, yPct: 0.4 },
  { xPct: 0.5, yPct: 0.55 },
  { xPct: 0.25, yPct: 0.65 },
  { xPct: 0.65, yPct: 0.35 },
  { xPct: 0.45, yPct: 0.7 },
  { xPct: 0.75, yPct: 0.55 },
  { xPct: 0.15, yPct: 0.45 },
  { xPct: 0.6, yPct: 0.7 },
  { xPct: 0.3, yPct: 0.15 },
  { xPct: 0.7, yPct: 0.2 },
  { xPct: 0.55, yPct: 0.15 },
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
const JUNCTION_TO_NODE_BLEND_Y_STACK = 0.4; // Blend for Y in mobile stack mode — lower = junction closer to calendar
const JUNCTION_TO_NODE_BLEND_X_STACK = 0.7; // Blend for X in mobile stack mode (how much junction X follows node)
// Min-trunk hysteresis: prevent junction from snapping to lane center when anchor is close to node
const MIN_TRUNK = 32;
const DIR_HYSTERESIS = 10;
const MIN_TRUNK_PUSH_FACTOR = 0.85;
const NODE_MARGIN = 8;
const NODE_SCALE_STACK = 0.62; // Scale factor for topic nodes in mobile stack mode

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
  topicId: string,
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
  isTouch: boolean; // Touch inputs need larger drag threshold
}

interface NodePosition {
  x: number;
  y: number;
  r: number;
}

// ============================================================================
// Pure helper functions (extracted to reduce Cognitive Complexity)
// ============================================================================

/** Wire data with nullable arrays (matches wireStructure union type). */
type WireEntry = {
  topicId: string;
  mode: string;
  dayKeys?: string[] | null;
  taskIds?: string[] | null;
};

/** Shared junction ref types. */
type JunctionMap = Partial<Record<string, { x: number; y: number }>>;
type JunctionTargetYMap = Partial<Record<string, { y: number }>>;
type JunctionTargetXMap = Partial<Record<string, { x: number }>>;
type CenterMap = Record<string, { x: number; y: number }>;

/**
 * Collect X coordinates of wire targets for a given topic.
 * Returns the Xs of either day cells or task cells, depending on wire mode.
 */
function collectWireTargetXs(
  topicId: string,
  wireStructure: WireEntry[],
  dayCenters: CenterMap,
  taskCenters: CenterMap,
): number[] {
  const wire = wireStructure.find((w) => w.topicId === topicId);
  if (!wire) return [];

  const xs: number[] = [];
  if (wire.mode === "days" && wire.dayKeys) {
    for (const key of wire.dayKeys) {
      const center = dayCenters[key];
      if (center) xs.push(center.x);
    }
  } else if (wire.mode === "tasks" && wire.taskIds) {
    for (const taskId of wire.taskIds) {
      const center = taskCenters[taskId];
      if (center) xs.push(center.x);
    }
  }
  return xs;
}

/** Compute topic node bounds within the available area. */
function computeTopicBounds(
  hasLane: boolean,
  boardSize: {
    laneX: number;
    laneW: number;
    laneTop: number;
    laneH: number;
    h: number;
  },
  leftW: number,
  r: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const minX = hasLane ? boardSize.laneX + r + NODE_MARGIN : r + NODE_MARGIN;
  const maxX = hasLane
    ? Math.max(minX, boardSize.laneX + boardSize.laneW - r - NODE_MARGIN)
    : Math.max(minX, leftW - r - NODE_MARGIN);
  const minY = hasLane ? boardSize.laneTop + r + NODE_MARGIN : r + NODE_MARGIN;
  const maxY = hasLane
    ? Math.max(minY, boardSize.laneTop + boardSize.laneH - r - NODE_MARGIN)
    : Math.max(minY, boardSize.h - r - NODE_MARGIN);
  return { minX, maxX, minY, maxY };
}

interface InitJunctionStackOpts {
  id: string;
  node: NodePosition;
  boardSize: { laneX: number; laneW: number; laneTop: number; laneH: number };
  laneBounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  junctions: {
    map: JunctionMap;
    targetX: JunctionTargetXMap;
    targetY: JunctionTargetYMap;
  };
  pushDirRef: { current: Partial<Record<string, 1 | -1>> };
  anchorX: number | null;
  medianY: number;
}

/** Update junction position for a topic in STACK layout mode (mobile). */
function initJunctionStack(opts: InitJunctionStackOpts): void {
  const {
    id,
    node,
    boardSize,
    laneBounds,
    junctions,
    pushDirRef,
    anchorX,
    medianY,
  } = opts;

  // Initialize junction only if it doesn't exist
  junctions.map[id] ??= { x: node.x, y: node.y };

  // Calculate target X (blend anchorX with node.x)
  const resolvedAnchorX = anchorX ?? boardSize.laneX + boardSize.laneW * 0.6;
  let desiredX = clamp(
    resolvedAnchorX * (1 - JUNCTION_TO_NODE_BLEND_X_STACK) +
      node.x * JUNCTION_TO_NODE_BLEND_X_STACK,
    laneBounds.xMin,
    laneBounds.xMax,
  );
  desiredX = applyMinTrunkHysteresis(
    desiredX,
    node.x,
    laneBounds.xMin,
    laneBounds.xMax,
    pushDirRef,
    id,
  );
  junctions.targetX[id] = { x: desiredX };

  // Calculate target Y (stack-specific blend)
  const targetY = clamp(
    medianY * (1 - JUNCTION_TO_NODE_BLEND_Y_STACK) +
      node.y * JUNCTION_TO_NODE_BLEND_Y_STACK,
    laneBounds.yMin,
    laneBounds.yMax,
  );
  junctions.targetY[id] = { y: targetY };
}

interface InitJunctionDesktopOpts {
  id: string;
  node: NodePosition;
  boardSize: { laneX: number; laneW: number; h: number };
  hasLane: boolean;
  leftW: number;
  junctions: { map: JunctionMap; targetY: JunctionTargetYMap };
  targetYs: number[];
}

/** Update junction position for a topic in DESKTOP GRID layout mode. */
function initJunctionDesktop(opts: InitJunctionDesktopOpts): void {
  const { id, node, boardSize, hasLane, leftW, junctions, targetYs } = opts;

  let xWanted: number, xMin: number, xMax: number;
  if (hasLane) {
    xWanted = boardSize.laneX + boardSize.laneW - JUNCTION_LANE_OFFSET;
    xMin = node.x + node.r + 24;
    xMax = boardSize.laneX + boardSize.laneW - 20;
  } else {
    xWanted = leftW - JUNCTION_PULL_LEFT;
    xMin = node.x + node.r + 24;
    xMax = leftW - 10;
  }
  const x = clamp(xWanted, xMin, xMax);

  const existing = junctions.map[id];
  if (existing) {
    existing.x = x;
  } else {
    junctions.map[id] = { x, y: node.y };
  }

  if (targetYs.length > 0) {
    const medY = median(targetYs);
    const targetY = clamp(
      medY * (1 - JUNCTION_TO_NODE_BLEND) + node.y * JUNCTION_TO_NODE_BLEND,
      20,
      boardSize.h - 20,
    );
    junctions.targetY[id] = { y: targetY };
  }
}

interface AnimateJunctionOpts {
  id: string;
  isStack: boolean;
  hasLane: boolean;
  junctions: {
    map: JunctionMap;
    targetY: JunctionTargetYMap;
    targetX: JunctionTargetXMap;
  };
  laneBounds: { xMin: number; xMax: number; yMin: number; yMax: number };
}

/** Animate junction Y (and optionally X in stack mode). Returns true if animation continues. */
function animateJunction(opts: AnimateJunctionOpts): boolean {
  const { id, isStack, hasLane, junctions, laneBounds } = opts;
  let needsMore = false;
  const cur = junctions.map[id];
  const tarY = junctions.targetY[id];
  if (!cur || !tarY) return false;

  // Animate Y
  let ny = cur.y + (tarY.y - cur.y) * JUNCTION_FOLLOW;
  if (isStack && hasLane) ny = clamp(ny, laneBounds.yMin, laneBounds.yMax);

  if (Math.abs(ny - cur.y) > 0.05) {
    cur.y = ny;
    needsMore = true;
  } else {
    cur.y = tarY.y;
  }

  // Animate X only in stack mode
  if (isStack && hasLane) {
    const tarX = junctions.targetX[id];
    if (tarX) {
      let nx = cur.x + (tarX.x - cur.x) * JUNCTION_FOLLOW;
      nx = clamp(nx, laneBounds.xMin, laneBounds.xMax);
      if (Math.abs(tarX.x - cur.x) > 0.05) {
        cur.x = nx;
        needsMore = true;
      } else {
        cur.x = tarX.x;
      }
    }
  }

  return needsMore;
}

interface DragJunctionStackOpts {
  topicId: string;
  node: NodePosition;
  j: { x: number; y: number };
  boardSize: { laneX: number; laneW: number; laneTop: number; laneH: number };
  wireStructure: WireEntry[];
  centers: { day: CenterMap; task: CenterMap };
  pushDirRef: { current: Partial<Record<string, 1 | -1>> };
  junctions: { targetX: JunctionTargetXMap; targetY: JunctionTargetYMap };
  topicMedianY: number | undefined;
  dragFollow: number;
}

/** Update drag junction for STACK layout mode (mobile). */
function updateDragJunctionStack(opts: DragJunctionStackOpts): void {
  const {
    topicId,
    node,
    j,
    boardSize,
    wireStructure,
    centers,
    pushDirRef,
    junctions,
  } = opts;
  const lanePad = 16;
  const xMin = boardSize.laneX + lanePad;
  const xMax = boardSize.laneX + boardSize.laneW - lanePad;

  const xs = collectWireTargetXs(
    topicId,
    wireStructure,
    centers.day,
    centers.task,
  );
  const anchorX =
    xs.length > 0 ? median(xs) : boardSize.laneX + boardSize.laneW * 0.6;

  let desiredX = clamp(
    anchorX * (1 - JUNCTION_TO_NODE_BLEND_X_STACK) +
      node.x * JUNCTION_TO_NODE_BLEND_X_STACK,
    xMin,
    xMax,
  );
  desiredX = applyMinTrunkHysteresis(
    desiredX,
    node.x,
    xMin,
    xMax,
    pushDirRef,
    topicId,
  );

  j.x = j.x + (desiredX - j.x) * opts.dragFollow;
  junctions.targetX[topicId] = { x: desiredX };

  const yMin = boardSize.laneTop + lanePad;
  const yMax = boardSize.laneTop + boardSize.laneH - lanePad;
  const desiredY =
    opts.topicMedianY == null
      ? clamp(boardSize.laneTop + boardSize.laneH * 0.5, yMin, yMax)
      : clamp(
          opts.topicMedianY * (1 - JUNCTION_TO_NODE_BLEND_Y_STACK) +
            node.y * JUNCTION_TO_NODE_BLEND_Y_STACK,
          yMin,
          yMax,
        );
  j.y = j.y + (desiredY - j.y) * 0.15;
  junctions.targetY[topicId] = { y: desiredY };
}

interface DragJunctionDesktopOpts {
  topicId: string;
  node: NodePosition;
  j: { x: number; y: number };
  boardH: number;
  junctionTargetY: JunctionTargetYMap;
  topicMedianY: number | undefined;
  dragFollow: number;
}

/** Update drag junction for DESKTOP GRID layout mode. */
function updateDragJunctionDesktop(opts: DragJunctionDesktopOpts): void {
  if (opts.topicMedianY == null) return;
  const desiredY = clamp(
    opts.topicMedianY * (1 - JUNCTION_TO_NODE_BLEND) +
      opts.node.y * JUNCTION_TO_NODE_BLEND,
    20,
    opts.boardH - 20,
  );
  opts.j.y = opts.j.y + (desiredY - opts.j.y) * opts.dragFollow;
  opts.junctionTargetY[opts.topicId] = { y: desiredY };
}

// ============================================================================
// Wire SVG sub-component (extracted to reduce Cognitive Complexity in render)
// ============================================================================
interface InitAllJunctionsOpts {
  activeTopics: string[];
  isStack: boolean;
  hasLane: boolean;
  boardSize: {
    w: number;
    h: number;
    rightW: number;
    laneX: number;
    laneW: number;
    laneTop: number;
    laneH: number;
  };
  leftW: number;
  laneBounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  junctions: {
    map: JunctionMap;
    targetX: JunctionTargetXMap;
    targetY: JunctionTargetYMap;
  };
  nodePos: Partial<Record<string, NodePosition>>;
  baseTopicCenters: Partial<Record<string, NodePosition>>;
  getTargetYsForTopic: (id: string) => number[];
  wireStructure: WireEntry[];
  centers: { day: CenterMap; task: CenterMap };
  pushDirRef: { current: Partial<Record<string, 1 | -1>> };
}

/** Initialize junction positions for all active topics in a single pass. */
function initAllJunctions(opts: InitAllJunctionsOpts): void {
  const {
    activeTopics,
    isStack,
    hasLane,
    boardSize,
    leftW,
    laneBounds,
    junctions,
    nodePos,
    baseTopicCenters,
    getTargetYsForTopic,
    wireStructure,
    centers,
    pushDirRef,
  } = opts;

  for (const id of activeTopics) {
    const node = nodePos[id] || baseTopicCenters[id];
    if (!node) continue;

    const ys = getTargetYsForTopic(id);

    if (isStack && hasLane) {
      const xs = collectWireTargetXs(
        id,
        wireStructure,
        centers.day,
        centers.task,
      );
      initJunctionStack({
        id,
        node,
        boardSize,
        laneBounds,
        junctions,
        pushDirRef,
        anchorX: xs.length > 0 ? median(xs) : null,
        medianY: ys.length > 0 ? median(ys) : node.y,
      });
    } else {
      initJunctionDesktop({
        id,
        node,
        boardSize,
        hasLane,
        leftW,
        junctions: { map: junctions.map, targetY: junctions.targetY },
        targetYs: ys,
      });
    }
  }
}

/** Pre-compute all dim-dependent wire visual styles to reduce ternary count. */
function computeWireStyles(dim: boolean | string | null, wireScale: number) {
  return {
    trunkW: (dim ? 2 : 3) * wireScale,
    trunkOpacity: dim ? 0.03 : 0.25,
    trunkDashW: (dim ? 1 : 2) * wireScale,
    trunkDashOpacity: dim ? 0.02 : 0.12,
    branchW: (dim ? 1 : 1.5) * wireScale,
    branchOpacity: dim ? 0.04 : 0.3,
    singleW: (dim ? 1 : 2) * wireScale,
    singleOpacity: dim ? 0.04 : 0.3,
    haloOpacity: dim ? HALO_OPACITY * 0.15 : HALO_OPACITY,
    dotOpacity: dim ? DOT_OPACITY * 0.15 : DOT_OPACITY,
  };
}

interface WireGroupProps {
  wire: {
    topicId: string;
    color: string;
    mode: string;
    isSingle?: boolean;
    dayKeys?: string[] | null;
    taskIds?: string[] | null;
  };
  dim: boolean | string | null;
  wireScale: number;
  highlightedTopic: string | null;
  isSelected: boolean;
  pathElRef: React.RefObject<Partial<Record<string, SVGPathElement | null>>>;
  haloElRef: React.RefObject<Partial<Record<string, SVGCircleElement | null>>>;
  dotElRef: React.RefObject<Partial<Record<string, SVGCircleElement | null>>>;
}

function WireGroup({
  wire,
  dim,
  wireScale,
  highlightedTopic,
  isSelected,
  pathElRef,
  haloElRef,
  dotElRef,
}: Readonly<WireGroupProps>) {
  const s = computeWireStyles(dim, wireScale);
  const branchIds =
    wire.mode === "tasks" ? (wire.taskIds ?? []) : (wire.dayKeys ?? []);

  if (wire.isSingle) {
    return (
      <g>
        <path
          ref={(el) => {
            pathElRef.current[`single-${wire.topicId}`] = el;
          }}
          d=""
          stroke={wire.color}
          fill="none"
          strokeLinecap="round"
          strokeWidth={s.singleW}
          strokeOpacity={s.singleOpacity}
          strokeDasharray="4 8"
        />
      </g>
    );
  }

  const isHot = highlightedTopic === wire.topicId;

  return (
    <g>
      <path
        ref={(el) => {
          pathElRef.current[`trunk-${wire.topicId}`] = el;
        }}
        d=""
        stroke={wire.color}
        fill="none"
        strokeLinecap="round"
        strokeWidth={s.trunkW}
        strokeOpacity={s.trunkOpacity}
      />
      <path
        ref={(el) => {
          pathElRef.current[`trunk-dash-${wire.topicId}`] = el;
        }}
        d=""
        stroke={wire.color}
        fill="none"
        strokeLinecap="round"
        strokeWidth={s.trunkDashW}
        strokeOpacity={s.trunkDashOpacity}
        strokeDasharray="4 8"
      />
      {branchIds.map((branchId) => (
        <path
          key={branchId}
          ref={(el) => {
            pathElRef.current[`branch-${wire.topicId}-${branchId}`] = el;
          }}
          d=""
          stroke={wire.color}
          fill="none"
          strokeLinecap="round"
          strokeWidth={s.branchW}
          strokeOpacity={s.branchOpacity}
          strokeDasharray="4 8"
        />
      ))}
      <circle
        ref={(el) => {
          haloElRef.current[`halo-${wire.topicId}`] = el;
        }}
        cx="0"
        cy="0"
        r="0"
        fill={wire.color}
        fillOpacity={s.haloOpacity}
        className={cn(
          "junction-halo",
          isHot && "hot",
          isSelected && "selected",
        )}
        style={{ transformOrigin: "center", pointerEvents: "none" }}
      />
      <circle
        ref={(el) => {
          dotElRef.current[`dot-${wire.topicId}`] = el;
        }}
        cx="0"
        cy="0"
        r="0"
        fill={wire.color}
        fillOpacity={s.dotOpacity}
        className={cn("junction-dot", isHot && "hot", isSelected && "selected")}
        style={{ transformOrigin: "center", pointerEvents: "none" }}
      />
    </g>
  );
}

// ============================================================================
// Component
// ============================================================================
export function FloatingTopics({
  containerRef,
  laneRef,
  entriesByDate,
}: Readonly<FloatingTopicsProps>) {
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
    w: 1,
    h: 1,
    rightW: 0,
    laneX: 0,
    laneW: 0,
    laneTop: 0,
    laneH: 0,
  });

  // Layout mode: "stack" (mobile) or "grid" (desktop)
  // In stack mode, calendar is below; in grid mode, calendar is to the right
  const layoutModeRef = useRef<"stack" | "grid">("grid");
  // State mirror of layoutModeRef for triggering re-renders (e.g., baseTopicCenters needs to recalculate)
  const [isStackLayout, setIsStackLayout] = useState(false);
  const [taskCenters, setTaskCenters] = useState<Record<string, TaskCenter>>(
    {},
  );
  // Day centers for "collapsed mode" wires (wire to day anchor instead of individual tasks)
  const [dayCenters, setDayCenters] = useState<
    Record<string, { x: number; y: number; dayNumber: number }>
  >({});

  // ---------------------------------------------------------------------------
  // Refs for imperative updates (no re-renders during drag/animation)
  // ---------------------------------------------------------------------------

  // Visual position of nodes (includes drag position)
  // This is the "source of truth" for rendering during drag
  const nodePosRef = useRef<Record<string, NodePosition>>(
    {} as Record<string, NodePosition>,
  );

  // DOM element refs for direct manipulation
  const nodeElRef = useRef<Record<string, HTMLButtonElement | null>>(
    {} as Record<string, HTMLButtonElement | null>,
  );

  // SVG path refs for imperative "d" updates
  const pathElRef = useRef<Record<string, SVGPathElement | null>>({});

  // SVG circle refs for junction dots (neuron points)
  const dotElRef = useRef<Record<string, SVGCircleElement | null>>({});
  const haloElRef = useRef<Record<string, SVGCircleElement | null>>({});

  // Junction positions (current and target) - never triggers re-render
  const junctionRef = useRef<Partial<Record<string, { x: number; y: number }>>>(
    {},
  );
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

  // ---------------------------------------------------------------------------
  // Derived data (memoized)
  // ---------------------------------------------------------------------------
  // Flatten all entries across dates, keeping only those with a known topic
  const flatEntries = useMemo(
    () =>
      Object.values(entriesByDate)
        .flat()
        .filter((e) => e.topicId && topicIdSet.has(e.topicId)),
    [entriesByDate, topicIdSet],
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
  const baseTopicCenters = useMemo((): Partial<
    Record<string, TopicNodeCenter>
  > => {
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
    const areaH = hasLane
      ? boardSize.laneH
      : Math.max(1, boardSize.h - margin * 2);

    const centers: Partial<Record<string, TopicNodeCenter>> = {};

    for (let idx = 0; idx < activeTopics.length; idx++) {
      const id = activeTopics[idx];
      const count = topicCounts[id] ?? 0;
      // Keep the same minimum size (28 for count=1), cap at 72,
      // and spread growth across 9 distinct sizes.
      const baseR = Math.min(72, 28 + (count - 1) * 5.5);
      const r = isStackLayout ? baseR * NODE_SCALE_STACK : baseR;

      // Cycle through default anchors for positioning
      const anchor = DEFAULT_ANCHORS[idx % DEFAULT_ANCHORS.length];
      const defX = areaX + anchor.xPct * areaW;
      const defY = areaTop + anchor.yPct * areaH;

      const pos = topicPositions[id] ?? { x: defX, y: defY };

      // Bounds depend on whether we have a lane (uses scaled r for correct bounds)
      const { minX, maxX, minY, maxY } = computeTopicBounds(
        hasLane,
        boardSize,
        leftW,
        r,
      );

      centers[id] = {
        x: clamp(pos.x, minX, maxX),
        y: clamp(pos.y, minY, maxY),
        r,
      };
    }

    return centers;
  }, [activeTopics, boardSize, topicCounts, topicPositions, isStackLayout]);

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
    const aside = container.querySelector("aside");
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
    const isStack =
      laneRect && asideRect && laneRect.bottom <= asideRect.top + 10;
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
    const taskPills = aside?.querySelectorAll("[data-task-id]") ?? [];

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
    const dayCenterMap: Record<
      string,
      { x: number; y: number; dayNumber: number }
    > = {};
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
        ? r.left - containerRect.left + r.width / 2 // mobile: center X
        : r.left - containerRect.left; // desktop: left edge X
      const y = isStack
        ? r.top - containerRect.top // mobile: top edge Y
        : r.top - containerRect.top + r.height / 2; // desktop: center Y

      if (y > 0 && y < containerRect.height && x > 0) {
        dayCenterMap[dateKey] = {
          x,
          y,
          dayNumber: Number.parseInt(dayNumberStr, 10),
        };
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
    const initialTimeout = setTimeout(recalc, 50);
    // Second recalc for layout stabilization
    const secondTimeout = setTimeout(recalc, 200);
    // Third recalc as a safety net for slower layout changes (orientation switch)
    const thirdTimeout = setTimeout(recalc, 500);

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
    const aside = container.querySelector("aside");
    if (aside) {
      ro.observe(aside);
    }

    // Observe tasks scroll container for size changes (task add/remove)
    // but NOT scroll — task pills we care about are inside aside, not here
    const tasksScrollEl = container.querySelector(".tasks-scrollbar");
    if (tasksScrollEl) {
      ro.observe(tasksScrollEl);
    }

    // Use event delegation with capture to listen for scroll events from ANY
    // scrollable descendant of aside. This is robust against DOM changes when
    // the calendar switches modes, because the aside
    // element itself is stable and the capture phase catches non-bubbling scroll
    // events from any child.
    if (aside) {
      aside.addEventListener("scroll", scheduleRecalc, {
        passive: true,
        capture: true,
      });
    }

    // Window resize as backup
    const handleResize = () => scheduleRecalc();
    globalThis.addEventListener("resize", handleResize);

    // Orientation change (mobile)
    globalThis.addEventListener("orientationchange", handleResize);

    // VisualViewport listeners for Android (browser bar show/hide)
    // This fixes the 100vh bug where the viewport changes without triggering resize
    const vv = globalThis.visualViewport;
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
      clearTimeout(thirdTimeout);
      if (recalcRafRef.current) cancelAnimationFrame(recalcRafRef.current);
      ro.disconnect();
      mo.disconnect();
      globalThis.removeEventListener("resize", handleResize);
      globalThis.removeEventListener("orientationchange", handleResize);
      if (vv) {
        vv.removeEventListener("resize", handleResize);
        vv.removeEventListener("scroll", handleResize);
      }
      if (aside) {
        aside.removeEventListener("scroll", scheduleRecalc, { capture: true });
      }
    };
  }, [recalc, scheduleRecalc, containerRef, laneRef]);

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
        if (
          e.topicId === topicId &&
          topicIdSet.has(e.topicId) &&
          taskCenters[e.id]
        ) {
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
              mode: "tasks" as const,
              isSingle: taskIds.length === 1,
            };
          }
          const dayKeys = getDayKeysForTopic(id);
          return dayKeys.length > 0
            ? {
                topicId: id,
                color,
                taskIds: null,
                dayKeys,
                mode: "days" as const,
                isSingle: dayKeys.length === 1,
              }
            : null;
        } else {
          const dayKeys = getDayKeysForTopic(id);
          return dayKeys.length > 0
            ? {
                topicId: id,
                color,
                taskIds: null,
                dayKeys,
                mode: "days" as const,
                isSingle: dayKeys.length === 1,
              }
            : null;
        }
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
  }, [
    activeTopics,
    entriesByDate,
    taskCenters,
    dayCenters,
    selectedTopicIds,
    topicIdSet,
    topicMap,
  ]);

  // ---------------------------------------------------------------------------
  // Cache median Y per topic - updated when wireStructure/taskCenters/dayCenters change
  // This avoids expensive scans during drag (NO per-frame computation)
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    for (const wire of wireStructure) {
      let ys: number[];

      if (wire.mode === "tasks" && wire.taskIds) {
        ys = wire.taskIds
          .map((taskId) => taskCenters[taskId]?.y)
          .filter((y): y is number => y != null);
      } else if (wire.mode === "days" && wire.dayKeys) {
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
      const wire = wireStructure.find((w) => w.topicId === topicId);
      if (!wire) return [];

      const ys: number[] = [];

      if (wire.mode === "tasks" && wire.taskIds) {
        for (const taskId of wire.taskIds) {
          const c = taskCenters[taskId];
          if (c) ys.push(c.y);
        }
      } else if (wire.mode === "days" && wire.dayKeys) {
        for (const dateKey of wire.dayKeys) {
          const c = dayCenters[dateKey];
          if (c) ys.push(c.y);
        }
      }

      return ys;
    },
    [wireStructure, taskCenters, dayCenters],
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
    r: number,
  ) => {
    if (!el) return;
    el.setAttribute("cx", String(x));
    el.setAttribute("cy", String(y));
    el.setAttribute("r", String(r));
  };

  const updateWiresForTopic = useCallback(
    (topicId: string) => {
      const wire = wireStructure.find((w) => w.topicId === topicId);
      const node = nodePosRef.current[topicId];
      if (!wire || !node) return;

      // Build items based on mode (tasks or days)
      let items: { id: string; x: number; y: number }[];

      if (wire.mode === "tasks" && wire.taskIds) {
        // Expanded mode: connect to individual tasks
        items = wire.taskIds
          .map((id) => (taskCenters[id] ? { id, ...taskCenters[id] } : null))
          .filter((item): item is NonNullable<typeof item> => item !== null);
      } else if (wire.mode === "days" && wire.dayKeys) {
        // Collapsed mode: connect to days
        items = wire.dayKeys
          .map((dateKey) =>
            dayCenters[dateKey]
              ? { id: dateKey, ...dayCenters[dateKey] }
              : null,
          )
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
        setPathD(
          `single-${topicId}`,
          quadPath(node.x, node.y, x, y, singleCurve),
        );
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
        setPathD(
          `branch-${topicId}-${id}`,
          quadPath(j.x, j.y, x, y, branchCurve),
        );
      });

      // Update junction dot position (scaled in stack mode)
      const dotR = isStack
        ? DOT_RADIUS_BASE * NODE_SCALE_STACK
        : DOT_RADIUS_BASE;
      const haloR = isStack
        ? HALO_RADIUS_BASE * NODE_SCALE_STACK
        : HALO_RADIUS_BASE;
      setCirclePos(haloElRef.current[`halo-${topicId}`], j.x, j.y, haloR);
      setCirclePos(dotElRef.current[`dot-${topicId}`], j.x, j.y, dotR);
    },
    [wireStructure, taskCenters, dayCenters],
  );

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
  useEffect(() => {
    wireStructureRef.current = wireStructure;
  }, [wireStructure]);
  useEffect(() => {
    dayCentersRef.current = dayCenters;
  }, [dayCenters]);
  useEffect(() => {
    taskCentersRef.current = taskCenters;
  }, [taskCenters]);

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

    // Shared objects for this effect's lifecycle
    const laneBounds = {
      xMin: xMinLane,
      xMax: xMaxLane,
      yMin: yMinLane,
      yMax: yMaxLane,
    };
    const junctions = {
      map: junctionRef.current,
      targetX: junctionTargetXRef.current,
      targetY: junctionTargetRef.current,
    };

    // Initialize junction positions for all active topics
    initAllJunctions({
      activeTopics,
      isStack,
      hasLane,
      boardSize,
      leftW,
      laneBounds,
      junctions,
      nodePos: nodePosRef.current,
      baseTopicCenters,
      getTargetYsForTopic,
      wireStructure: wireStructureRef.current,
      centers: { day: dayCentersRef.current, task: taskCentersRef.current },
      pushDirRef,
    });

    // Animation step - no setState, just update refs and DOM
    // IMPORTANT: animateJunction must be called for EVERY topic each frame.
    // Do NOT use ||= here — it short-circuits and skips subsequent topics.
    const step = () => {
      let needsMore = false;
      const draggingId = dragRef.current?.id;

      for (const id of activeTopics) {
        if (draggingId === id) continue;
        const animated = animateJunction({
          id,
          isStack,
          hasLane,
          junctions,
          laneBounds,
        });
        if (animated) needsMore = true;
        updateWiresForTopic(id);
      }

      junctionRafRef.current = needsMore ? requestAnimationFrame(step) : null;
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
  }, [
    activeTopics,
    boardSize,
    baseTopicCenters,
    getTargetYsForTopic,
    updateWiresImperative,
    updateWiresForTopic,
  ]);

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

        if (isStack && hasLane) {
          updateDragJunctionStack({
            topicId,
            node,
            j,
            boardSize,
            wireStructure: wireStructureRef.current,
            centers: {
              day: dayCentersRef.current,
              task: taskCentersRef.current,
            },
            pushDirRef,
            junctions: {
              targetX: junctionTargetXRef.current,
              targetY: junctionTargetRef.current,
            },
            topicMedianY: topicMedianYRef.current[topicId],
            dragFollow: DRAG_JUNCTION_FOLLOW,
          });
        } else {
          updateDragJunctionDesktop({
            topicId,
            node,
            j,
            boardH: boardSize.h,
            junctionTargetY: junctionTargetRef.current,
            topicMedianY: topicMedianYRef.current[topicId],
            dragFollow: DRAG_JUNCTION_FOLLOW,
          });
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

      // On touch devices, the previously focused editor/input can keep focus
      // after the keyboard is dismissed. Blur it before handling the bubble tap
      // to prevent mobile browsers from reopening the keyboard.
      if (e.pointerType === "touch") {
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLElement && activeEl !== e.currentTarget) {
          activeEl.blur();
        }
      }

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const containerRect = container.getBoundingClientRect();
      const px = e.clientX - containerRect.left;
      const py = e.clientY - containerRect.top;

      const leftW = Math.max(0, boardSize.w - boardSize.rightW);
      const hasLane = boardSize.laneW > 0 && boardSize.laneH > 0;
      const minX = hasLane
        ? boardSize.laneX + node.r + NODE_MARGIN
        : node.r + NODE_MARGIN;
      const maxX = hasLane
        ? Math.max(
            minX,
            boardSize.laneX + boardSize.laneW - node.r - NODE_MARGIN,
          )
        : Math.max(minX, leftW - node.r - NODE_MARGIN);
      // Y bounds: use lane bounds when available (matches baseTopicCenters; critical for mobile horizontal strip)
      const minY = hasLane
        ? boardSize.laneTop + node.r + NODE_MARGIN
        : node.r + NODE_MARGIN;
      const maxY = hasLane
        ? Math.max(
            minY,
            boardSize.laneTop + boardSize.laneH - node.r - NODE_MARGIN,
          )
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
    [containerRef, boardSize, startDragLoop],
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
          const xWanted =
            boardSize.laneX + boardSize.laneW - JUNCTION_LANE_OFFSET;
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
    [boardSize],
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

      // Remove focus from the button to prevent mobile keyboards from appearing.
      // Buttons receive focus on tap, and some Android browsers open the keyboard.
      e.currentTarget.blur();
    },
    [setTopicPosition, stopDragLoop, toggleTopicSelection, setHighlightedTopic],
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
      className="absolute inset-0 pointer-events-none landscape-mobile-hidden"
      aria-label="Topics floating layer"
      style={{ zIndex: 15, isolation: "isolate" }}
    >
      {/* SVG Wires - structure is React-driven, geometry updated imperatively */}
      <svg
        className="absolute inset-0 pointer-events-none"
        aria-label="Topics connection map"
        width="100%"
        height="100%"
        style={{ overflow: "visible" }}
      >
        {wireStructure.map((wire) => {
          const hasSelection = selectedTopicIds.length > 0;
          const isSelected = selectedTopicIds.includes(wire.topicId);
          const dim = hasSelection
            ? !isSelected
            : highlightedTopic && wire.topicId !== highlightedTopic;
          const wireScale = isStackLayout ? 0.85 : 1;

          return (
            <WireGroup
              key={wire.topicId}
              wire={wire}
              dim={dim}
              wireScale={wireScale}
              highlightedTopic={highlightedTopic}
              isSelected={isSelected}
              pathElRef={pathElRef}
              haloElRef={haloElRef}
              dotElRef={dotElRef}
            />
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
            ref={(el) => {
              nodeElRef.current[id] = el;
            }}
            aria-label={`${isSelected ? "Deselect" : "Select"} topic ${topicMap[id]?.name ?? id}`}
            aria-pressed={isSelected}
            onMouseEnter={() => {
              if (!isStackLayout) setHighlightedTopic(id);
            }}
            onMouseLeave={() => {
              if (!isStackLayout) setHighlightedTopic(null);
            }}
            onPointerDown={handlePointerDown(id)}
            onPointerMove={handlePointerMove(id)}
            onPointerUp={handlePointerUp(id)}
            onPointerCancel={handlePointerUp(id)}
            className={cn(
              "topic-node pointer-events-auto absolute",
              isSelected && "topic-node--selected",
            )}
            style={
              {
                // Position is controlled imperatively during drag via left/top
                left: node.x - node.r,
                top: node.y - node.r,
                width: node.r * 2,
                height: node.r * 2,
                // Glass bubble: semi-transparent fill + radial glow
                // Selected state gets higher opacity for a brighter look
                background: isSelected
                  ? `radial-gradient(circle at 35% 35%, ${topicMap[id]?.color ?? "#6b7280"}90, ${topicMap[id]?.color ?? "#6b7280"}55 70%)`
                  : `radial-gradient(circle at 35% 35%, ${topicMap[id]?.color ?? "#6b7280"}60, ${topicMap[id]?.color ?? "#6b7280"}35 70%)`,
                borderColor: isSelected
                  ? `${topicMap[id]?.color ?? "#6b7280"}90`
                  : `${topicMap[id]?.color ?? "#6b7280"}55`,
                // CSS custom property consumed by .topic-node box-shadow
                "--topic-glow": isSelected
                  ? `${topicMap[id]?.color ?? "#6b7280"}50`
                  : `${topicMap[id]?.color ?? "#6b7280"}28`,
                // CSS custom property for scaling font sizes with bubble radius
                "--node-r": node.r,
                touchAction: "none",
              } as React.CSSProperties
            }
            title={`${topicMap[id]?.name ?? id} (${topicCounts[id] ?? 0} entries) - Click to ${isSelected ? "deselect" : "select"}`}
          >
            <div className="topic-label">
              <div
                className={cn(
                  "topic-name",
                  !(topicMap[id]?.name ?? "").includes(" ") &&
                    "topic-name--single",
                )}
              >
                {topicMap[id]?.name ?? "?"}
              </div>
              <div className="topic-count">{topicCounts[id] ?? 0}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
