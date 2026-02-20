"use client";

import React, { useMemo } from "react";
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns";
import { useStore } from "@/shared/store";
import { useEntriesForDates, useTopicsQuery } from "@/shared/api/queries";
import type { ApiEntry, ApiTopic } from "@/shared/api/sdk";
import { CompletionDonutChart } from "./CompletionDonutChart";
import { TopicBubbleChart, type TopicBubbleData } from "./TopicBubbleChart";
import { DailyBarChart, type DailyBarData } from "./DailyBarChart";
import { WeeklyTaskList, type WeeklyTask } from "./WeeklyTaskList";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a map of topicId → topic for fast lookups. */
function buildTopicMap(topics: ApiTopic[]): Map<string, ApiTopic> {
  const map = new Map<string, ApiTopic>();
  for (const t of topics) {
    map.set(t.id, t);
  }
  return map;
}

/** Get only tasks (exclude notes) from the entries. */
function filterTasks(entries: ApiEntry[]): ApiEntry[] {
  return entries.filter((e) => e.type === "task");
}

/** Calculate topic distribution data for the bubble chart. */
function computeTopicDistribution(
  tasks: ApiEntry[],
  topicMap: Map<string, ApiTopic>,
): TopicBubbleData[] {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const topicId = task.topicId ?? "__none__";
    counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
  }

  const total = tasks.length || 1;

  return Array.from(counts.entries()).map(([topicId, count]) => {
    const topic = topicMap.get(topicId);
    return {
      topicId,
      name: topic?.name ?? "No Topic",
      color: topic?.color ?? "#6b7280",
      count,
      percentage: Math.round((count / total) * 100),
    };
  });
}

/** Build per-day bar chart data. */
function computeDailyBars(
  weekDates: Date[],
  entriesByDate: Record<string, ApiEntry[]>,
): DailyBarData[] {
  return weekDates.map((date, i) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const tasks = filterTasks(entriesByDate[dateKey] ?? []);
    const completed = tasks.filter((t) => t.completed).length;
    return {
      day: DAY_SHORT[i],
      label: DAY_LABELS[i],
      completed,
      pending: tasks.length - completed,
    };
  });
}

/** Build the flat list of WeeklyTask items. */
function computeWeeklyTasks(
  weekDates: Date[],
  entriesByDate: Record<string, ApiEntry[]>,
  topicMap: Map<string, ApiTopic>,
): WeeklyTask[] {
  const result: WeeklyTask[] = [];

  for (let i = 0; i < weekDates.length; i++) {
    const dateKey = format(weekDates[i], "yyyy-MM-dd");
    const tasks = filterTasks(entriesByDate[dateKey] ?? []);

    for (const task of tasks) {
      const topic = task.topicId ? topicMap.get(task.topicId) : null;
      result.push({
        id: task.id,
        title: task.title,
        topicName: topic?.name ?? null,
        topicColor: topic?.color ?? null,
        completed: task.completed ?? false,
        dayLabel: DAY_LABELS[i],
        dateKey,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WeeklyRecap — main container for the weekly recap section.
 *
 * Fetches entries for the 7 days of the current week (Mon-Sun)
 * and renders three charts + a filterable task list.
 */
export function WeeklyRecap() {
  const selectedDate = useStore((s) => s.selectedDate);
  const { data: topics = [] } = useTopicsQuery();

  // Calculate the week range (Mon — Sun)
  const weekDates = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  const weekDateKeys = useMemo(
    () => weekDates.map((d) => format(d, "yyyy-MM-dd")),
    [weekDates],
  );

  // Fetch entries for the whole week
  const { entriesByDate, isPending } = useEntriesForDates(weekDateKeys);

  // Build derived data
  const topicMap = useMemo(() => buildTopicMap(topics), [topics]);

  const allTasks = useMemo(() => {
    const all: ApiEntry[] = [];
    for (const dateKey of weekDateKeys) {
      all.push(...filterTasks(entriesByDate[dateKey] ?? []));
    }
    return all;
  }, [entriesByDate, weekDateKeys]);

  const completedCount = useMemo(
    () => allTasks.filter((t) => t.completed).length,
    [allTasks],
  );
  const pendingCount = allTasks.length - completedCount;

  const topicData = useMemo(
    () => computeTopicDistribution(allTasks, topicMap),
    [allTasks, topicMap],
  );

  const dailyBars = useMemo(
    () => computeDailyBars(weekDates, entriesByDate),
    [weekDates, entriesByDate],
  );

  const weeklyTasks = useMemo(
    () => computeWeeklyTasks(weekDates, entriesByDate, topicMap),
    [weekDates, entriesByDate, topicMap],
  );

  // Loading state
  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/15 border-t-sky-400 rounded-full animate-spin" />
          <span className="text-sm text-white/40">Loading weekly data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4 overflow-y-auto custom-scrollbar tasks-scroll-fade max-h-full">
      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TopicBubbleChart data={topicData} />
        <CompletionDonutChart
          completed={completedCount}
          pending={pendingCount}
        />
        <DailyBarChart data={dailyBars} />
      </div>

      {/* Task list */}
      <WeeklyTaskList tasks={weeklyTasks} />
    </div>
  );
}
