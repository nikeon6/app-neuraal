"use client";

import React, { useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { useStore } from "@/lib/store";
import { FloatingTopics } from "@/components/topics/FloatingTopics";
import { TaskForm } from "@/components/tasks/TaskForm";
import { VerticalCalendar } from "@/components/calendar/VerticalCalendar";

export function Dashboard() {
  const { selectedDate, selectedDay } = useStore();

  // Ref for the main container (used by FloatingTopics)
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={containerRef} className="flex h-full w-full relative">
      {/* Floating topics visualization - covers entire area */}
      <FloatingTopics containerRef={containerRef} />

      {/* Main content area */}
      <div className="flex-1 relative flex flex-col z-10">
        {/* Header with date */}
        <header className="relative p-6 md:p-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            key={selectedDay}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2 text-primary">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium tracking-wider uppercase">
                Daily Log
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
              {format(selectedDate, "MMMM d")}
              <span className="text-white/20">, {format(selectedDate, "yyyy")}</span>
            </h1>
            <p className="text-white/40 text-lg">
              {format(selectedDate, "EEEE")}
            </p>
          </motion.div>
        </header>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Task form at bottom */}
        <div className="relative p-6 md:p-12 bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-2xl">
            <TaskForm />
          </div>
        </div>
      </div>

      {/* Right sidebar with calendar (visible on md+ screens) */}
      <aside className="hidden md:block h-full relative z-20">
        <VerticalCalendar />
      </aside>

      {/* Mobile bottom sheet for calendar (hidden on md+ screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-xl border-t border-white/10 max-h-[40vh] overflow-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">
            Tareas del mes
          </h3>
          <VerticalCalendar />
        </div>
      </div>
    </div>
  );
}
