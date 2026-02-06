"use client";

import React, { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { useStore } from "@/shared/store";
import { useEntriesForDates } from "@/shared/api/queries";
import { FloatingTopics } from "@/features/topics/components/FloatingTopics";
import { TopicsSection } from "@/features/topics/components/TopicsSection";
import { TasksContainer } from "@/features/tasks-container";
import { VerticalCalendar } from "@/features/calendar/components/VerticalCalendar";
import { DashboardHeader } from "./DashboardHeader";
import { NotificationCenter } from "@/features/notifications";

/*
 * LAYOUT RESPONSIVE (3 breakpoints):
 * 
 * < lg (< 1024px): Stack vertical (flex-col)
 *   - Tasks ocupa espacio principal (flex-1 min-h-0) con scroll interno
 *   - Lane VISIBLE como franja horizontal (h-[200px] - h-[240px])
 *   - Calendar abajo con altura fija (h-20) + safe-area
 * 
 * >= lg (1024px+): Grid 3 columnas
 *   - Tasks: minmax(280px, 1fr) - flexible, mínimo 280px
 *   - Lane: clamp(220px, 19vw, 340px) - espacio vertical para bolitas
 *   - Calendar: 180px fijo
 * 
 * >= xl (1280px+): Grid 3 columnas con más espacio
 *   - Lane: clamp(280px, 21vw, 400px)
 *   - Calendar: 200px fijo
 * 
 * FIX ANDROID: visualViewport API + CSS variable --app-height
 * - 100vh en Android incluye la barra del navegador, causando scroll fantasma
 * - visualViewport.height nos da el viewport REAL visible
 * - Seteamos --app-height dinámicamente cuando cambia el viewport
 * - overflow-hidden en root + min-h-0 en flex children evita que el contenido empuje
 */

// Placeholder component for sections not yet implemented
function SectionPlaceholder({ title }: Readonly<{ title: string }>) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl p-8 text-center max-w-md">
        <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
        <p className="text-white/50 text-sm">Coming soon</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const {
    selectedDate,
    selectedDay,
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

  // Ref for the main container (used by FloatingTopics)
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Ref for the bubbles lane (used by FloatingTopics)
  const laneRef = useRef<HTMLDivElement | null>(null);

  // Dynamic viewport height for Android fix
  const [appHeight, setAppHeight] = useState<string>("100dvh");

  // FIX ANDROID: Use visualViewport to get real viewport height
  // This handles the browser bar showing/hiding correctly
  useEffect(() => {
    const updateHeight = () => {
      // Use visualViewport if available (better for mobile browsers)
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setAppHeight(`${vh}px`);
      // Also set CSS variable for any children that need it
      document.documentElement.style.setProperty("--app-height", `${vh}px`);
    };

    // Initial update
    updateHeight();

    // Listen to visualViewport changes (Android browser bar)
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateHeight);
      vv.addEventListener("scroll", updateHeight);
    }

    // Fallback listeners
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateHeight);
        vv.removeEventListener("scroll", updateHeight);
      }
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
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
    [entriesByDate, setSelectedDate, dashboardSection, setDashboardSection, setScrollToEntryId]
  );

  // Handle click on the lane (bubbles board) - clearSelection when clicking empty space
  const handleLaneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only trigger if clicking directly on the lane (not on topic nodes)
      const target = e.target as HTMLElement;
      
      // Don't clear if clicking on a topic node
      if (target.closest('.topic-node')) return;
      
      // Clear selection if there's any active selection or expanded days
      if (selectedTopicIds.length > 0 || expandedDayKeys.length > 0) {
        clearSelection();
      }
    },
    [selectedTopicIds, expandedDayKeys, clearSelection]
  );

  // Render content based on active section
  const renderContent = () => {
    switch (dashboardSection) {
      case "daily":
        return <TasksContainer />;
      case "weeklyRecap":
        return <SectionPlaceholder title="Weekly Recap" />;
      case "stickies":
        return <SectionPlaceholder title="Stickies" />;
      case "topics":
        return <TopicsSection />;
      case "settings":
        return <SectionPlaceholder title="Settings" />;
      default:
        return <TasksContainer />;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ height: appHeight, minHeight: appHeight }}
      className="w-full relative overflow-hidden
                 flex flex-col
                 lg:grid lg:grid-cols-[minmax(280px,1fr)_clamp(260px,22vw,400px)_180px]
                 xl:grid-cols-[minmax(320px,1fr)_clamp(320px,24vw,480px)_200px]"
    >
      {/* Floating topics visualization - covers entire area */}
      <FloatingTopics
        containerRef={containerRef}
        laneRef={laneRef}
        entriesByDate={entriesByDate}
      />

      {/* Column 1: Tasks area - flex-1 en mobile para que ocupe espacio principal */}
      <div className="relative flex flex-col z-10 min-w-0 min-h-0 overflow-hidden flex-1 lg:flex-none p-4 md:p-6 lg:p-8 lg:pr-2 order-1 lg:order-none">
        {/* Header with navigation and title */}
        <DashboardHeader
          section={dashboardSection}
          onChangeSection={setDashboardSection}
          selectedDate={selectedDate}
          notificationSlot={<NotificationCenter onNavigateToEntry={handleNavigateToEntry} />}
        />

        {/* Content area - shows different content based on section */}
        <div className="relative flex-1 overflow-hidden min-w-0 min-h-0">
          {renderContent()}
        </div>
      </div>

      {/* Column 2: Bubbles lane - horizontal strip in mobile, vertical column in lg+ */}
      {/* Mobile: taller lane for better bubble space (h-[200px] - h-[240px]) */}
      {/* Click on empty space clears selection */}
      <div
        ref={laneRef}
        className="relative min-w-0 flex-shrink-0
                   order-2 lg:order-none
                   h-[200px] sm:h-[220px] md:h-[240px] lg:h-auto"
        aria-hidden="true"
        onClick={handleLaneClick}
      />

      {/* Column 3: Calendar sidebar
          - Mobile: compact horizontal calendar, minimal height + safe-area padding
          - Desktop: full vertical calendar with tasks
          - overflow-hidden para forzar que respete el ancho de la columna del grid
          - pb-[env(safe-area-inset-bottom)] para dispositivos con notch/gesture bar */}
      <aside className="h-20 lg:h-full relative z-20 min-w-0 flex-shrink-0 overflow-hidden order-3 lg:order-none pb-[env(safe-area-inset-bottom)]">
        <VerticalCalendar entriesByDate={entriesByDate} />
      </aside>
    </div>
  );
}
