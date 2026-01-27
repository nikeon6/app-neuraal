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
} from "@/shared/types";
import { uid } from "@/shared/lib/utils";

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

// Initial demo tasks - 6 floating topics
const initialTasks: TasksByDay = {
  1: [
    { id: "t1", title: "Revisar emails", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t2", title: "Yoga matutino", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t3", title: "Comprar regalo cumpleaños", topicId: "family", completed: false, createdAt: Date.now() },
  ],
  2: [
    { id: "t4", title: "Reunión de equipo", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t5", title: "Correr en el parque", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  3: [
    { id: "t6", title: "Meditación", topicId: "health", completed: true, createdAt: Date.now() },
    { id: "t7", title: "Ver película", topicId: "fun", completed: false, createdAt: Date.now() },
    { id: "t8", title: "Curso de React avanzado", topicId: "learning", completed: false, createdAt: Date.now() },
  ],
  4: [
    { id: "t9", title: "Preparar informe", topicId: "work", completed: false, createdAt: Date.now() },
  ],
  5: [
    { id: "t10", title: "Reunión proyecto", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t11", title: "Natación", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  6: [
    { id: "t12", title: "Leer libro", topicId: "fun", completed: false, createdAt: Date.now() },
    { id: "t13", title: "Código refactoring", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t14", title: "Quedada con amigos", topicId: "social", completed: false, createdAt: Date.now() },
  ],
  7: [
    { id: "t15", title: "Presentación", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t16", title: "Gimnasio", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  8: [
    { id: "t17", title: "Llamada con cliente", topicId: "work", completed: false, createdAt: Date.now() },
  ],
  9: [
    { id: "t18", title: "Estiramientos", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t19", title: "Ir al cine", topicId: "fun", completed: false, createdAt: Date.now() },
  ],
  10: [
    { id: "t20", title: "Revisar código", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t21", title: "Caminata", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t22", title: "Almuerzo con mamá", topicId: "family", completed: false, createdAt: Date.now() },
  ],
  11: [
    { id: "t23", title: "Concierto", topicId: "fun", completed: false, createdAt: Date.now() },
  ],
  12: [
    { id: "t24", title: "Planificar sprint", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t25", title: "Yoga", topicId: "health", completed: false, createdAt: Date.now() },
    { id: "t26", title: "Aprender TypeScript", topicId: "learning", completed: false, createdAt: Date.now() },
  ],
  13: [
    { id: "t27", title: "Cena con amigos", topicId: "fun", completed: false, createdAt: Date.now() },
  ],
  14: [
    { id: "t28", title: "Deploy producción", topicId: "work", completed: false, createdAt: Date.now() },
    { id: "t29", title: "Pilates", topicId: "health", completed: false, createdAt: Date.now() },
  ],
  15: [
    { id: "t30", title: "Pintar", topicId: "fun", completed: false, createdAt: Date.now() },
    { id: "t31", title: "Fiesta de cumpleaños", topicId: "social", completed: false, createdAt: Date.now() },
  ],
  16: [
    { id: "t32", title: "Visita a abuela", topicId: "family", completed: false, createdAt: Date.now() },
  ],
  17: [
    { id: "t33", title: "Leer documentación API", topicId: "learning", completed: false, createdAt: Date.now() },
  ],
  18: [
    { id: "t34", title: "Quedada con compañeros", topicId: "social", completed: false, createdAt: Date.now() },
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
