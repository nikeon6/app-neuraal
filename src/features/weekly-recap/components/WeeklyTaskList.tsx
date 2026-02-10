"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, CalendarDays, Tag, ListFilter } from "lucide-react";
import { cn } from "@/shared/lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyTask {
  id: string;
  title: string;
  topicName: string | null;
  topicColor: string | null;
  completed: boolean;
  dayLabel: string;
  dateKey: string;
}

type FilterMode = "day" | "topic" | "status";

interface GroupedTasks {
  key: string;
  label: string;
  color?: string | null;
  tasks: WeeklyTask[];
}

export interface WeeklyTaskListProps {
  readonly tasks: readonly WeeklyTask[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTERS: { id: FilterMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "day", label: "By Day", icon: CalendarDays },
  { id: "topic", label: "By Topic", icon: Tag },
  { id: "status", label: "By Status", icon: ListFilter },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByDay(tasks: readonly WeeklyTask[]): GroupedTasks[] {
  const map = new Map<string, WeeklyTask[]>();
  for (const t of tasks) {
    const existing = map.get(t.dateKey);
    if (existing) {
      existing.push(t);
    } else {
      map.set(t.dateKey, [t]);
    }
  }
  return Array.from(map.entries()).map(([dateKey, items]) => ({
    key: dateKey,
    label: items[0].dayLabel,
    tasks: items,
  }));
}

function groupByTopic(tasks: readonly WeeklyTask[]): GroupedTasks[] {
  const map = new Map<string, { color: string | null; tasks: WeeklyTask[] }>();
  for (const t of tasks) {
    const topicKey = t.topicName ?? "No Topic";
    const existing = map.get(topicKey);
    if (existing) {
      existing.tasks.push(t);
    } else {
      map.set(topicKey, { color: t.topicColor, tasks: [t] });
    }
  }
  return Array.from(map.entries()).map(([name, { color, tasks: items }]) => ({
    key: name,
    label: name,
    color,
    tasks: items,
  }));
}

function groupByStatus(tasks: readonly WeeklyTask[]): GroupedTasks[] {
  const completed: WeeklyTask[] = [];
  const pending: WeeklyTask[] = [];

  for (const t of tasks) {
    if (t.completed) {
      completed.push(t);
    } else {
      pending.push(t);
    }
  }

  const groups: GroupedTasks[] = [];
  if (completed.length > 0) {
    groups.push({ key: "completed", label: "Completed", tasks: completed });
  }
  if (pending.length > 0) {
    groups.push({ key: "pending", label: "Pending", tasks: pending });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WeeklyTaskList — filterable list of all tasks for the current week.
 *
 * Supports grouping by day, topic, or completion status.
 * Each task shows its title, topic color dot, and completion icon.
 */
export function WeeklyTaskList({ tasks }: WeeklyTaskListProps) {
  const [filter, setFilter] = useState<FilterMode>("day");

  const groups = useMemo(() => {
    switch (filter) {
      case "day":
        return groupByDay(tasks);
      case "topic":
        return groupByTopic(tasks);
      case "status":
        return groupByStatus(tasks);
    }
  }, [tasks, filter]);

  return (
    <div className="glass-panel rounded-2xl p-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-white/80 tracking-wide">
          Week Tasks
        </h3>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                aria-label={f.label}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  "border backdrop-blur-sm",
                  isActive
                    ? "bg-sky-500/15 border-sky-400/30 text-sky-300 shadow-[0_0_8px_-2px_rgba(56,189,248,0.2)]"
                    : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/70"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="text-center text-white/30 text-sm py-8">
          No tasks this week
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {groups.map((group) => (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-2">
                    {group.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                    )}
                    {filter === "status" && (
                      group.key === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                      )
                    )}
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-white/25 font-medium">
                      {group.tasks.length}
                    </span>
                  </div>

                  {/* Task cards */}
                  <div className="space-y-1.5">
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                          "bg-white/[0.03] border border-white/[0.05]",
                          "hover:bg-white/[0.06] hover:border-white/[0.08]",
                          task.completed && "opacity-70"
                        )}
                      >
                        {/* Status icon */}
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />
                        )}

                        {/* Title */}
                        <span
                          className={cn(
                            "text-sm flex-1 truncate",
                            task.completed
                              ? "text-white/50 line-through decoration-white/20"
                              : "text-white/90"
                          )}
                        >
                          {task.title}
                        </span>

                        {/* Topic pill */}
                        {task.topicName && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              data-testid="topic-dot"
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: task.topicColor ?? "#6b7280" }}
                            />
                            <span className="text-[11px] text-white/40 font-medium">
                              {task.topicName}
                            </span>
                          </div>
                        )}

                        {/* Day badge (when not grouping by day) */}
                        {filter !== "day" && (
                          <span className="text-[10px] text-white/25 font-medium flex-shrink-0">
                            {task.dayLabel.slice(0, 3)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
