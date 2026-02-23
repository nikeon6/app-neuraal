"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Plus, GripVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStickiesQuery } from "@/shared/api/queries";
import {
  createStickyAndInvalidate,
  reorderStickiesAndInvalidate,
} from "@/shared/api/mutations";
import type { ApiSticky } from "@/shared/api/sdk";
import { StickyEditor } from "./StickyEditor";
import "../styles/scrollbar.css";

const EMPTY_DOC = { type: "doc", content: [] } as Record<string, unknown>;

function stickiesByColumn(stickies: ApiSticky[]): {
  left: ApiSticky[];
  right: ApiSticky[];
} {
  const left = stickies
    .filter((s) => s.columnIndex === 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const right = stickies
    .filter((s) => s.columnIndex === 1)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { left, right };
}

interface StickyCardProps {
  sticky: ApiSticky;
  dragControls: ReturnType<typeof useDragControls>;
  isDragDisabled: boolean;
}

function StickyCard({ sticky, dragControls, isDragDisabled }: StickyCardProps) {
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isDragDisabled) dragControls.start(e);
    },
    [dragControls, isDragDisabled],
  );

  return (
    <div className="relative group">
      <button
        type="button"
        data-testid="sticky-drag-handle"
        aria-label="Drag to reorder"
        onPointerDown={handlePointerDown}
        className="absolute -left-8 top-4 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-60 p-3 -m-2 rounded-lg text-white/30 hover:text-white/60 cursor-grab active:cursor-grabbing transition-opacity touch-none select-none"
        style={{ touchAction: "none" }}
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <StickyEditor sticky={sticky} />
    </div>
  );
}

interface ReorderableStickyItemProps {
  sticky: ApiSticky;
}

function ReorderableStickyItem({ sticky }: ReorderableStickyItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={sticky.id}
      data-testid={`sticky-item-${sticky.id}`}
      dragListener={false}
      dragControls={dragControls}
      layout
      initial={false}
      className="relative"
      transition={{
        layout: { type: "spring", stiffness: 350, damping: 30 },
      }}
      whileDrag={{
        opacity: 0.9,
        zIndex: 50,
      }}
    >
      <StickyCard
        sticky={sticky}
        dragControls={dragControls}
        isDragDisabled={false}
      />
    </Reorder.Item>
  );
}

export function StickiesContainer() {
  const queryClient = useQueryClient();
  const { data: stickies = [], isPending: isLoading } = useStickiesQuery();
  const { left, right } = useMemo(() => stickiesByColumn(stickies), [stickies]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAddSticky = useCallback(async () => {
    const columnIndex = left.length <= right.length ? 0 : 1;
    await createStickyAndInvalidate(queryClient, {
      title: "",
      content: EMPTY_DOC,
      columnIndex,
    });
    if (typeof scrollRef.current?.scrollTo === "function") {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [queryClient, left.length, right.length]);

  // IDs per column for each Reorder.Group
  const leftIds = useMemo(() => left.map((s) => s.id), [left]);
  const rightIds = useMemo(() => right.map((s) => s.id), [right]);

  // Reorder within left column only
  const handleReorderLeft = useCallback(
    async (newIds: string[]) => {
      if (newIds.length === 0) return;
      const items = newIds.map((id, i) => ({
        id,
        sortOrder: i,
        columnIndex: 0 as const,
      }));
      await reorderStickiesAndInvalidate(queryClient, items);
    },
    [queryClient],
  );

  // Reorder within right column only
  const handleReorderRight = useCallback(
    async (newIds: string[]) => {
      if (newIds.length === 0) return;
      const items = newIds.map((id, i) => ({
        id,
        sortOrder: i,
        columnIndex: 1 as const,
      }));
      await reorderStickiesAndInvalidate(queryClient, items);
    },
    [queryClient],
  );

  if (isLoading && stickies.length === 0) {
    return (
      <div
        data-testid="stickies-container"
        aria-label="Stickies container"
        className="flex flex-col h-full w-full"
      >
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/40 text-sm animate-pulse">
            Loading stickies...
          </p>
        </div>
      </div>
    );
  }

  if (stickies.length === 0) {
    return (
      <div
        data-testid="stickies-container"
        aria-label="Stickies container"
        className="flex flex-col h-full w-full"
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-lg text-white/60">No stickies yet</p>
          <p className="text-sm text-white/40 text-center">
            Add a sticky note to get started
          </p>
          <button
            type="button"
            data-testid="add-sticky-button"
            onClick={handleAddSticky}
            aria-label="Add sticky"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add sticky</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="stickies-container"
      aria-label="Stickies container"
      className="flex flex-col h-full w-full overflow-hidden"
    >
      {/* Single scrollable container with 2-col grid; each column is its own Reorder.Group */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 py-4 md:py-6 pl-6 lg:pl-10 pr-2 lg:pr-4 stickies-scrollbar tasks-scroll-fade content-start auto-rows-min"
      >
        {/* Left column */}
        <Reorder.Group
          axis="y"
          values={leftIds}
          onReorder={handleReorderLeft}
          className="flex flex-col gap-4 md:gap-5"
        >
          {left.map((sticky) => (
            <ReorderableStickyItem key={sticky.id} sticky={sticky} />
          ))}
        </Reorder.Group>

        {/* Right column */}
        <Reorder.Group
          axis="y"
          values={rightIds}
          onReorder={handleReorderRight}
          className="flex flex-col gap-4 md:gap-5"
        >
          {right.map((sticky) => (
            <ReorderableStickyItem key={sticky.id} sticky={sticky} />
          ))}
        </Reorder.Group>
      </div>

      <div className="flex justify-center py-4 flex-shrink-0">
        <button
          type="button"
          data-testid="add-sticky-button"
          onClick={handleAddSticky}
          aria-label="Add sticky"
          className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-dashed border-white/20 text-white/40 hover:text-white/80 hover:border-white/50 hover:bg-white/10 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
