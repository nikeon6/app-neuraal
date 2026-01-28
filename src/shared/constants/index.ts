/**
 * Business rules and constants
 * 
 * This file contains application-wide constants and business rules
 * that are used across multiple features.
 */

import type { DefaultTopicId } from "@/shared/types";
import type { DefaultTopicConfig } from "@/features/topics/types";

// Default topics configuration with visual properties
export const TOPICS: Record<DefaultTopicId, DefaultTopicConfig> = {
  work: {
    id: "work",
    name: "Trabajo",
    color: "#e11d48",
    anchor: { xPct: 0.2, yPct: 0.25 },
  },
  health: {
    id: "health",
    name: "Salud",
    color: "#3b82f6",
    anchor: { xPct: 0.35, yPct: 0.4 },
  },
  fun: {
    id: "fun",
    name: "Ocio",
    color: "#facc15",
    anchor: { xPct: 0.5, yPct: 0.55 },
  },
  family: {
    id: "family",
    name: "Familia",
    color: "#ec4899",
    anchor: { xPct: 0.25, yPct: 0.65 },
  },
  learning: {
    id: "learning",
    name: "Aprendizaje",
    color: "#8b5cf6",
    anchor: { xPct: 0.65, yPct: 0.35 },
  },
  social: {
    id: "social",
    name: "Social",
    color: "#10b981",
    anchor: { xPct: 0.45, yPct: 0.7 },
  },
};

// Days array helper (1-31)
export const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Topic IDs list for iteration
export const TOPIC_IDS = Object.keys(TOPICS) as DefaultTopicId[];
