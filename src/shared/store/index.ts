import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";
import type { TopicPosition, TopicPositions } from "@/features/topics/types";
import type { ISODate } from "@/shared/types";
import type { ApiEntry } from "@/shared/api/sdk";

// ============================================================================
// Helper: Get unique topic IDs from entries in expanded days (exported for UI)
// ============================================================================
export function getTopicIdsFromExpandedDays(
  expandedDayKeys: ISODate[],
  entriesByDate: Record<string, ApiEntry[]>
): string[] {
  const topicIds = new Set<string>();
  for (const dateKey of expandedDayKeys) {
    const entries = entriesByDate[dateKey] || [];
    for (const entry of entries) {
      if (entry.topicId) topicIds.add(entry.topicId);
    }
  }
  return Array.from(topicIds);
}

// ============================================================================
// Store Types
// ============================================================================

export type DashboardSection =
  | "daily"
  | "weeklyRecap"
  | "stickies"
  | "topics"
  | "settings";

/**
 * Global application state (UI only).
 * Topics and entries come from TanStack Query (useTopicsQuery, useEntriesByDateQuery).
 */
interface AppState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;

  selectedDate: Date;
  selectedDay: number;
  setSelectedDate: (date: Date) => void;
  setSelectedDay: (day: number) => void;

  topicPositions: TopicPositions;
  setTopicPosition: (topicId: string, position: TopicPosition) => void;

  highlightedTopic: string | null;
  setHighlightedTopic: (topicId: string | null) => void;

  selectedTopicIds: string[];
  selectedTopicIdsManual: string[];
  expandedDayKeys: ISODate[];
  toggleTopicSelection: (topicId: string) => void;
  setSelectedTopics: (topicIds: string[]) => void;
  expandDay: (dateKey: ISODate, entriesByDate: Record<string, ApiEntry[]>) => void;
  collapseDay: (dateKey: ISODate, entriesByDate: Record<string, ApiEntry[]>) => void;
  clearExpandedDays: () => void;
  clearSelection: () => void;

  dashboardSection: DashboardSection;
  setDashboardSection: (section: DashboardSection) => void;

  /** Entry ID to scroll to in TasksContainer (set by navigation, cleared after scroll) */
  scrollToEntryId: string | null;
  setScrollToEntryId: (entryId: string | null) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      login: () => set({ isAuthenticated: true }),
      logout: () => set({ isAuthenticated: false }),

      selectedDate: new Date(),
      selectedDay: new Date().getDate(),
      setSelectedDate: (date) =>
        set({ selectedDate: date, selectedDay: date.getDate() }),
      setSelectedDay: (day) => set({ selectedDay: day }),

      topicPositions: {},
      setTopicPosition: (topicId, position) =>
        set((state) => ({
          topicPositions: { ...state.topicPositions, [topicId]: position },
        })),

      highlightedTopic: null,
      setHighlightedTopic: (topicId) => set({ highlightedTopic: topicId }),

      selectedTopicIds: [],
      selectedTopicIdsManual: [],
      expandedDayKeys: [],

      toggleTopicSelection: (topicId) =>
        set((state) => {
          const isSelected = state.selectedTopicIdsManual.includes(topicId);
          const newManual = isSelected
            ? state.selectedTopicIdsManual.filter((id) => id !== topicId)
            : [...state.selectedTopicIdsManual, topicId];
          return {
            selectedTopicIdsManual: newManual,
            selectedTopicIds: newManual,
            expandedDayKeys: [],
          };
        }),

      setSelectedTopics: (topicIds) => set({ selectedTopicIds: topicIds }),

      expandDay: (dateKey, entriesByDate) =>
        set((state) => {
          if (state.expandedDayKeys.includes(dateKey)) return state;
          const newExpandedDays = [...state.expandedDayKeys, dateKey];
          const topicsFromDays = getTopicIdsFromExpandedDays(newExpandedDays, entriesByDate);
          return {
            selectedTopicIdsManual: [],
            expandedDayKeys: newExpandedDays,
            selectedTopicIds: topicsFromDays,
          };
        }),

      collapseDay: (dateKey, entriesByDate) =>
        set((state) => {
          if (!state.expandedDayKeys.includes(dateKey)) return state;
          const newExpandedDays = state.expandedDayKeys.filter((k) => k !== dateKey);
          const topicsFromDays = getTopicIdsFromExpandedDays(newExpandedDays, entriesByDate);
          return {
            expandedDayKeys: newExpandedDays,
            selectedTopicIds: topicsFromDays,
          };
        }),

      clearExpandedDays: () =>
        set({ expandedDayKeys: [], selectedTopicIds: [] }),

      clearSelection: () =>
        set({
          selectedTopicIds: [],
          selectedTopicIdsManual: [],
          expandedDayKeys: [],
        }),

      dashboardSection: "daily" as DashboardSection,
      setDashboardSection: (section) => set({ dashboardSection: section }),

      scrollToEntryId: null,
      setScrollToEntryId: (entryId) => set({ scrollToEntryId: entryId }),
    }),
    {
      name: "neuraal-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        topicPositions: state.topicPositions,
        dashboardSection: state.dashboardSection,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export function selectDateKey(state: AppState): string {
  return format(state.selectedDate, "yyyy-MM-dd");
}
