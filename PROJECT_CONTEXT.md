# Neuraal - Complete Project Context

> This document provides full context for AI assistants to understand and work on the Neuraal project.

---

## 1. Project Overview

**Neuraal** is a responsive task/notes management web app with:
- Calendar-driven dashboard
- Interactive floating topic bubbles
- Drag-and-drop task reordering
- Task categorization by topics (work, health, family, etc.)

**Status:** Active development (MVP phase)
**Branch:** `fix/responsive-layout`

---

## 2. Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js (App Router) | 16.0.3 |
| React | React | 19.2.0 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| State Management | Zustand (with persist) | ^5.0.8 |
| Animations | Framer Motion | ^12.23.24 |
| Date Handling | date-fns | ^4.1.0 |
| Icons | Lucide React | ^0.554.0 |
| Testing | Vitest + Testing Library | ^4.0.18 |
| Package Manager | **pnpm only** | 9.15.0 |

---

## 3. Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home → MainLayout + Dashboard
│   ├── login/page.tsx            # Login page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
│
├── features/                     # Feature-based modules (LOCAL scope)
│   ├── dashboard/
│   │   └── components/
│   │       └── Dashboard.tsx     # Main 3-column responsive grid
│   │
│   ├── calendar/
│   │   └── components/
│   │       └── VerticalCalendar.tsx  # Desktop vertical / Mobile horizontal
│   │
│   ├── tasks-container/
│   │   ├── components/
│   │   │   └── TasksContainer.tsx    # Drag-and-drop task list (Framer Reorder)
│   │   └── hooks/
│   │       ├── useAutoScrollOnDrag.ts
│   │       └── useOrderedTaskIds.ts
│   │
│   ├── task-editor/
│   │   └── components/
│   │       └── TaskEditor.tsx    # Rich task/note editor with container queries
│   │
│   ├── topics/
│   │   ├── components/
│   │   │   └── FloatingTopics.tsx    # Draggable bubble nodes + SVG wires
│   │   └── types.ts              # TopicPosition, TopicAnchor, WireBundle
│   │
│   └── layout/
│       └── components/
│           └── MainLayout.tsx    # Auth protection + ambient background
│
├── shared/                       # GLOBAL scope (available everywhere)
│   ├── types/
│   │   ├── index.ts              # Re-exports all types
│   │   ├── base.ts               # ID types (EntryId, TopicId, UserId, ISODate)
│   │   ├── entry.ts              # Entry, LegacyTask, LegacyNote, Attachment
│   │   ├── topic.ts              # Topic types
│   │   ├── reminder.ts           # Reminder types
│   │   ├── calendar.ts           # CalendarDay, TopicBubbleData
│   │   └── dto.ts                # CreateEntryInput, EntryPatch, etc.
│   │
│   ├── store/
│   │   └── index.ts              # Zustand global store
│   │
│   ├── constants/
│   │   └── index.ts              # TOPICS config, DAYS array
│   │
│   ├── lib/
│   │   ├── utils.ts              # cn, uid, clamp, median, quadPath
│   │   └── topics.ts             # getDefaultTopic, isDefaultTopicId
│   │
│   ├── hooks/                    # Shared hooks
│   └── ui/                       # Shared UI components
│
├── infrastructure/               # External services (Sentry, API clients)
└── test/
    └── setup.ts                  # Vitest setup
```

---

## 4. Import Rules (CRITICAL)

```
shared/         → can import from shared/ only
features/X/     → can import from shared/ AND features/X/ only
infrastructure/ → can import from shared/ only

❌ NEVER import across features (features/A/ → features/B/)
```

---

## 5. Zustand Store (`src/shared/store/index.ts`)

### State Shape

```typescript
interface AppState {
  // User
  currentUserId: UserId | null;

  // Auth
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;

  // Calendar/Date selection
  selectedDate: Date;
  selectedDay: number;  // 1-31
  setSelectedDate: (date: Date) => void;
  setSelectedDay: (day: number) => void;

  // Tasks (organized by day number)
  tasksByDay: TasksByDay;  // Record<number, LegacyTask[]>
  addTask: (day: number, title: string, topicId: TopicId) => void;
  removeTask: (day: number, taskId: string) => void;
  toggleTaskComplete: (day: number, taskId: string) => void;
  reorderTasks: (day: number, taskIds: string[]) => void;

  // Notes
  notes: NotesByDate;  // Record<ISODate, LegacyNote[]>
  addNote: (date: Date, content: string) => void;
  deleteNote: (date: Date, noteId: string) => void;

  // Topic UI state
  topicPositions: TopicPositions;  // Record<TopicId, {x, y}>
  setTopicPosition: (topicId: TopicId, position: TopicPosition) => void;
  highlightedTopic: TopicId | null;
  setHighlightedTopic: (topicId: TopicId | null) => void;

  // Multi-selection
  selectedTopicIds: TopicId[];
  toggleTopicSelection: (topicId: TopicId) => void;
  clearSelection: () => void;
}
```

### Persistence

Store is persisted to localStorage via `zustand/middleware/persist`:
- Key: `neuraal-storage:user_demo`
- Persisted: `isAuthenticated`, `tasksByDay`, `notes`, `topicPositions`

---

## 6. Core Types

### LegacyTask (current implementation)

```typescript
interface LegacyTask {
  readonly id: string;
  readonly userId: UserId;
  readonly title: string;
  readonly topicId: TopicId;
  readonly completed: boolean;
  readonly createdAt: number;
}

type TasksByDay = Record<number, LegacyTask[]>;  // day 1-31 → tasks
```

### DefaultTopicId

```typescript
type DefaultTopicId = "work" | "health" | "fun" | "family" | "learning" | "social";
```

### TOPICS Configuration

```typescript
const TOPICS: Record<DefaultTopicId, DefaultTopicConfig> = {
  work:     { id: "work",     name: "Trabajo",     color: "#e11d48", anchor: { xPct: 0.2,  yPct: 0.25 } },
  health:   { id: "health",   name: "Salud",       color: "#3b82f6", anchor: { xPct: 0.35, yPct: 0.4  } },
  fun:      { id: "fun",      name: "Ocio",        color: "#facc15", anchor: { xPct: 0.5,  yPct: 0.55 } },
  family:   { id: "family",   name: "Familia",     color: "#ec4899", anchor: { xPct: 0.25, yPct: 0.65 } },
  learning: { id: "learning", name: "Aprendizaje", color: "#8b5cf6", anchor: { xPct: 0.65, yPct: 0.35 } },
  social:   { id: "social",   name: "Social",      color: "#10b981", anchor: { xPct: 0.45, yPct: 0.7  } },
};
```

---

## 7. Responsive Layout System

### Dashboard Grid (3-column)

```
┌─────────────────────────────────────────────────────────────┐
│  DESKTOP (≥1024px)                                          │
├──────────────────┬────────────────────┬────────────────────┤
│   Tasks Area     │   Bubbles Lane     │   Calendar         │
│   minmax(280px,  │   clamp(260px,     │   180px fixed      │
│   1fr)           │   22vw, 400px)     │   (200px on xl)    │
└──────────────────┴────────────────────┴────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MOBILE (<1024px) - Vertical stack                          │
├─────────────────────────────────────────────────────────────┤
│   Tasks Area (flex-1)                                       │
├─────────────────────────────────────────────────────────────┤
│   Calendar (h-20, horizontal scroll)                        │
│   [1][2][3●][4][5●][6]...                                  │
└─────────────────────────────────────────────────────────────┘
```

### CSS Classes (Dashboard.tsx)

```tsx
className="h-full w-full relative overflow-hidden
           flex flex-col
           lg:grid lg:grid-cols-[minmax(280px,1fr)_clamp(260px,22vw,400px)_180px]
           xl:grid-cols-[minmax(320px,1fr)_clamp(320px,24vw,480px)_200px]"
```

### Container Queries (TaskEditor)

TaskEditor uses `@container` for component-level responsiveness:

```tsx
// Parent has @container class
className="task-editor glass-panel rounded-2xl p-5 w-full @container"

// Children use @[640px] breakpoint
className="flex flex-col gap-3 mb-2 @[640px]:flex-row @[640px]:items-center"
```

---

## 8. Key Components

### FloatingTopics (`src/features/topics/components/FloatingTopics.tsx`)

Visualization of topics as draggable bubbles with SVG wire connections.

**Features:**
- Draggable bubbles using pointer events (no library)
- SVG wires connect bubbles to calendar days/tasks
- Junction points (neuron dots) at wire split points
- RAF-based animation for smooth junction following
- Desktop: vertical layout, Mobile: horizontal strip
- Multi-selection support (click to select/deselect)

**Key refs (imperative for 60fps):**
- `nodePosRef` - visual position of each bubble
- `junctionRef` - junction point positions
- `pathElRef` - SVG path elements for direct d-attribute updates

### TasksContainer (`src/features/tasks-container/components/TasksContainer.tsx`)

High-performance drag-and-drop task list.

**Uses:**
- Framer Motion `Reorder.Group` / `Reorder.Item`
- Handle-only dragging (GripVertical icon)
- RAF-based auto-scroll near edges
- Memoized `TaskEditorWrapper` to prevent re-renders

### VerticalCalendar (`src/features/calendar/components/VerticalCalendar.tsx`)

Responsive calendar sidebar:
- **Desktop (lg+):** Vertical scrollable list with task pills per day
- **Mobile (<lg):** Horizontal scrollable row with day buttons + dot indicators

### TaskEditor (`src/features/task-editor/components/TaskEditor.tsx`)

Rich editor for tasks/notes:
- Entry type toggle (Task/Note)
- Topic selector with color dots
- Complete/incomplete toggle for tasks
- Content menu (Image, Code, YouTube, File)
- Auto-save with debounce
- Container queries for responsive layout

---

## 9. Utility Functions (`src/shared/lib/utils.ts`)

```typescript
// Tailwind class merging
function cn(...inputs: ClassValue[]): string

// Unique ID generation
function uid(): string  // e.g., "a1b2c3d-lz5k8m9"

// Number clamping
function clamp(n: number, min: number, max: number): number

// Array median
function median(values: number[]): number

// SVG quadratic bezier path
function quadPath(x1, y1, x2, y2, biasX): string
```

---

## 10. App Entry Point

```tsx
// src/app/page.tsx
export default function Home() {
  return (
    <MainLayout>      {/* Auth protection + logout button */}
      <Dashboard />   {/* 3-column grid with Tasks, Bubbles, Calendar */}
    </MainLayout>
  );
}
```

### Component Hierarchy

```
Home
└── MainLayout (auth check, ambient BG, logout)
    └── Dashboard (3-column grid)
        ├── FloatingTopics (absolute, z-15, pointer-events-none except bubbles)
        ├── Column 1: Tasks area
        │   ├── Header (date display with animation)
        │   └── TasksContainer
        │       └── Reorder.Group
        │           └── ReorderableTaskItem[]
        │               └── TaskEditorWrapper
        │                   └── TaskEditor
        ├── Column 2: Bubbles Lane (ref for FloatingTopics)
        └── Column 3: VerticalCalendar
```

---

## 11. Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run tests (watch mode)
pnpm test:run     # Run tests once
pnpm test:coverage # With coverage
pnpm lint         # ESLint
pnpm type-check   # TypeScript check
```

---

## 12. Key Patterns

### 1. Feature-scoped modules
Each feature is self-contained with its own components, hooks, and types.

### 2. Imperative DOM updates for performance
FloatingTopics uses refs + RAF for 60fps animations without React re-renders.

### 3. Container queries over media queries
TaskEditor responds to its own width, not viewport.

### 4. Framer Motion Reorder for drag-and-drop
No HTML5 drag API - uses motion values for smooth 60fps dragging.

### 5. Zustand selectors
Components subscribe only to needed state slices:
```typescript
const selectedDay = useStore((s) => s.selectedDay);
```

---

## 13. Current Branch Changes (`fix/responsive-layout`)

Modified files:
- `Dashboard.tsx` - Mobile calendar height `h-48` → `h-20`
- `VerticalCalendar.tsx` - Added horizontal mobile calendar view
- `TaskEditor.tsx` - Container queries for responsive layout

---

## 14. Testing

- **Unit tests:** `*.test.ts` / `*.test.tsx` (colocated)
- **Framework:** Vitest + Testing Library + jsdom
- **Pattern:** Test behavior, not implementation

```typescript
// Example test
describe("TaskEditor", () => {
  it("should toggle completed state when checkbox clicked", async () => {
    // ...
  });
});
```

---

## 15. Style Guidelines

- **English:** All code, comments, and commit messages
- **Spanish:** UI text/labels (user-facing)
- **Responsive-first:** Mobile layout defined first
- **Accessibility:** Labels, ARIA, keyboard support
- **No overengineering:** Minimal changes for requirements

---

## 16. Architecture Decisions (ADRs)

| ADR | Decision |
|-----|----------|
| 001 | Next.js App Router + feature-first structure |
| 002 | Feature-scoped state first, Zustand for global |
| 003 | Vitest + Testing Library + Playwright |
| 004 | JWT access/refresh tokens + httpOnly cookies |
| 005 | Sentry for observability |
| 006 | OAuth + Auth.js + Postgres sessions |
| 007 | Hybrid persistence (Postgres + S3) |
| 008 | n8n for async job orchestration |

---

## 17. Environment

- Windows 11
- Node.js LTS
- pnpm 9.15.0

---

*Last updated: 2026-02-03*
