/**
 * Domain types for the Neuraal application
 * These are the core business entities
 */

// Topic categories for tasks
export type TopicId = "work" | "health" | "fun";

// Topic definition with visual properties
export interface Topic {
  id: TopicId;
  name: string;
  color: string;
  anchor: {
    xPct: number;
    yPct: number;
  };
}

// Task entity
export interface Task {
  id: string;
  title: string;
  topicId: TopicId;
  completed: boolean;
  createdAt: number;
}

// Note entity (from web-app)
export interface Note {
  id: string;
  content: string;
  createdAt: number;
}

// Tasks organized by day (1-31)
export type TasksByDay = Record<number, Task[]>;

// Notes organized by date string (yyyy-MM-dd)
export type NotesByDate = Record<string, Note[]>;

// Topic position for dragging
export interface TopicPosition {
  x: number;
  y: number;
}

// Junction position for SVG wires
export interface JunctionPosition {
  x: number;
  y: number;
}

// Default topics configuration
export const TOPICS: Record<TopicId, Topic> = {
  work: {
    id: "work",
    name: "Trabajo",
    color: "#e11d48",
    anchor: { xPct: 0.45, yPct: 0.25 },
  },
  health: {
    id: "health",
    name: "Salud",
    color: "#3b82f6",
    anchor: { xPct: 0.35, yPct: 0.5 },
  },
  fun: {
    id: "fun",
    name: "Ocio",
    color: "#facc15",
    anchor: { xPct: 0.28, yPct: 0.75 },
  },
};

// Days array helper
export const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
