import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TasksContainer } from "./TasksContainer";
import type { ApiEntry } from "@/shared/api/sdk";

const dragStartFromHandleMock = vi.fn();
const startAutoScrollMock = vi.fn();
const stopAutoScrollMock = vi.fn();
const updatePointerPositionMock = vi.fn();
const commitOrderMock = vi.fn();
const setOrderedIdsMock = vi.fn();
const createEntryAndInvalidateMock = vi.fn();
const reorderEntriesAndInvalidateMock = vi.fn();
const setScrollToEntryIdMock = vi.fn();

let storeState: {
  selectedDate: Date;
  scrollToEntryId: string | null;
};
let orderedIdsState: string[] = [];
let entriesState: ApiEntry[] = [];
let containerEl: HTMLDivElement;
let scrollToSpy: ReturnType<typeof vi.fn>;
let scrollBySpy: ReturnType<typeof vi.fn>;

function createEntry(
  id: string,
  title: string,
  overrides: Partial<ApiEntry> = {},
): ApiEntry {
  return {
    id,
    userId: "user-123",
    date: "2024-01-15",
    type: "task",
    title,
    content: null,
    topicId: null,
    completed: false,
    summary: null,
    summaryUpdatedAt: null,
    version: 1,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    ...overrides,
  } as ApiEntry;
}

vi.mock("framer-motion", () => ({
  Reorder: {
    Group: React.forwardRef(function MockGroup(
      {
        children,
        onReorder,
        ...rest
      }: {
        children: React.ReactNode;
        onReorder?: (ids: string[]) => void;
      } & React.HTMLAttributes<HTMLUListElement>,
      ref: React.Ref<HTMLUListElement>,
    ) {
      const safe = rest as React.HTMLAttributes<HTMLUListElement>;
      return (
        <ul
          ref={ref}
          data-testid={safe["data-testid"]}
          aria-label={safe["aria-label"]}
          className={safe.className}
        >
          <button
            type="button"
            data-testid="mock-reorder-trigger"
            onClick={() => onReorder?.(["entry-2", "entry-1"])}
          >
            reorder
          </button>
          {children}
        </ul>
      );
    }),
    Item: ({
      children,
      value,
      onDragStart,
      onDragEnd,
      onDrag,
      ...rest
    }: {
      children: React.ReactNode;
      value: string;
      onDragStart?: () => void;
      onDragEnd?: () => void;
      onDrag?: (_: unknown, info: { point: { y: number } }) => void;
    } & React.HTMLAttributes<HTMLLIElement>) => {
      const safe = rest as React.HTMLAttributes<HTMLLIElement>;
      return (
        <li
          data-testid={safe["data-testid"]}
          data-completed={safe["data-completed"]}
          role={safe.role}
          aria-label={safe["aria-label"]}
          className={safe.className}
        >
          <button
            type="button"
            data-testid={`mock-drag-start-${value}`}
            onClick={() => onDragStart?.()}
          >
            drag-start
          </button>
          <button
            type="button"
            data-testid={`mock-drag-move-${value}`}
            onClick={() => onDrag?.({}, { point: { y: 360 } })}
          >
            drag-move
          </button>
          <button
            type="button"
            data-testid={`mock-drag-end-${value}`}
            onClick={() => onDragEnd?.()}
          >
            drag-end
          </button>
          {children}
        </li>
      );
    },
  },
  useDragControls: () => ({
    start: dragStartFromHandleMock,
  }),
}));

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      ...storeState,
      setScrollToEntryId: setScrollToEntryIdMock,
    }),
  ),
  selectDateKey: (state: { selectedDate: Date }) => {
    const d = state.selectedDate;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },
}));

vi.mock("@/shared/api/queries", () => ({
  useEntriesByDateQuery: vi.fn(() => ({
    data: entriesState,
    isPending: false,
  })),
}));

vi.mock("@/shared/api/mutations", () => ({
  createEntryAndInvalidate: (...args: unknown[]) =>
    createEntryAndInvalidateMock(...args),
  reorderEntriesAndInvalidate: (...args: unknown[]) =>
    reorderEntriesAndInvalidateMock(...args),
}));

vi.mock("@/features/task-editor", () => ({
  TaskEditor: ({ entry }: { entry: ApiEntry }) => (
    <div data-testid={`editor-${entry.id}`}>{entry.title}</div>
  ),
  MobileEditorOverlay: () => null,
}));

vi.mock("../hooks", () => ({
  useAutoScrollOnDrag: () => ({
    containerRef: { current: containerEl },
    startAutoScroll: startAutoScrollMock,
    stopAutoScroll: stopAutoScrollMock,
    updatePointerPosition: updatePointerPositionMock,
  }),
  useOrderedTaskIds: ({
    onReorder,
  }: {
    onReorder: (day: string, newOrder: string[]) => void;
  }) => ({
    orderedIds: orderedIdsState,
    setOrderedIds: (...args: unknown[]) => {
      setOrderedIdsMock(...args);
      const ids = args[0] as string[];
      onReorder("2024-01-15", ids);
    },
    commitOrder: commitOrderMock,
  }),
}));

function renderContainer() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TasksContainer />
    </QueryClientProvider>,
  );
}

describe("TasksContainer behavior coverage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    scrollToSpy = vi.fn();
    scrollBySpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollToSpy,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      writable: true,
      value: scrollBySpy,
    });
    entriesState = [
      createEntry("entry-1", "Task one"),
      createEntry("entry-2", "Task two"),
    ];
    orderedIdsState = ["entry-1", "missing-entry", "entry-2"];
    storeState = {
      selectedDate: new Date("2024-01-15"),
      scrollToEntryId: null,
    };
    setScrollToEntryIdMock.mockImplementation((v: string | null) => {
      storeState.scrollToEntryId = v;
    });
    createEntryAndInvalidateMock.mockResolvedValue(
      createEntry("entry-new", "New"),
    );
    reorderEntriesAndInvalidateMock.mockResolvedValue(undefined);

    containerEl = document.createElement("div");
    Object.defineProperty(containerEl, "scrollTop", {
      configurable: true,
      writable: true,
      value: 30,
    });
    Object.defineProperty(containerEl, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(containerEl, "clientHeight", {
      configurable: true,
      get: () => 240,
    });
    containerEl.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 340,
        left: 0,
        right: 500,
        width: 500,
        height: 240,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips unknown ordered IDs and renders existing entries only", () => {
    renderContainer();
    expect(screen.getByTestId("editor-entry-1")).toBeInTheDocument();
    expect(screen.getByTestId("editor-entry-2")).toBeInTheDocument();
    expect(
      screen.queryByTestId("editor-missing-entry"),
    ).not.toBeInTheDocument();
  });

  it("starts drag from handle and runs drag lifecycle callbacks", async () => {
    renderContainer();

    fireEvent.pointerDown(screen.getAllByTestId("drag-handle")[0], {
      pointerId: 1,
      clientX: 20,
      clientY: 20,
    });
    expect(dragStartFromHandleMock).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("mock-drag-start-entry-1"));
    fireEvent.click(screen.getByTestId("mock-drag-move-entry-1"));
    fireEvent.click(screen.getByTestId("mock-drag-end-entry-1"));

    expect(startAutoScrollMock).toHaveBeenCalledTimes(1);
    expect(updatePointerPositionMock).toHaveBeenCalledWith(360);
    expect(stopAutoScrollMock).toHaveBeenCalledTimes(1);
    expect(commitOrderMock).toHaveBeenCalledTimes(1);
  });

  it("persists reorder changes and swallows persistence errors", async () => {
    reorderEntriesAndInvalidateMock.mockRejectedValueOnce(new Error("boom"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    renderContainer();

    fireEvent.click(screen.getByTestId("mock-reorder-trigger"));
    await vi.advanceTimersByTimeAsync(0);
    expect(setOrderedIdsMock).toHaveBeenCalledWith(["entry-2", "entry-1"]);
    expect(reorderEntriesAndInvalidateMock).toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[TasksContainer] Failed to persist entry order:",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it("scrolls after adding a new task", async () => {
    renderContainer();

    fireEvent.click(screen.getByRole("button", { name: /add new task/i }));
    await vi.advanceTimersByTimeAsync(0);
    expect(createEntryAndInvalidateMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120);
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        top: expect.any(Number),
        behavior: "smooth",
      }),
    );
  });

  it("scrolls to requested entry and clears navigation target", async () => {
    storeState.scrollToEntryId = "entry-2";
    renderContainer();

    const target = screen.getByTestId("task-editor-wrapper-entry-2");
    target.getBoundingClientRect = () =>
      ({
        top: 320,
        bottom: 420,
        left: 0,
        right: 500,
        width: 500,
        height: 100,
        x: 0,
        y: 320,
        toJSON: () => ({}),
      }) as DOMRect;

    await vi.advanceTimersByTimeAsync(120);
    expect(scrollToSpy).toHaveBeenCalled();
    expect(target.classList.contains("scroll-highlight")).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    expect(target.classList.contains("scroll-highlight")).toBe(false);
    expect(setScrollToEntryIdMock).toHaveBeenCalledWith(null);
  });

  it("clears missing scroll target after max attempts", async () => {
    storeState.scrollToEntryId = "not-found";
    renderContainer();

    await vi.advanceTimersByTimeAsync(2200);
    expect(setScrollToEntryIdMock).toHaveBeenCalledWith(null);
  });

  it("auto-scrolls when editor expansion increases height", async () => {
    renderContainer();
    const wrapper = screen
      .getByTestId("editor-entry-1")
      .closest(".relative") as HTMLDivElement;
    let h = 100;
    Object.defineProperty(wrapper, "offsetHeight", {
      configurable: true,
      get: () => h,
    });
    wrapper.getBoundingClientRect = () =>
      ({
        top: 180,
        bottom: 460,
        left: 0,
        right: 500,
        width: 500,
        height: 280,
        x: 0,
        y: 180,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(wrapper);
    h = 180;
    await vi.advanceTimersByTimeAsync(300);

    expect(scrollBySpy).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: "smooth",
    });
  });
});
