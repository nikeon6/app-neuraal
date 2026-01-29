/**
 * UI types for the Topics feature
 * 
 * These are presentation/layout types specific to the floating
 * topic bubbles visualization. Not domain types.
 */

import type { TopicId, DefaultTopicId } from "@/shared/types";

// ============================================================================
// Topic Anchor (Default position)
// ============================================================================

/**
 * Visual anchor position for floating topic bubbles.
 * Values are percentages (0-1) relative to container.
 * 
 * Used to set default positions when topics are first rendered.
 */
export interface TopicAnchor {
  /** Horizontal position as percentage (0 = left, 1 = right) */
  readonly xPct: number;
  /** Vertical position as percentage (0 = top, 1 = bottom) */
  readonly yPct: number;
}

// ============================================================================
// Topic Position (Current UI state)
// ============================================================================

/**
 * Current position of a topic bubble in the UI (pixels).
 * This is ephemeral UI state from dragging, not persisted to backend.
 */
export interface TopicPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Map of topic positions by topic ID.
 */
export type TopicPositions = Partial<Record<TopicId, TopicPosition>>;

// ============================================================================
// Topic Bubble UI State
// ============================================================================

/**
 * Complete UI state for a topic bubble.
 * Combines domain data with visual state.
 */
export interface TopicBubbleState {
  readonly topicId: TopicId;
  readonly label: string;
  readonly count: number;
  readonly color: string;
  /** Current position (from drag or anchor) */
  readonly position: TopicPosition;
  /** Whether this bubble is currently being dragged */
  readonly isDragging: boolean;
  /** Whether this topic is highlighted (e.g., mouse hover on related task) */
  readonly isHighlighted: boolean;
}

// ============================================================================
// Junction Position (SVG Wires)
// ============================================================================

/**
 * Position for SVG wire junction points.
 * Used to draw connections from topics to entries.
 */
export interface JunctionPosition {
  readonly x: number;
  readonly y: number;
}

// ============================================================================
// Wire Bundle Types (SVG rendering)
// ============================================================================

/**
 * A single branch wire from junction to task.
 */
export interface WireBranch {
  readonly key: string;
  readonly d: string;
}

/**
 * Complete wire bundle from topic node to tasks.
 */
export interface WireBundle {
  readonly topicId: TopicId;
  readonly color: string;
  /** Main trunk path (from node to junction) */
  readonly trunk?: string;
  /** Branch paths (from junction to each task) */
  readonly branches: WireBranch[];
  /** Single direct path (when only one task) */
  readonly single?: string;
}

/**
 * Topic node center with radius for rendering.
 */
export interface TopicNodeCenter {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * Task center position for wire endpoints.
 */
export interface TaskCenter {
  readonly x: number;
  readonly y: number;
}

// ============================================================================
// Default Topic Configuration
// ============================================================================

// Re-export DefaultTopicId for convenience
export type { DefaultTopicId } from "@/shared/types";

/**
 * Configuration for default (system) topics.
 * These are the built-in topics with UI-specific anchor positioning.
 * 
 * Note: Does NOT extend Topic union to avoid type complexity.
 * This is a pure configuration type for the constants/TOPICS object.
 */
export interface DefaultTopicConfig {
  readonly id: DefaultTopicId;
  readonly name: string;
  readonly color: string;
  readonly icon?: string;
  /** Default anchor position for the floating bubble */
  readonly anchor: TopicAnchor;
}
