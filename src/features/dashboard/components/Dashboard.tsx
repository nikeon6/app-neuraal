"use client";

import React, { useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { useStore } from "@/shared/store";
import { FloatingTopics } from "@/features/topics/components/FloatingTopics";
import { TasksContainer } from "@/features/tasks-container";
import { VerticalCalendar } from "@/features/calendar/components/VerticalCalendar";

/*
 * LAYOUT RESPONSIVE (3 breakpoints):
 * 
 * < lg (< 1024px): Stack vertical
 *   - Tasks ocupa espacio principal (flex-1)
 *   - Calendar abajo con altura fija (no tapa tasks)
 *   - Lane oculto
 * 
 * >= lg (1024px+): Grid 3 columnas
 *   - Tasks: minmax(280px, 1fr) - flexible, mínimo 280px
 *   - Lane: clamp(220px, 20vw, 360px) - MÁS ancho para bolitas
 *   - Calendar: clamp(200px, 14vw, 260px) - MÁS estrecho
 * 
 * >= xl (1280px+): Grid 3 columnas con más espacio
 *   - Lane aún más ancho: clamp(280px, 22vw, 420px)
 *   - Calendar estable: 240px fijo
 */

export function Dashboard() {
  const { selectedDate, selectedDay } = useStore();

  // Ref for the main container (used by FloatingTopics)
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Ref for the bubbles lane (used by FloatingTopics)
  const laneRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden
                 flex flex-col
                 lg:grid lg:grid-cols-[minmax(280px,1fr)_clamp(200px,18vw,320px)_180px]
                 xl:grid-cols-[minmax(320px,1fr)_clamp(260px,20vw,380px)_200px]"
    >
      {/* Floating topics visualization - covers entire area */}
      <FloatingTopics containerRef={containerRef} laneRef={laneRef} />

      {/* Column 1: Tasks area - flex-1 en mobile para que ocupe espacio principal */}
      <div className="relative flex flex-col z-10 min-w-0 overflow-hidden flex-1 lg:flex-none p-4 md:p-6 lg:p-8 lg:pr-2">
        {/* Header with date */}
        <header className="relative mb-4 lg:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            key={selectedDay}
            className="space-y-1 lg:space-y-2"
          >
            <div className="flex items-center space-x-2 text-primary">
              <Calendar className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="text-xs lg:text-sm font-medium tracking-wider uppercase">
                Daily Log
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight">
              {format(selectedDate, "MMMM d")}
              <span className="text-white/20">, {format(selectedDate, "yyyy")}</span>
            </h1>
            <p className="text-white/40 text-base lg:text-lg">
              {format(selectedDate, "EEEE")}
            </p>
          </motion.div>
        </header>

        {/* Tasks Container - shows TaskEditors for selected day */}
        <div className="relative flex-1 overflow-hidden min-w-0 min-h-0">
          <TasksContainer />
        </div>
      </div>

      {/* Column 2: Bubbles lane - hidden in mobile, visible in lg+ */}
      <div
        ref={laneRef}
        className="hidden lg:block relative min-w-0"
        aria-hidden="true"
      />

      {/* Column 3: Calendar sidebar
          - Mobile: altura fija, NO ocupa toda la pantalla
          - Desktop: altura completa, alineado a la derecha
          - overflow-hidden para forzar que respete el ancho de la columna del grid */}
      <aside className="h-48 lg:h-full relative z-20 min-w-0 flex-shrink-0 overflow-hidden">
        <VerticalCalendar />
      </aside>
    </div>
  );
}
