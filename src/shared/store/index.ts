import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";
import type { TopicPosition, TopicPositions } from "@/features/topics/types";
import type { ISODate } from "@/shared/types";
import type { ApiTopic, ApiEntry, CreateTopicBody, CreateEntryBody, UpdateEntryBody } from "@/shared/api/sdk";
import * as topicsSdk from "@/shared/api/sdk/topics";
import * as entriesSdk from "@/shared/api/sdk/entries";
import { ApiError } from "@/shared/api/apiClient";

// ============================================================================
// Helper: Get unique topic IDs from entries in expanded days
// ============================================================================
function getTopicIdsFromExpandedDays(
  expandedDayKeys: ISODate[],
  entriesByDate: Record<string, ApiEntry[]>
): string[] {
  const topicIds = new Set<string>();

  for (const dateKey of expandedDayKeys) {
    const entries = entriesByDate[dateKey] || [];
    for (const entry of entries) {
      if (entry.topicId) {
        topicIds.add(entry.topicId);
      }
    }
  }

  return Array.from(topicIds);
}

// ============================================================================
// Store Types
// ============================================================================

/** Dashboard navigation sections. */
export type DashboardSection =
  | "daily"
  | "weeklyRecap"
  | "stickies"
  | "topics"
  | "settings";

/**
 * Global application state.
 *
 * Topics and entries are fetched from the API via the SDK.
 * UI-only state (positions, selections, navigation) is persisted locally.
 */
interface AppState {
  // ---- API-backed data (NOT persisted) ------------------------------------

  /** Topics fetched from the API. */
  topics: ApiTopic[];
  isLoadingTopics: boolean;

  /** Entries indexed by "YYYY-MM-DD" date key. */
  entriesByDate: Record<string, ApiEntry[]>;
  /** Dates currently being fetched. */
  loadingDates: string[];

  // ---- API actions --------------------------------------------------------

  fetchTopics: () => Promise<void>;
  apiCreateTopic: (input: CreateTopicBody) => Promise<ApiTopic | null>;
  apiUpdateTopic: (
    id: string,
    patch: { name?: string; color?: string }
  ) => Promise<ApiTopic | null>;
  apiDeleteTopic: (id: string) => Promise<void>;

  fetchEntriesByDate: (date: string) => Promise<void>;
  fetchMonthEntries: (year: number, month: number) => Promise<void>;
  apiCreateEntry: (input: CreateEntryBody) => Promise<ApiEntry | null>;
  apiUpdateEntry: (
    id: string,
    date: string,
    input: UpdateEntryBody
  ) => Promise<ApiEntry | null>;
  apiDeleteEntry: (id: string, date: string) => Promise<void>;

  // ---- Authentication (UI-only for now) -----------------------------------

  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;

  // ---- Calendar / Date selection ------------------------------------------

  selectedDate: Date;
  selectedDay: number;
  setSelectedDate: (date: Date) => void;
  setSelectedDay: (day: number) => void;

  // ---- Topic positions (UI-only, persisted) -------------------------------

  topicPositions: TopicPositions;
  setTopicPosition: (topicId: string, position: TopicPosition) => void;

  // ---- Highlighted topic (UI ephemeral) -----------------------------------

  highlightedTopic: string | null;
  setHighlightedTopic: (topicId: string | null) => void;

  // ---- Topic / day selection (wires mode) ---------------------------------

  selectedTopicIds: string[];
  selectedTopicIdsManual: string[];
  expandedDayKeys: ISODate[];
  toggleTopicSelection: (topicId: string) => void;
  setSelectedTopics: (topicIds: string[]) => void;
  expandDay: (dateKey: ISODate) => void;
  collapseDay: (dateKey: ISODate) => void;
  clearExpandedDays: () => void;
  clearSelection: () => void;

  // ---- Dashboard navigation -----------------------------------------------

  dashboardSection: DashboardSection;
  setDashboardSection: (section: DashboardSection) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ==== API-backed data ================================================

      topics: [],
      isLoadingTopics: false,

      entriesByDate: {},
      loadingDates: [],

      // ==== API actions ====================================================

      fetchTopics: async () => {
        set({ isLoadingTopics: true });
        try {
          const topics = await topicsSdk.listTopics();
          set({ topics, isLoadingTopics: false });
        } catch (error) {
          console.error("[store] fetchTopics failed:", error);
          set({ isLoadingTopics: false });
        }
      },

      apiCreateTopic: async (input) => {
        try {
          const topic = await topicsSdk.createTopic(input);
          set((s) => ({ topics: [...s.topics, topic] }));
          return topic;
        } catch (error) {
          console.error("[store] createTopic failed:", error);
          if (error instanceof ApiError && error.status === 409) {
            console.warn("[store] Topic already exists (conflict).");
          }
          return null;
        }
      },

      apiUpdateTopic: async (id, patch) => {
        try {
          const updated = await topicsSdk.updateTopic(id, patch);
          set((s) => ({
            topics: s.topics.map((t) => (t.id === id ? updated : t)),
          }));
          return updated;
        } catch (error) {
          console.error("[store] updateTopic failed:", error);
          return null;
        }
      },

      apiDeleteTopic: async (id) => {
        // Optimistic removal
        const prev = get().topics;
        set((s) => ({ topics: s.topics.filter((t) => t.id !== id) }));
        try {
          await topicsSdk.deleteTopic(id);
        } catch (error) {
          console.error("[store] deleteTopic failed, reverting:", error);
          set({ topics: prev });
        }
      },

      fetchEntriesByDate: async (date) => {
        const state = get();
        // Skip if already loading this date
        if (state.loadingDates.includes(date)) return;

        set((s) => ({ loadingDates: [...s.loadingDates, date] }));
        try {
          const entries = await entriesSdk.listEntriesByDate(date);
          set((s) => ({
            entriesByDate: { ...s.entriesByDate, [date]: entries },
            loadingDates: s.loadingDates.filter((d) => d !== date),
          }));
        } catch (error) {
          console.error(`[store] fetchEntriesByDate(${date}) failed:`, error);
          set((s) => ({
            loadingDates: s.loadingDates.filter((d) => d !== date),
          }));
        }
      },

      fetchMonthEntries: async (year, month) => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const state = get();
        const promises: Promise<void>[] = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          // Only fetch dates we haven't fetched yet
          if (!(date in state.entriesByDate) && !state.loadingDates.includes(date)) {
            promises.push(get().fetchEntriesByDate(date));
          }
        }

        await Promise.all(promises);
      },

      apiCreateEntry: async (input) => {
        try {
          const entry = await entriesSdk.createEntry(input);
          set((s) => {
            const dateEntries = s.entriesByDate[entry.date] || [];
            return {
              entriesByDate: {
                ...s.entriesByDate,
                [entry.date]: [...dateEntries, entry],
              },
            };
          });
          return entry;
        } catch (error) {
          console.error("[store] createEntry failed:", error);
          return null;
        }
      },

      apiUpdateEntry: async (id, date, input) => {
        try {
          const updated = await entriesSdk.updateEntry(id, input);
          set((s) => {
            const dateEntries = s.entriesByDate[date] || [];
            return {
              entriesByDate: {
                ...s.entriesByDate,
                [date]: dateEntries.map((e) => (e.id === id ? updated : e)),
              },
            };
          });
          return updated;
        } catch (error) {
          console.error("[store] updateEntry failed:", error);
          if (error instanceof ApiError && error.status === 409) {
            console.warn("[store] Version conflict. Reloading entries...");
            get().fetchEntriesByDate(date);
          }
          return null;
        }
      },

      apiDeleteEntry: async (id, date) => {
        // Optimistic removal
        const prevEntries = get().entriesByDate[date] || [];
        set((s) => ({
          entriesByDate: {
            ...s.entriesByDate,
            [date]: (s.entriesByDate[date] || []).filter((e) => e.id !== id),
          },
        }));
        try {
          await entriesSdk.deleteEntry(id);
        } catch (error) {
          console.error("[store] deleteEntry failed, reverting:", error);
          set((s) => ({
            entriesByDate: { ...s.entriesByDate, [date]: prevEntries },
          }));
        }
      },

      // ==== Authentication =================================================

      isAuthenticated: false,
      login: () => set({ isAuthenticated: true }),
      logout: () => set({ isAuthenticated: false }),

      // ==== Calendar / Date selection ======================================

      selectedDate: new Date(),
      selectedDay: new Date().getDate(),
      setSelectedDate: (date) =>
        set({ selectedDate: date, selectedDay: date.getDate() }),
      setSelectedDay: (day) => set({ selectedDay: day }),

      // ==== Topic positions ================================================

      topicPositions: {},
      setTopicPosition: (topicId, position) =>
        set((state) => ({
          topicPositions: { ...state.topicPositions, [topicId]: position },
        })),

      // ==== Highlighted topic ==============================================

      highlightedTopic: null,
      setHighlightedTopic: (topicId) => set({ highlightedTopic: topicId }),

      // ==== Topic / day selection ==========================================

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

      expandDay: (dateKey) =>
        set((state) => {
          if (state.expandedDayKeys.includes(dateKey)) return state;

          const newExpandedDays = [...state.expandedDayKeys, dateKey];
          const topicsFromDays = getTopicIdsFromExpandedDays(
            newExpandedDays,
            state.entriesByDate
          );

          return {
            selectedTopicIdsManual: [],
            expandedDayKeys: newExpandedDays,
            selectedTopicIds: topicsFromDays,
          };
        }),

      collapseDay: (dateKey) =>
        set((state) => {
          if (!state.expandedDayKeys.includes(dateKey)) return state;

          const newExpandedDays = state.expandedDayKeys.filter(
            (k) => k !== dateKey
          );
          const topicsFromDays = getTopicIdsFromExpandedDays(
            newExpandedDays,
            state.entriesByDate
          );

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

      // ==== Dashboard navigation ===========================================

      dashboardSection: "daily" as DashboardSection,
      setDashboardSection: (section) => set({ dashboardSection: section }),
    }),
    {
      name: "neuraal-storage",
      partialize: (state) => ({
        // Only persist UI-only state, NOT API data
        isAuthenticated: state.isAuthenticated,
        topicPositions: state.topicPositions,
        dashboardSection: state.dashboardSection,
      }),
    }
  )
);

// ============================================================================
// Selectors (for use outside of store hook)
// ============================================================================

/**
 * Returns the ISODate key for the currently selected date.
 * Use in components: `const dateKey = useStore(selectDateKey);`
 */
export function selectDateKey(state: AppState): string {
  return format(state.selectedDate, "yyyy-MM-dd");
}

/**
 * Returns entries for the currently selected date.
 *
 * IMPORTANT: We must NOT use `|| []` because that creates a new array
 * reference on every call when the key is missing, which causes Zustand
 * to detect a "change" and triggers an infinite re-render loop.
 * Instead we return a stable empty array constant.
 *
 * Use in components: `const entries = useStore(selectCurrentEntries);`
 */
const EMPTY_ENTRIES: ApiEntry[] = [];
export function selectCurrentEntries(state: AppState): ApiEntry[] {
  const dateKey = format(state.selectedDate, "yyyy-MM-dd");
  return state.entriesByDate[dateKey] ?? EMPTY_ENTRIES;
}

/**
 * Returns only task entries for the currently selected date.
 */
export function selectCurrentTasks(state: AppState): ApiEntry[] {
  return selectCurrentEntries(state).filter((e) => e.type === "task");
}

/**
 * Returns only note entries for the currently selected date.
 */
export function selectCurrentNotes(state: AppState): ApiEntry[] {
  return selectCurrentEntries(state).filter((e) => e.type === "note");
}

/**
 * Returns a lookup map: topicId → ApiTopic for quick access.
 */
export function selectTopicMap(
  state: AppState
): Record<string, ApiTopic> {
  const map: Record<string, ApiTopic> = {};
  for (const t of state.topics) {
    map[t.id] = t;
  }
  return map;
}
