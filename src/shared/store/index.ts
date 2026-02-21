import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";
import type { TopicPosition, TopicPositions } from "@/features/topics/types";
import type { ISODate } from "@/shared/types";
import type { ApiEntry } from "@/shared/api/sdk";

// ============================================================================
// Per-user topic positions persistence (localStorage)
// ============================================================================

const POSITIONS_KEY_PREFIX = "neuraal-positions-";

function positionsKey(userId: string): string {
  return `${POSITIONS_KEY_PREFIX}${userId}`;
}

function loadUserPositions(userId: string): TopicPositions {
  if (globalThis.window === undefined) return {};
  try {
    const raw = localStorage.getItem(positionsKey(userId));
    return raw ? (JSON.parse(raw) as TopicPositions) : {};
  } catch {
    return {};
  }
}

function saveUserPositions(userId: string, positions: TopicPositions): void {
  if (globalThis.window === undefined) return;
  try {
    localStorage.setItem(positionsKey(userId), JSON.stringify(positions));
  } catch {
    // localStorage full or unavailable — best-effort
  }
}

// ============================================================================
// Helper: Get unique topic IDs from entries in expanded days (exported for UI)
// ============================================================================
export function getTopicIdsFromExpandedDays(
  expandedDayKeys: ISODate[],
  entriesByDate: Record<string, ApiEntry[]>,
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
  user: { id: string; email: string } | null;
  login: (user: { id: string; email: string }) => void;
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
  pinnedDayKeys: ISODate[];
  toggleTopicSelection: (topicId: string) => void;
  setSelectedTopics: (topicIds: string[]) => void;
  expandDay: (
    dateKey: ISODate,
    entriesByDate: Record<string, ApiEntry[]>,
  ) => void;
  collapseDay: (
    dateKey: ISODate,
    entriesByDate: Record<string, ApiEntry[]>,
  ) => void;
  pinDay: (dateKey: ISODate) => void;
  unpinDay: (
    dateKey: ISODate,
    entriesByDate: Record<string, ApiEntry[]>,
  ) => void;
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
    (set, get) => ({
      user: null,
      login: (user) =>
        set({ user, topicPositions: loadUserPositions(user.id) }),
      logout: () => set({ user: null, topicPositions: {} }),

      selectedDate: new Date(),
      selectedDay: new Date().getDate(),
      setSelectedDate: (date) =>
        set({ selectedDate: date, selectedDay: date.getDate() }),
      setSelectedDay: (day) => set({ selectedDay: day }),

      topicPositions: {},
      setTopicPosition: (topicId, position) =>
        set((state) => {
          const updated = { ...state.topicPositions, [topicId]: position };
          const userId = get().user?.id;
          if (userId) saveUserPositions(userId, updated);
          return { topicPositions: updated };
        }),

      highlightedTopic: null,
      setHighlightedTopic: (topicId) => set({ highlightedTopic: topicId }),

      selectedTopicIds: [],
      selectedTopicIdsManual: [],
      expandedDayKeys: [],
      pinnedDayKeys: [],

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
            pinnedDayKeys: [],
          };
        }),

      setSelectedTopics: (topicIds) => set({ selectedTopicIds: topicIds }),

      expandDay: (dateKey, entriesByDate) =>
        set((state) => {
          // Keep pinned days + add the newly clicked day
          const pinned = state.pinnedDayKeys.filter((k) =>
            state.expandedDayKeys.includes(k),
          );
          const newExpandedDays = pinned.includes(dateKey)
            ? pinned
            : [...pinned, dateKey];
          const topicsFromDays = getTopicIdsFromExpandedDays(
            newExpandedDays,
            entriesByDate,
          );
          return {
            selectedTopicIdsManual: [],
            expandedDayKeys: newExpandedDays,
            selectedTopicIds: topicsFromDays,
          };
        }),

      collapseDay: (dateKey, entriesByDate) =>
        set((state) => {
          if (!state.expandedDayKeys.includes(dateKey)) return state;
          const newExpandedDays = state.expandedDayKeys.filter(
            (k) => k !== dateKey,
          );
          const newPinned = state.pinnedDayKeys.filter((k) => k !== dateKey);
          const topicsFromDays = getTopicIdsFromExpandedDays(
            newExpandedDays,
            entriesByDate,
          );
          return {
            expandedDayKeys: newExpandedDays,
            pinnedDayKeys: newPinned,
            selectedTopicIds: topicsFromDays,
          };
        }),

      pinDay: (dateKey) =>
        set((state) => ({
          pinnedDayKeys: state.pinnedDayKeys.includes(dateKey)
            ? state.pinnedDayKeys
            : [...state.pinnedDayKeys, dateKey],
        })),

      unpinDay: (dateKey, _entriesByDate) =>
        set((state) => {
          const newPinned = state.pinnedDayKeys.filter((k) => k !== dateKey);
          // Don't collapse immediately — just unpin.
          // The day will collapse the next time another day is clicked.
          return {
            pinnedDayKeys: newPinned,
          };
        }),

      clearExpandedDays: () =>
        set({ expandedDayKeys: [], pinnedDayKeys: [], selectedTopicIds: [] }),

      clearSelection: () =>
        set({
          selectedTopicIds: [],
          selectedTopicIdsManual: [],
          expandedDayKeys: [],
          pinnedDayKeys: [],
        }),

      dashboardSection: "daily" as DashboardSection,
      setDashboardSection: (section) => set({ dashboardSection: section }),

      scrollToEntryId: null,
      setScrollToEntryId: (entryId) => set({ scrollToEntryId: entryId }),
    }),
    {
      name: "neuraal-storage",
      partialize: (state) => ({
        user: state.user,
        dashboardSection: state.dashboardSection,
      }),
    },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

export function selectDateKey(state: AppState): string {
  return format(state.selectedDate, "yyyy-MM-dd");
}
