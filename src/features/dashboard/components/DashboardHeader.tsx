"use client";

import React from "react";
import { format, startOfWeek, endOfWeek, getISOWeek } from "date-fns";
import { motion } from "framer-motion";
import {
  Calendar,
  LayoutGrid,
  StickyNote,
  Users,
  Settings,
} from "lucide-react";
import type { DashboardSection } from "@/shared/store";
import { cn } from "@/shared/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface NavTab {
  id: DashboardSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface DashboardHeaderProps {
  /** Current active section */
  section: DashboardSection;
  /** Callback when user changes section */
  onChangeSection: (section: DashboardSection) => void;
  /** Currently selected date (for daily view title) */
  selectedDate: Date;
  /** Slot for the notifications widget (rendered in the nav bar). */
  notificationSlot?: React.ReactNode;
  /** Slot for the search widget (rendered next to the daily title). */
  searchSlot?: React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

/** Section labels - used for kicker and nav tabs */
const SECTION_LABELS: Record<DashboardSection, string> = {
  daily: "Daily Log",
  weeklyRecap: "Weekly Recap",
  stickies: "Stickies",
  topics: "Topics",
  settings: "Settings",
};

/** Display titles - large heading text (can differ from tab labels) */
const SECTION_TITLES: Record<DashboardSection, string> = {
  daily: "Daily Log",
  weeklyRecap: "Weekly Recap",
  stickies: "Brainstorm Board",
  topics: "Neural Paths",
  settings: "Usage & Settings",
};

/** Navigation tabs configuration */
const NAV_TABS: NavTab[] = [
  { id: "daily", label: SECTION_LABELS.daily, icon: Calendar },
  { id: "weeklyRecap", label: SECTION_LABELS.weeklyRecap, icon: LayoutGrid },
  { id: "stickies", label: SECTION_LABELS.stickies, icon: StickyNote },
  { id: "topics", label: SECTION_LABELS.topics, icon: Users },
  { id: "settings", label: SECTION_LABELS.settings, icon: Settings },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns a formatted week date range string, e.g.
 * "Feb 10 — 16" (same month) or "Jan 27 — Feb 2" (cross-month).
 */
function formatWeekRange(date: Date): string {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

  const startMonth = weekStart.getMonth();
  const endMonth = weekEnd.getMonth();

  if (startMonth === endMonth) {
    // Same month: "Feb 2 — 8"
    return `${format(weekStart, "MMM d")} — ${format(weekEnd, "d")}`;
  }
  // Cross month: "Jan 27 — Feb 2"
  return `${format(weekStart, "MMM d")} — ${format(weekEnd, "MMM d")}`;
}

/**
 * Returns the kicker text for the weekly recap, e.g. "Week 6 · 2026".
 */
function formatWeekKicker(date: Date): string {
  const weekNum = getISOWeek(date);
  const year = format(date, "yyyy");
  return `Week ${weekNum} · ${year}`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DashboardHeader - Navigation tabs and title section for the dashboard.
 *
 * Responsive behavior:
 * - Mobile (< sm): Tabs show icon only, text hidden but accessible via sr-only
 * - Desktop (>= sm): Tabs show icon + text
 *
 * Accessibility:
 * - Each tab has aria-label for screen readers
 * - Active tab has aria-current="page"
 * - Notifications button has aria-label
 */
export function DashboardHeader({
  section,
  onChangeSection,
  selectedDate,
  notificationSlot,
  searchSlot,
}: Readonly<DashboardHeaderProps>) {
  const isDaily = section === "daily";
  const isWeekly = section === "weeklyRecap";
  const isStickies = section === "stickies";
  const currentLabel = SECTION_LABELS[section];

  // Compute the motion key for section transitions
  function getMotionKey(): string {
    if (isDaily) return `daily-${selectedDate.getDate()}`;
    if (isWeekly) return `weekly-${selectedDate.getTime()}`;
    return section;
  }
  const motionKey = getMotionKey();

  return (
    <header className="relative mb-2 lg:mb-6 landscape-compact-header">
      {/* Navigation tabs - horizontal scroll on mobile */}
      <nav
        className="flex items-center gap-1.5 lg:gap-2 mb-2 lg:mb-4 overflow-x-auto scrollbar-hide pb-1 lg:pb-2 -mx-1 px-1"
        aria-label="Dashboard navigation"
      >
        {NAV_TABS.map((tab) => {
          const isActive = section === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeSection(tab.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                "border backdrop-blur-sm",
                // Responsive padding: smaller on mobile (icon only), larger on sm+ (icon + text)
                "p-2 sm:px-3 sm:py-1.5",
                isActive
                  ? "bg-gradient-to-r from-sky-500/20 to-indigo-500/15 border-sky-400/30 text-white shadow-[0_0_12px_-3px_rgba(56,189,248,0.3)]"
                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:border-white/15 hover:text-white/80",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 sm:w-3.5 sm:h-3.5 transition-colors flex-shrink-0",
                  isActive ? "text-sky-300" : "text-white/50",
                )}
              />
              {/* Label: hidden on mobile, visible on sm+ */}
              <span className="hidden sm:inline">{tab.label}</span>
              {/* Screen reader only text for mobile */}
              <span className="sr-only sm:hidden">{tab.label}</span>
              {/* Animated underline for active tab */}
              {isActive && (
                <motion.span
                  layoutId="activeDashTab"
                  className="absolute -bottom-1 left-2 right-2 sm:left-3 sm:right-3 h-[2px] rounded-full bg-gradient-to-r from-sky-400/70 to-indigo-400/50"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}

        {/* Notification widget slot (injected by Dashboard to avoid cross-feature imports) */}
        {notificationSlot}
      </nav>

      {/* Kicker (small label) + Title - aligned with task list (pl-6 lg:pl-10) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        key={motionKey}
        className="space-y-0.5 lg:space-y-2 pl-6 lg:pl-10"
      >
        {/* Kicker - always visible, blue accent */}
        <div className="flex items-center gap-1.5 lg:gap-2 text-sky-400/90">
          {isDaily && <Calendar className="w-3.5 h-3.5 lg:w-5 lg:h-5" />}
          {isWeekly && <LayoutGrid className="w-3.5 h-3.5 lg:w-5 lg:h-5" />}
          {isStickies && <StickyNote className="w-3.5 h-3.5 lg:w-5 lg:h-5" />}
          <span className="text-[10px] lg:text-sm font-medium tracking-wider uppercase">
            {isWeekly ? formatWeekKicker(selectedDate) : currentLabel}
          </span>
        </div>

        {/* Main title */}
        {isDaily && (
          <>
            <div className="flex items-center justify-between pr-2 lg:pr-4">
              <h1 className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight">
                {format(selectedDate, "MMMM d")}
                <span className="text-white/20">
                  , {format(selectedDate, "yyyy")}
                </span>
              </h1>
              {searchSlot}
            </div>
            <p className="text-white/40 text-sm lg:text-lg">
              {format(selectedDate, "EEEE")}
            </p>
          </>
        )}
        {isWeekly && (
          <h1 className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight">
            {formatWeekRange(selectedDate)}
          </h1>
        )}
        {!isDaily && !isWeekly && (
          <h1 className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight">
            {SECTION_TITLES[section]}
          </h1>
        )}
      </motion.div>
    </header>
  );
}
