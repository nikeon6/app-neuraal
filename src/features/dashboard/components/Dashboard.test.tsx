import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ApiEntry } from "@/shared/api/sdk";
import { Dashboard } from "./Dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

type DashboardSection =
  | "daily"
  | "weeklyRecap"
  | "stickies"
  | "topics"
  | "settings";

const storeFns = {
  clearSelection: vi.fn(),
  setDashboardSection: vi.fn(),
  setSelectedDate: vi.fn(),
  setScrollToEntryId: vi.fn(),
};

const storeState: {
  selectedDate: Date;
  selectedTopicIds: string[];
  expandedDayKeys: string[];
  dashboardSection: DashboardSection;
} = {
  selectedDate: new Date(2026, 1, 11),
  selectedTopicIds: [],
  expandedDayKeys: [],
  dashboardSection: "daily",
};

let entriesByDateMock: Record<string, ApiEntry[]> = {};

const notificationNavigateSpy = vi.fn();

vi.mock("@/shared/store", () => ({
  useStore: (selector?: (state: { selectedDate: Date }) => string) => {
    const fullState = {
      selectedDate: storeState.selectedDate,
      clearSelection: storeFns.clearSelection,
      selectedTopicIds: storeState.selectedTopicIds,
      expandedDayKeys: storeState.expandedDayKeys,
      dashboardSection: storeState.dashboardSection,
      setDashboardSection: storeFns.setDashboardSection,
      setSelectedDate: storeFns.setSelectedDate,
      setScrollToEntryId: storeFns.setScrollToEntryId,
    };
    return selector ? selector(fullState) : fullState;
  },
  selectDateKey: (state: { selectedDate: Date }) =>
    `${state.selectedDate.getFullYear()}-${String(
      state.selectedDate.getMonth() + 1,
    ).padStart(
      2,
      "0",
    )}-${String(state.selectedDate.getDate()).padStart(2, "0")}`,
}));

const mockTopics = vi.fn().mockReturnValue({ data: [] });

vi.mock("@/shared/api/queries", () => ({
  useEntriesForDates: () => ({ entriesByDate: entriesByDateMock }),
  useSummaryDoneWatcher: vi.fn(),
  useTranscriptionDoneWatcher: vi.fn(),
  useReminderDoneWatcher: vi.fn(),
  useTopicsQuery: () => mockTopics(),
}));

vi.mock("@/features/topics/components/FloatingTopics", () => ({
  FloatingTopics: () => <div data-testid="floating-topics" />,
}));

vi.mock("@/features/topics/components/TopicsLaneEmptyState", () => ({
  TopicsLaneEmptyState: () => (
    <div data-testid="topics-lane-empty">empty-state</div>
  ),
}));

vi.mock("@/features/topics/components/TopicsSection", () => ({
  TopicsSection: () => <div data-testid="topics-section">topics-section</div>,
}));

vi.mock("@/features/tasks-container", () => ({
  TasksContainer: () => (
    <div data-testid="tasks-container">tasks-container</div>
  ),
}));

vi.mock("@/features/stickies", () => ({
  StickiesContainer: () => (
    <div data-testid="stickies-container">stickies-container</div>
  ),
}));

vi.mock("@/features/calendar/components/VerticalCalendar", () => ({
  VerticalCalendar: () => (
    <div data-testid="vertical-calendar">vertical-calendar</div>
  ),
}));

vi.mock("./DashboardHeader", () => ({
  DashboardHeader: ({
    notificationSlot,
  }: {
    notificationSlot: React.ReactNode;
  }) => <div data-testid="dashboard-header">{notificationSlot}</div>,
}));

vi.mock("@/features/notifications", () => ({
  NotificationCenter: ({
    onNavigateToEntry,
  }: {
    onNavigateToEntry: (entryId: string) => void;
  }) => (
    <button
      type="button"
      data-testid="notification-navigate"
      onClick={() => {
        notificationNavigateSpy();
        onNavigateToEntry("entry-2");
      }}
    >
      nav
    </button>
  ),
}));

vi.mock("@/features/weekly-recap", () => ({
  WeeklyRecap: () => <div data-testid="weekly-recap">weekly-recap</div>,
}));

vi.mock("@/features/settings/components/AiUsagePanel", () => ({
  AiUsagePanel: () => <div data-testid="ai-usage-panel">ai-usage</div>,
}));

vi.mock("@/features/settings/components/StorageUsagePanel", () => ({
  StorageUsagePanel: () => (
    <div data-testid="storage-usage-panel">storage-usage</div>
  ),
}));

vi.mock("@/features/settings/components/PhoneNumberForm", () => ({
  PhoneNumberForm: () => (
    <div data-testid="phone-number-form">phone-number</div>
  ),
}));

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entriesByDateMock = {};
    storeState.selectedDate = new Date(2026, 1, 11);
    storeState.selectedTopicIds = [];
    storeState.expandedDayKeys = [];
    storeState.dashboardSection = "daily";

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    Object.defineProperty(globalThis, "visualViewport", {
      configurable: true,
      value: {
        width: 1280,
        height: 720,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders daily section content by default", () => {
    render(<Dashboard />);
    expect(screen.getByTestId("tasks-container")).toBeInTheDocument();
    expect(screen.getByTestId("floating-topics")).toBeInTheDocument();
    expect(screen.getByTestId("vertical-calendar")).toBeInTheDocument();
  });

  it("renders stickies section and hides topics lane", () => {
    storeState.dashboardSection = "stickies";
    render(<Dashboard />);

    expect(screen.getByTestId("stickies-container")).toBeInTheDocument();
    expect(screen.queryByTestId("floating-topics")).not.toBeInTheDocument();
  });

  it("renders settings section panels", () => {
    storeState.dashboardSection = "settings";
    render(<Dashboard />);

    expect(screen.getByTestId("storage-usage-panel")).toBeInTheDocument();
    expect(screen.getByTestId("ai-usage-panel")).toBeInTheDocument();
  });

  it("renders topics section", () => {
    storeState.dashboardSection = "topics";
    render(<Dashboard />);
    expect(screen.getByTestId("topics-section")).toBeInTheDocument();
  });

  it("computes hasAssignedTopics when topics and entries exist", () => {
    mockTopics.mockReturnValueOnce({
      data: [{ id: "t1", name: "Work", color: "#fff" }],
    });
    entriesByDateMock = {
      "2026-02-11": [{ id: "e1", topicId: "t1" } as ApiEntry],
    };
    render(<Dashboard />);
    expect(screen.getByTestId("tasks-container")).toBeInTheDocument();
  });

  it("clears selection when clicking empty lane", () => {
    storeState.selectedTopicIds = ["topic-1"];
    render(<Dashboard />);
    const lane = screen.getByTestId("topics-lane");
    fireEvent.click(lane);
    expect(storeFns.clearSelection).toHaveBeenCalledTimes(1);
  });

  it("navigates to entry date from notification action", () => {
    entriesByDateMock = {
      "2026-02-10": [{ id: "entry-2" } as ApiEntry],
    };
    storeState.dashboardSection = "weeklyRecap";
    render(<Dashboard />);

    fireEvent.click(screen.getByTestId("notification-navigate"));

    expect(notificationNavigateSpy).toHaveBeenCalledTimes(1);
    expect(storeFns.setScrollToEntryId).toHaveBeenCalledWith("entry-2");
    expect(storeFns.setDashboardSection).toHaveBeenCalledWith("daily");
    expect(storeFns.setSelectedDate).toHaveBeenCalledWith(expect.any(Date));
  });

  it("detects virtual keyboard on touch-only mobile devices", () => {
    const mediaListeners: Record<string, (() => void)[]> = {};
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("hover: none") || query.includes("max-width"),
        addEventListener: vi.fn((_: string, fn: () => void) => {
          (mediaListeners[query] ??= []).push(fn);
        }),
        removeEventListener: vi.fn(),
      })),
    );

    const vvListeners: Record<string, (() => void)[]> = {};
    const vv = {
      width: 400,
      height: 800,
      addEventListener: vi.fn((event: string, fn: () => void) => {
        (vvListeners[event] ??= []).push(fn);
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(globalThis, "visualViewport", {
      configurable: true,
      value: vv,
    });

    render(<Dashboard />);

    // Simulate keyboard opening (viewport shrinks significantly)
    vv.height = 400;
    act(() => {
      vvListeners["resize"]?.forEach((fn) => fn());
    });

    // Simulate keyboard closing (viewport returns to normal)
    vv.height = 800;
    act(() => {
      vvListeners["resize"]?.forEach((fn) => fn());
    });

    // Simulate orientation change
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
  });
});
