import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";
import type {
  LegacyTask,
  LegacyNote,
  TasksByDay,
  NotesByDate,
  TopicId,
  UserId,
  ISODate,
  DefaultTopicId,
  UserTopic,
} from "@/shared/types";
import type { TopicPosition, TopicPositions } from "@/features/topics/types";
import { uid } from "@/shared/lib/utils";

// ============================================================================
// User Topics Type (for store)
// ============================================================================

/**
 * Input for creating a new topic.
 */
export interface CreateTopicInput {
  name: string;
  color: string;
}

// ============================================================================
// User Constants (mock for development)
// ============================================================================

/**
 * Default user ID for development/demo mode.
 * This will be replaced by actual user ID from auth provider when login is implemented.
 */
export const DEFAULT_USER_ID: UserId = "user_demo";

/**
 * Global application state.
 * 
 * NOTE: Currently uses legacy Task/Note types for backward compatibility.
 * Future migration will use Entry type with entryType discriminator.
 */
interface AppState {
  // User (multiuser preparation)
  currentUserId: UserId | null;
  setCurrentUserId: (userId: UserId | null) => void;

  // Authentication
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;

  // Calendar / Date selection
  // NOTE: Uses Date object for date-fns compatibility. 
  // For API/storage, convert to ISODate string.
  selectedDate: Date;
  selectedDay: number;
  setSelectedDate: (date: Date) => void;
  setSelectedDay: (day: number) => void;

  // Tasks (organized by day number 1-31)
  // TODO: Migrate to Record<ISODate, Entry[]> when Entry is fully implemented
  tasksByDay: TasksByDay;
  addTask: (day: number, title: string, topicId: TopicId) => void;
  removeTask: (day: number, taskId: string) => void;
  toggleTaskComplete: (day: number, taskId: string) => void;
  reorderTasks: (day: number, taskIds: string[]) => void;

  // Notes (organized by date string ISODate)
  // TODO: Migrate to Entry with entryType: "note"
  notes: NotesByDate;
  addNote: (date: Date, content: string) => void;
  deleteNote: (date: Date, noteId: string) => void;

  // Topic positions (UI state for draggable bubble nodes)
  topicPositions: TopicPositions;
  setTopicPosition: (topicId: TopicId, position: TopicPosition) => void;

  // Highlighted topic (UI state for visual feedback on hover)
  highlightedTopic: TopicId | null;
  setHighlightedTopic: (topicId: TopicId | null) => void;

  // Multi-selection of topics (for wire-to-day vs wire-to-task mode)
  // - selectedTopicIds: final selection = manual + from expanded days
  // - selectedTopicIdsManual: topics selected by clicking bubbles
  // - expandedDayKeys: days manually expanded (multi-day toggle)
  // When no selection: wires connect to days (collapsed mode)
  // When selected: those topics show wires to individual tasks
  selectedTopicIds: DefaultTopicId[];
  selectedTopicIdsManual: DefaultTopicId[];
  expandedDayKeys: ISODate[];
  toggleTopicSelection: (topicId: DefaultTopicId) => void;
  setSelectedTopics: (topicIds: DefaultTopicId[]) => void;
  expandDay: (dateKey: ISODate) => void;
  collapseDay: (dateKey: ISODate) => void;
  clearExpandedDays: () => void;
  clearSelection: () => void;

  // User topics management
  topics: UserTopic[];
  addTopic: (input: CreateTopicInput) => UserTopic | null;
  removeTopic: (topicId: string) => void;

  // Dashboard navigation
  dashboardSection: DashboardSection;
  setDashboardSection: (section: DashboardSection) => void;
}

// Dashboard sections type
export type DashboardSection = "daily" | "weeklyRecap" | "stickies" | "topics" | "settings";

// ============================================================================
// Helper: Get unique topics from expanded days
// ============================================================================
function getTopicsFromExpandedDays(
  expandedDayKeys: ISODate[],
  tasksByDay: TasksByDay
): DefaultTopicId[] {
  const topics = new Set<DefaultTopicId>();
  
  for (const dateKey of expandedDayKeys) {
    // Extract day number from dateKey (yyyy-MM-dd)
    const dayNumber = Number.parseInt(dateKey.split("-")[2], 10);
    const dayTasks = tasksByDay[dayNumber] || [];
    
    for (const task of dayTasks) {
      if (task.topicId === "work" || task.topicId === "health" || 
          task.topicId === "family" || task.topicId === "fun" || 
          task.topicId === "learning" || task.topicId === "social") {
        topics.add(task.topicId as DefaultTopicId);
      }
    }
  }
  
  return Array.from(topics);
}

// Initial demo tasks - 6 floating topics
// All tasks are associated with DEFAULT_USER_ID for demo purposes
const initialTasks: TasksByDay = {
  1: [
    { id: "t1", userId: DEFAULT_USER_ID, title: "Revisar emails", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t2", userId: DEFAULT_USER_ID, title: "Yoga matutino", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t3", userId: DEFAULT_USER_ID, title: "Comprar regalo cumpleaños", topicId: "family", completed: false, createdAt: Date.now() },
  ],
  2: [
    { id: "t4", userId: DEFAULT_USER_ID, title: "Reunión de equipo", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t5", userId: DEFAULT_USER_ID, title: "Correr en el parque", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  3: [
    { id: "t6", userId: DEFAULT_USER_ID, title: "Meditación", topicId: "health", completed: true, createdAt: Date.now() },
    { id: "t7", userId: DEFAULT_USER_ID, title: "Ver película", topicId: "fun", completed: false, createdAt: Date.now() },
    { id: "t8", userId: DEFAULT_USER_ID, title: "Curso de React avanzado", topicId: "learning", completed: false, createdAt: Date.now() },
  ],
  4: [
    { id: "t9", userId: DEFAULT_USER_ID, title: "Preparar informe", topicId: "work", completed: false, createdAt: Date.now() },
  ],
  5: [
    { id: "t10", userId: DEFAULT_USER_ID, title: "Reunión proyecto", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t11", userId: DEFAULT_USER_ID, title: "Natación", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  6: [
    { id: "t12", userId: DEFAULT_USER_ID, title: "Leer libro", topicId: "fun", completed: false, createdAt: Date.now() },
    { id: "t13", userId: DEFAULT_USER_ID, title: "Código refactoring", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t14", userId: DEFAULT_USER_ID, title: "Quedada con amigos", topicId: "social", completed: false, createdAt: Date.now() },
  ],
  7: [
    { id: "t15", userId: DEFAULT_USER_ID, title: "Presentación", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t16", userId: DEFAULT_USER_ID, title: "Gimnasio", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  8: [
    { id: "t17", userId: DEFAULT_USER_ID, title: "Llamada con cliente", topicId: "work", completed: false, createdAt: Date.now() },
  ],
  9: [
    { id: "t18", userId: DEFAULT_USER_ID, title: "Estiramientos", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t19", userId: DEFAULT_USER_ID, title: "Ir al cine", topicId: "fun", completed: false, createdAt: Date.now() },
  ],
  10: [
    { id: "t20", userId: DEFAULT_USER_ID, title: "Revisar código", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t21", userId: DEFAULT_USER_ID, title: "Caminata", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t22", userId: DEFAULT_USER_ID, title: "Almuerzo con mamá", topicId: "family", completed: false, createdAt: Date.now() },
  ],
  11: [
    { id: "t23", userId: DEFAULT_USER_ID, title: "Concierto", topicId: "fun", completed: false, createdAt: Date.now() },
  ],
  12: [
    { id: "t24", userId: DEFAULT_USER_ID, title: "Planificar sprint", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t25", userId: DEFAULT_USER_ID, title: "Yoga", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t26", userId: DEFAULT_USER_ID, title: "Aprender TypeScript", topicId: "learning", completed: false, createdAt: Date.now() },
  ],
  13: [
    { id: "t27", userId: DEFAULT_USER_ID, title: "Cena con amigos", topicId: "fun", completed: false, createdAt: Date.now() },
  ],
  14: [
    { id: "t28", userId: DEFAULT_USER_ID, title: "Deploy producción", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t29", userId: DEFAULT_USER_ID, title: "Pilates", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  15: [
    { id: "t30", userId: DEFAULT_USER_ID, title: "Pintar", topicId: "fun", completed: false, createdAt: Date.now() },
    { id: "t31", userId: DEFAULT_USER_ID, title: "Fiesta de cumpleaños", topicId: "social", completed: false, createdAt: Date.now() },
  ],
  16: [
    { id: "t32", userId: DEFAULT_USER_ID, title: "Visita a abuela", topicId: "family", completed: false, createdAt: Date.now() },
  ],
  17: [
    { id: "t33", userId: DEFAULT_USER_ID, title: "Leer documentación API", topicId: "learning", completed: false, createdAt: Date.now() },
  ],
  18: [
    { id: "t34", userId: DEFAULT_USER_ID, title: "Quedada con compañeros", topicId: "social", completed: false, createdAt: Date.now() },
  ],
  // Days 27-29 for current date demo
  27: [
    { id: "t35", userId: DEFAULT_USER_ID, title: "Revisar proyecto TasksContainer", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t36", userId: DEFAULT_USER_ID, title: "Correr 5km", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t37", userId: DEFAULT_USER_ID, title: "Estudiar TypeScript avanzado", topicId: "learning", completed: false, createdAt: Date.now() },
  ],
  28: [
    { id: "t38", userId: DEFAULT_USER_ID, title: "Reunión de planificación", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t39", userId: DEFAULT_USER_ID, title: "Llamar a mamá", topicId: "family", completed: false, createdAt: Date.now() },
  ],
  29: [
    { id: "t40", userId: DEFAULT_USER_ID, title: "Ir al gimnasio", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t41", userId: DEFAULT_USER_ID, title: "Ver serie", topicId: "fun", completed: false, createdAt: Date.now() },
    { id: "t42", userId: DEFAULT_USER_ID, title: "Cena con amigos", topicId: "social", completed: false, createdAt: Date.now() },
  ],
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // User (multiuser preparation)
      currentUserId: DEFAULT_USER_ID,
      setCurrentUserId: (userId) => set({ currentUserId: userId }),

      // Authentication
      isAuthenticated: false,
      login: () => set({ isAuthenticated: true }),
      // TODO: On real logout, clear user-specific state or switch persist key
      logout: () => set({ isAuthenticated: false }),

      // Calendar
      selectedDate: new Date(),
      selectedDay: new Date().getDate(),
      setSelectedDate: (date) =>
        set({ selectedDate: date, selectedDay: date.getDate() }),
      setSelectedDay: (day) => set({ selectedDay: day }),

      // Tasks
      tasksByDay: initialTasks,
      addTask: (day, title, topicId) =>
        set((state) => {
          const newTask: LegacyTask = {
            id: uid(),
            userId: state.currentUserId ?? DEFAULT_USER_ID,
            title: title.trim() || "Nueva tarea",
            topicId,
            completed: false,
            createdAt: Date.now(),
          };
          const currentTasks = state.tasksByDay[day] || [];
          return {
            tasksByDay: {
              ...state.tasksByDay,
              [day]: [...currentTasks, newTask],
            },
          };
        }),
      removeTask: (day, taskId) =>
        set((state) => {
          const currentTasks = state.tasksByDay[day] || [];
          const filteredTasks = currentTasks.filter((t) => t.id !== taskId);
          const newTasksByDay = { ...state.tasksByDay };
          if (filteredTasks.length === 0) {
            delete newTasksByDay[day];
          } else {
            newTasksByDay[day] = filteredTasks;
          }
          return { tasksByDay: newTasksByDay };
        }),
      toggleTaskComplete: (day, taskId) =>
        set((state) => {
          const currentTasks = state.tasksByDay[day] || [];
          return {
            tasksByDay: {
              ...state.tasksByDay,
              [day]: currentTasks.map((t) =>
                t.id === taskId ? { ...t, completed: !t.completed } : t
              ),
            },
          };
        }),
      reorderTasks: (day, taskIds) =>
        set((state) => {
          const currentTasks = state.tasksByDay[day] || [];
          // Create a map of tasks by id for quick lookup
          const taskMap = new Map(currentTasks.map((t) => [t.id, t]));
          // Reorder tasks based on the new order of IDs
          const reorderedTasks = taskIds
            .map((id) => taskMap.get(id))
            .filter((t): t is LegacyTask => t !== undefined);
          return {
            tasksByDay: {
              ...state.tasksByDay,
              [day]: reorderedTasks,
            },
          };
        }),

      // Notes
      notes: {},
      addNote: (date, content) =>
        set((state) => {
          const key: ISODate = format(date, "yyyy-MM-dd");
          const currentNotes = state.notes[key] || [];
          const newNote: LegacyNote = {
            id: uid(),
            userId: state.currentUserId ?? DEFAULT_USER_ID,
            content,
            createdAt: Date.now(),
          };
          return {
            notes: {
              ...state.notes,
              [key]: [...currentNotes, newNote],
            },
          };
        }),
      deleteNote: (date, noteId) =>
        set((state) => {
          const key: ISODate = format(date, "yyyy-MM-dd");
          const currentNotes = state.notes[key] || [];
          return {
            notes: {
              ...state.notes,
              [key]: currentNotes.filter((n) => n.id !== noteId),
            },
          };
        }),

      // Topic positions
      topicPositions: {},
      setTopicPosition: (topicId, position) =>
        set((state) => ({
          topicPositions: {
            ...state.topicPositions,
            [topicId]: position,
          },
        })),

      // Highlighted topic
      highlightedTopic: null,
      setHighlightedTopic: (topicId) => set({ highlightedTopic: topicId }),

      // Multi-selection of topics (EXCLUSIVE MODES)
      // Mode A (Manual): click on bubble -> clears expanded days
      // Mode B (Days): click on day -> clears manual selection
      selectedTopicIds: [],
      selectedTopicIdsManual: [],
      expandedDayKeys: [],
      
      // Toggle topic selection (ENTERS MANUAL MODE)
      // Clears all expanded days first, then toggles the topic
      toggleTopicSelection: (topicId) =>
        set((state) => {
          // EXCLUSIVE MODE: Clear expanded days when entering manual mode
          const isManuallySelected = state.selectedTopicIdsManual.includes(topicId);
          const newManual = isManuallySelected
            ? state.selectedTopicIdsManual.filter((id) => id !== topicId)
            : [...state.selectedTopicIdsManual, topicId];
          
          // selectedTopicIds = manual only (expanded days are cleared)
          return {
            selectedTopicIdsManual: newManual,
            selectedTopicIds: newManual,
            expandedDayKeys: [], // CLEAR expanded days
          };
        }),
      
      setSelectedTopics: (topicIds) =>
        set({ selectedTopicIds: topicIds }),
      
      // Expand a day (ENTERS DAYS MODE)
      // Clears manual selection first, then expands the day
      expandDay: (dateKey) =>
        set((state) => {
          if (state.expandedDayKeys.includes(dateKey)) return state;
          
          const newExpandedDays = [...state.expandedDayKeys, dateKey];
          
          // EXCLUSIVE MODE: Clear manual selection when entering days mode
          // selectedTopicIds = topics from expanded days only
          const topicsFromDays = getTopicsFromExpandedDays(newExpandedDays, state.tasksByDay);
          
          return {
            selectedTopicIdsManual: [], // CLEAR manual selection
            expandedDayKeys: newExpandedDays,
            selectedTopicIds: topicsFromDays,
          };
        }),
      
      // Collapse a day (stays in days mode if other days remain expanded)
      collapseDay: (dateKey) =>
        set((state) => {
          if (!state.expandedDayKeys.includes(dateKey)) return state;
          
          const newExpandedDays = state.expandedDayKeys.filter((k) => k !== dateKey);
          
          // Recalculate topics from remaining expanded days only
          // (manual selection should be empty in days mode)
          const topicsFromDays = getTopicsFromExpandedDays(newExpandedDays, state.tasksByDay);
          
          return {
            expandedDayKeys: newExpandedDays,
            selectedTopicIds: topicsFromDays,
          };
        }),
      
      clearExpandedDays: () =>
        set({
          expandedDayKeys: [],
          selectedTopicIds: [],
        }),
      
      clearSelection: () =>
        set({ selectedTopicIds: [], selectedTopicIdsManual: [], expandedDayKeys: [] }),

      // User topics management
      topics: [],
      addTopic: (input) => {
        const trimmedName = input.name.trim();
        
        // Validation: empty name
        if (!trimmedName) {
          return null;
        }
        
        // Get current state to check for duplicates
        const state = useStore.getState();
        const normalizedName = trimmedName.toLowerCase();
        const isDuplicate = state.topics.some(
          (t) => t.name.trim().toLowerCase() === normalizedName
        );
        
        if (isDuplicate) {
          return null;
        }
        
        const now = new Date().toISOString();
        const newTopic: UserTopic = {
          id: uid(),
          name: trimmedName,
          color: input.color,
          userId: state.currentUserId ?? DEFAULT_USER_ID,
          meta: {
            createdAt: now,
            updatedAt: now,
            version: 1,
          },
        };
        
        // TODO: when backend is ready: request embedding generation for this topic
        
        set((s) => ({
          topics: [...s.topics, newTopic],
        }));
        
        return newTopic;
      },
      removeTopic: (topicId) =>
        set((state) => ({
          topics: state.topics.filter((t) => t.id !== topicId),
        })),

      // Dashboard navigation
      dashboardSection: "daily" as DashboardSection,
      setDashboardSection: (section) => set({ dashboardSection: section }),
    }),
    {
      // Storage key includes user ID for multiuser support
      // TODO: When real auth is implemented, use dynamic key based on currentUserId
      name: `neuraal-storage:${DEFAULT_USER_ID}`,
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        tasksByDay: state.tasksByDay,
        notes: state.notes,
        topicPositions: state.topicPositions,
        topics: state.topics,
        // NOTE: currentUserId is NOT persisted - will come from auth session
      }),
    }
  )
);
