import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";
import {
  type Task,
  type Note,
  type TasksByDay,
  type NotesByDate,
  type TopicId,
  type TopicPosition,
} from "@/domain/types";
import { uid } from "./utils";

interface AppState {
  // Authentication
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;

  // Calendar / Date selection
  selectedDate: Date;
  selectedDay: number;
  setSelectedDate: (date: Date) => void;
  setSelectedDay: (day: number) => void;

  // Tasks (organized by day number 1-31)
  tasksByDay: TasksByDay;
  addTask: (day: number, title: string, topicId: TopicId) => void;
  removeTask: (day: number, taskId: string) => void;
  toggleTaskComplete: (day: number, taskId: string) => void;

  // Notes (organized by date string)
  notes: NotesByDate;
  addNote: (date: Date, content: string) => void;
  deleteNote: (date: Date, noteId: string) => void;

  // Topic positions (for draggable nodes)
  topicPositions: Partial<Record<TopicId, TopicPosition>>;
  setTopicPosition: (topicId: TopicId, position: TopicPosition) => void;

  // Highlighted topic (for visual feedback)
  highlightedTopic: TopicId | null;
  setHighlightedTopic: (topicId: TopicId | null) => void;
}

// Initial demo tasks
const initialTasks: TasksByDay = {
  1: [{ id: "t1", title: "Revisar emails", topicId: "work", completed: false, createdAt: Date.now() }],
  2: [{ id: "t2", title: "Yoga matutino", topicId: "health", completed: false, createdAt: Date.now() }],
  3: [{ id: "t3", title: "Meditación", topicId: "health", completed: true, createdAt: Date.now() }],
  5: [{ id: "t4", title: "Reunión proyecto", topicId: "work", completed: false, createdAt: Date.now() }],
  6: [{ id: "t5", title: "Leer libro", topicId: "fun", completed: false, createdAt: Date.now() }],
  7: [
    { id: "t6", title: "Presentación", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t7", title: "Gimnasio", topicId: "health", completed: false, createdAt: Date.now() },
  ],
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Authentication
      isAuthenticated: false,
      login: () => set({ isAuthenticated: true }),
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
          const newTask: Task = {
            id: uid(),
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

      // Notes
      notes: {},
      addNote: (date, content) =>
        set((state) => {
          const key = format(date, "yyyy-MM-dd");
          const currentNotes = state.notes[key] || [];
          const newNote: Note = {
            id: uid(),
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
          const key = format(date, "yyyy-MM-dd");
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
    }),
    {
      name: "neuraal-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        tasksByDay: state.tasksByDay,
        notes: state.notes,
        topicPositions: state.topicPositions,
      }),
    }
  )
);
