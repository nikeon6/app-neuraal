"use client";

import React, { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar, Bell, LayoutGrid, StickyNote, Users, Settings } from "lucide-react";
import { useStore, type DashboardSection } from "@/shared/store";
import { FloatingTopics } from "@/features/topics/components/FloatingTopics";
import { TopicsSection } from "@/features/topics/components/TopicsSection";
import { TasksContainer } from "@/features/tasks-container";
import { VerticalCalendar } from "@/features/calendar/components/VerticalCalendar";
import { cn } from "@/shared/lib/utils";

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

// Navigation tab configuration
interface NavTab {
  id: DashboardSection;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Section labels map - reusable for kicker, title, and nav
const SECTION_LABELS: Record<DashboardSection, string> = {
  daily: "Daily Log",
  weeklyRecap: "Weekly Recap",
  stickies: "Stickies",
  topics: "Topics",
  settings: "Settings",
};

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
  } = useStore();

  // Ref for the main container (used by FloatingTopics)
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Ref for the bubbles lane (used by FloatingTopics)
  const laneRef = useRef<HTMLDivElement | null>(null);

  // Dynamic viewport height for Android fix
  const [appHeight, setAppHeight] = useState<string>("100dvh");

  // Navigation tabs configuration (memoized to avoid re-renders)
  const navTabs = useMemo<NavTab[]>(() => [
    { id: "daily", label: SECTION_LABELS.daily, icon: Calendar },
    { id: "weeklyRecap", label: SECTION_LABELS.weeklyRecap, icon: LayoutGrid },
    { id: "stickies", label: SECTION_LABELS.stickies, icon: StickyNote },
    { id: "topics", label: SECTION_LABELS.topics, icon: Users },
    { id: "settings", label: SECTION_LABELS.settings, icon: Settings },
  ], []);

  const isDaily = dashboardSection === "daily";
  const currentLabel = SECTION_LABELS[dashboardSection];

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
      <FloatingTopics containerRef={containerRef} laneRef={laneRef} />

      {/* Column 1: Tasks area - flex-1 en mobile para que ocupe espacio principal */}
      <div className="relative flex flex-col z-10 min-w-0 min-h-0 overflow-hidden flex-1 lg:flex-none p-4 md:p-6 lg:p-8 lg:pr-2 order-1 lg:order-none">
        {/* Header with navigation and title */}
        <header className="relative mb-4 lg:mb-6">
          {/* Navigation tabs - horizontal scroll on mobile */}
          <nav className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
            {navTabs.map((tab) => {
              const isActive = dashboardSection === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDashboardSection(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                    "border backdrop-blur-sm",
                    isActive
                      ? "bg-gradient-to-r from-sky-500/20 to-indigo-500/15 border-sky-400/30 text-white shadow-[0_0_12px_-3px_rgba(56,189,248,0.3)]"
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:border-white/15 hover:text-white/80"
                  )}
                >
                  {Icon && (
                    <Icon 
                      className={cn(
                        "w-3.5 h-3.5 transition-colors",
                        isActive ? "text-sky-300" : "text-white/50"
                      )} 
                    />
                  )}
                  <span>{tab.label}</span>
                  {/* Animated underline for active tab */}
                  {isActive && (
                    <motion.span
                      layoutId="activeDashTab"
                      className="absolute -bottom-1 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-sky-400/70 to-indigo-400/50"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
            
            {/* Notifications button (icon-only) */}
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => console.log("Notifications clicked")}
              className={cn(
                "relative flex items-center justify-center w-9 h-9 rounded-full transition-all flex-shrink-0",
                "border backdrop-blur-sm",
                "bg-white/5 text-white/50 border-white/10",
                "hover:bg-white/10 hover:border-white/15 hover:text-white/80"
              )}
            >
              <Bell className="w-4 h-4" />
              {/* Optional: notification badge dot (hidden by default) */}
              {/* Uncomment when notifications are implemented:
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-400 border border-background" />
              */}
            </button>
          </nav>

          {/* Kicker (small label) + Title - changes based on section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            key={isDaily ? `daily-${selectedDay}` : dashboardSection}
            className="space-y-1 lg:space-y-2"
          >
            {/* Kicker - always visible, blue accent */}
            <div className="flex items-center gap-2 text-sky-400/90">
              {isDaily && <Calendar className="w-4 h-4 lg:w-5 lg:h-5" />}
              <span className="text-xs lg:text-sm font-medium tracking-wider uppercase">
                {currentLabel}
              </span>
            </div>
            
            {/* Main title */}
            {isDaily ? (
              <>
                <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight">
                  {format(selectedDate, "MMMM d")}
                  <span className="text-white/20">, {format(selectedDate, "yyyy")}</span>
                </h1>
                <p className="text-white/40 text-base lg:text-lg">
                  {format(selectedDate, "EEEE")}
                </p>
              </>
            ) : (
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight">
                {currentLabel}
              </h1>
            )}
          </motion.div>
        </header>

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
        <VerticalCalendar />
      </aside>
    </div>
  );
}
