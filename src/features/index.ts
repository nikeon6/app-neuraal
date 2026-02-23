/**
 * Features barrel file
 *
 * Re-exports all features for easier imports.
 * Each feature is a self-contained module with its own components, hooks, and types.
 */

// Dashboard feature - main app dashboard with calendar and topics
export { Dashboard } from "./dashboard";

// Calendar feature - vertical calendar with task display
export { VerticalCalendar } from "./calendar";

// Task Editor feature - rich content task/note editor
export { TaskEditor } from "./task-editor";

// Topics feature - floating topic nodes with SVG wires
export { FloatingTopics } from "./topics";

// Layout feature - main app layout with auth protection
export { MainLayout } from "./layout";
