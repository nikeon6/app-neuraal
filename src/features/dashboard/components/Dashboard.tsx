"use client";

import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { useStore, selectDateKey } from "@/shared/store";
import { cn } from "@/shared/lib";
import {
  useEntriesForDates,
  useSummaryDoneWatcher,
  useTranscriptionDoneWatcher,
} from "@/shared/api/queries";
import { FloatingTopics } from "@/features/topics/components/FloatingTopics";
import { TopicsSection } from "@/features/topics/components/TopicsSection";
import { TasksContainer } from "@/features/tasks-container";
import { StickiesContainer } from "@/features/stickies";
import { VerticalCalendar } from "@/features/calendar/components/VerticalCalendar";
import { DashboardHeader } from "./DashboardHeader";
import { NotificationCenter } from "@/features/notifications";
import { WeeklyRecap } from "@/features/weekly-recap";
import { SettingsPanel } from "@/features/settings";
import "@/features/tasks-container/styles/scrollbar.css";

/*
 * LAYOUT RESPONSIVE (2 breakpoints):
 *
 * < lg (< 1024px): Stack vertical (flex-col) — mobile portrait & landscape
 *   - Tasks: flex-1 min-h-0 with internal scroll
 *   - Lane: horizontal strip (h-[120px] to h-[200px])
 *   - Calendar: fixed height strip (h-20) + safe-area
 *   - NOTE: landscape mobile uses the SAME layout (no special compact mode)
 *
 * >= lg (1024px+): Grid 3 columns — desktop
 *   - Tasks: minmax(280px, 1fr)
 *   - Lane: clamp(260px, 22vw, 400px)
 *   - Calendar: 180px
 *
 * >= xl (1280px+): Grid 3 columns with more space
 *   - Lane: clamp(320px, 24vw, 480px)
 *   - Calendar: 200px
 *
 * FIX ANDROID: visualViewport API + CSS variable --app-height
 * - 100vh on Android includes browser chrome, causing phantom scroll
 * - visualViewport.height gives the REAL visible viewport
 * - --app-height is set dynamically on viewport changes
 * - overflow-hidden on root + min-h-0 on flex children prevents content push
 */

export function Dashboard() {
  const {
    selectedDate,
    clearSelection,
    selectedTopicIds,
    expandedDayKeys,
    dashboardSection,
    setDashboardSection,
    setSelectedDate,
    setScrollToEntryId,
  } = useStore();

  // Month date keys for calendar and floating topics (data from TanStack Query)
  const monthDateKeys = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start, end });
    return days.map((d) => format(d, "yyyy-MM-dd"));
  }, [selectedDate]);

  const { entriesByDate } = useEntriesForDates(monthDateKeys);

  // Watch for SUMMARY_DONE notifications and auto-refresh entries
  const currentDateKey = useStore(selectDateKey);
  useSummaryDoneWatcher(currentDateKey);
  useTranscriptionDoneWatcher(currentDateKey);

  // Ref for the main container (used by FloatingTopics)
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Ref for the bubbles lane (used by FloatingTopics)
  const laneRef = useRef<HTMLDivElement | null>(null);

  // Dynamic viewport height for Android fix
  const [appHeight, setAppHeight] = useState<string>("100dvh");

  // Virtual keyboard detection — hides bubbles lane & calendar on mobile when keyboard is open
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // FIX ANDROID: Use visualViewport to get real viewport height
  // Also detect virtual keyboard open (viewport significantly shorter than screen)
  useEffect(() => {
    // Only detect virtual keyboard on touch-only devices (phones/tablets).
    // This avoids false positives when resizing desktop browser windows
    // (where screen.height >> viewport height triggers the heuristic incorrectly).
    const touchOnlyMql = matchMedia("(hover: none) and (pointer: coarse)");

    const update = () => {
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setAppHeight(`${vh}px`);
      document.documentElement.style.setProperty("--app-height", `${vh}px`);
      // Keyboard detection: viewport is much shorter than the full screen height
      // Gate behind touch-only check to prevent false positives on desktop
      const isTouchOnly = touchOnlyMql.matches;
      const fullHeight = window.screen.height;
      const isKb = isTouchOnly && vh < fullHeight * 0.65 && vw < 1024;
      setIsKeyboardOpen(isKb);
    };

    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", () => setTimeout(update, 150));

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // Navigate to an entry when user clicks "Go to entry" in the notification center.
  // Searches the current month's cached entries and switches the date + section.
  const handleNavigateToEntry = useCallback(
    (entryId: string) => {
      // Search in the cached entriesByDate for the entry
      for (const [dateKey, entries] of Object.entries(entriesByDate)) {
        const found = entries.find((e) => e.id === entryId);
        if (found) {
          // Navigate to that day
          const [year, month, day] = dateKey.split("-").map(Number);
          setSelectedDate(new Date(year, month - 1, day));
          // Ensure we are on the daily view
          if (dashboardSection !== "daily") {
            setDashboardSection("daily");
          }
          // Request TasksContainer to scroll to this entry
          setScrollToEntryId(entryId);
          return;
        }
      }
      // If entry not found in cache, just switch to daily (user can find it manually)
      if (dashboardSection !== "daily") {
        setDashboardSection("daily");
      }
    },
    [
      entriesByDate,
      setSelectedDate,
      dashboardSection,
      setDashboardSection,
      setScrollToEntryId,
    ],
  );

  // Handle click on the lane (bubbles board) - clearSelection when clicking empty space
  const handleLaneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only trigger if clicking directly on the lane (not on topic nodes)
      const target = e.target as HTMLElement;

      // Don't clear if clicking on a topic node
      if (target.closest(".topic-node")) return;

      // Clear selection if there's any active selection or expanded days
      if (selectedTopicIds.length > 0 || expandedDayKeys.length > 0) {
        clearSelection();
      }
    },
    [selectedTopicIds, expandedDayKeys, clearSelection],
  );

  // When stickies section: hide topics lane and use 2-col layout (content + calendar)
  const showTopicsLane = dashboardSection !== "stickies";

  // Render content based on active section
  const renderContent = () => {
    switch (dashboardSection) {
      case "daily":
        return <TasksContainer />;
      case "weeklyRecap":
        return <WeeklyRecap />;
      case "stickies":
        return <StickiesContainer />;
      case "topics":
        return <TopicsSection />;
      case "settings":
        return <SettingsPanel />;
      default:
        return <TasksContainer />;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ height: appHeight, minHeight: appHeight }}
      className={cn(
        "w-full relative overflow-hidden",
        showTopicsLane
          ? "flex flex-col lg:grid lg:grid-cols-[minmax(280px,1fr)_clamp(260px,22vw,400px)_180px] xl:grid-cols-[minmax(320px,1fr)_clamp(320px,24vw,480px)_200px]"
          : "flex flex-col lg:grid lg:grid-cols-[1fr_180px] xl:grid-cols-[1fr_200px]",
      )}
    >
      {/* Floating topics visualization - only when not on stickies section */}
      {showTopicsLane && !isKeyboardOpen && (
        <FloatingTopics
          containerRef={containerRef}
          laneRef={laneRef}
          entriesByDate={entriesByDate}
        />
      )}

      {/* Column 1: Tasks area */}
      <div className="relative flex flex-col z-10 min-w-0 min-h-0 overflow-hidden flex-1 lg:flex-none px-3 pt-3 pb-1 md:p-6 lg:p-8 lg:pr-2 order-1 lg:order-none landscape-compact-tasks">
        {/* Header with navigation and title */}
        <DashboardHeader
          section={dashboardSection}
          onChangeSection={setDashboardSection}
          selectedDate={selectedDate}
          notificationSlot={
            <NotificationCenter onNavigateToEntry={handleNavigateToEntry} />
          }
        />

        {/* Content area - shows different content based on section */}
        <div className="relative flex-1 overflow-hidden min-w-0 min-h-0">
          {renderContent()}
        </div>
      </div>

      {/* Column 2: Bubbles lane (not rendered when stickies section) */}
      {showTopicsLane && (
        <div
          ref={laneRef}
          className={cn(
            "relative min-w-0 flex-shrink-0 order-2 lg:order-none h-[120px] sm:h-[150px] md:h-[200px] lg:h-auto landscape-mobile-hidden",
            isKeyboardOpen && "hidden",
          )}
          aria-hidden="true"
          onClick={handleLaneClick}
        />
      )}

      {/* Column 3: Calendar sidebar (hidden when keyboard open on mobile) */}
      <aside
        className={cn(
          "relative z-20 min-w-0 flex-shrink-0 overflow-hidden h-20 lg:h-full order-3 lg:order-none pb-[env(safe-area-inset-bottom)] landscape-mobile-hidden",
          isKeyboardOpen && "hidden",
        )}
      >
        <VerticalCalendar entriesByDate={entriesByDate} />
      </aside>
    </div>
  );
}
