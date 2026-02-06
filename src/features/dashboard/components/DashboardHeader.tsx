"use client";

import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Calendar,
  Bell,
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
  /** Optional callback for notifications button */
  onNotificationsClick?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Section labels - reusable for kicker, title, and nav */
const SECTION_LABELS: Record<DashboardSection, string> = {
  daily: "Daily Log",
  weeklyRecap: "Weekly Recap",
  stickies: "Stickies",
  topics: "Topics",
  settings: "Settings",
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
  onNotificationsClick,
}: DashboardHeaderProps) {
  const isDaily = section === "daily";
  const currentLabel = SECTION_LABELS[section];

  return (
    <header className="relative mb-4 lg:mb-6">
      {/* Navigation tabs - horizontal scroll on mobile */}
      <nav
        className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
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
                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:border-white/15 hover:text-white/80"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 sm:w-3.5 sm:h-3.5 transition-colors flex-shrink-0",
                  isActive ? "text-sky-300" : "text-white/50"
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

        {/* Notifications button (icon-only) */}
        <button
          type="button"
          aria-label="Notifications"
          onClick={onNotificationsClick}
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
        key={isDaily ? `daily-${selectedDate.getDate()}` : section}
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
              <span className="text-white/20">
                , {format(selectedDate, "yyyy")}
              </span>
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
  );
}
