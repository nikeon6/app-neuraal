"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { StickyNote, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import { ConfirmDialog, MinimalTiptapEditor } from "@/shared/ui";
import type { MinimalTiptapEditorHandle } from "@/shared/ui";
import {
  updateStickyAndInvalidate,
  deleteStickyAndInvalidate,
} from "@/shared/api/mutations";
import type { ApiSticky } from "@/shared/api/sdk";

const AUTOSAVE_DEBOUNCE_MS = 1000;
const COLLAPSED_MIN_HEIGHT_PX = 120;

export interface StickyEditorProps {
  sticky: ApiSticky;
  onClose?: () => void;
}

function defaultContent(
  content: ApiSticky["content"],
): Record<string, unknown> {
  if (
    content &&
    typeof content === "object" &&
    Object.keys(content).length > 0
  ) {
    return content as Record<string, unknown>;
  }
  return {};
}

export function StickyEditor({ sticky, onClose }: StickyEditorProps) {
  const queryClient = useQueryClient();
  const tiptapRef = useRef<MinimalTiptapEditorHandle>(null);
  const [title, setTitle] = useState(sticky.title);
  const [contentJson, setContentJson] = useState<Record<string, unknown>>(() =>
    defaultContent(sticky.content),
  );
  const [isExpanded] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const versionRef = useRef<number>(sticky.version);

  // Keep refs in sync with latest state so runSave always reads current values
  // (avoids stale closure where the debounced save sends the pre-update state).
  const titleRef = useRef(title);
  titleRef.current = title;
  const contentRef = useRef(contentJson);
  contentRef.current = contentJson;

  useEffect(() => {
    versionRef.current = sticky.version;
  }, [sticky.version]);

  const runSave = useCallback(async () => {
    const latestTitle = titleRef.current.trim();
    const latestContent =
      Object.keys(contentRef.current).length > 0 ? contentRef.current : {};
    const payload = {
      version: versionRef.current,
      title: latestTitle, // Allow empty titles — user may intentionally clear it
      content: latestContent,
    };
    const hash = `${payload.title}|${JSON.stringify(payload.content)}`;
    if (hash === lastSavedHashRef.current) return;

    try {
      const result = await updateStickyAndInvalidate(
        queryClient,
        sticky.id,
        payload,
      );
      if (result) {
        versionRef.current = result.version;
        lastSavedHashRef.current = hash;
      }
    } catch {
      // On failure (e.g. 409 version conflict), invalidate queries so the
      // component re-syncs with the latest server state. This resets
      // versionRef via the sticky.version effect and lets future saves succeed.
      await queryClient.invalidateQueries({ queryKey: ["stickies"] });
    }
  }, [sticky.id, queryClient]);

  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(runSave, AUTOSAVE_DEBOUNCE_MS);
  }, [runSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    triggerAutoSave();
  };

  const handleContentUpdate = useCallback(
    (json: Record<string, unknown>) => {
      setContentJson(json);
      triggerAutoSave();
    },
    [triggerAutoSave],
  );

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleteDialogOpen(false);
    try {
      await deleteStickyAndInvalidate(queryClient, sticky.id);
      onClose?.();
    } catch {
      // Error handled by mutation
    }
  }, [queryClient, sticky.id, onClose]);

  return (
    <div
      aria-label="Sticky editor"
      className={cn(
        "glass-panel rounded-xl pt-2 px-4 pb-3 flex flex-col min-h-0 border border-white/10",
        "group",
      )}
      style={{ minHeight: `${COLLAPSED_MIN_HEIGHT_PX}px` }}
      data-testid="sticky-editor"
    >
      {/* Badge top-right */}
      <div className="flex justify-end mb-0 mt-0.5">
        <span
          className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-sky-400/90 bg-sky-500/10 px-2 py-0.5 rounded"
          aria-hidden
        >
          <StickyNote className="w-3 h-3" />
          Sticky
        </span>
      </div>

      {/* Title */}
      <input
        type="text"
        aria-label="Sticky title"
        autoComplete="off"
        value={title}
        onChange={handleTitleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            tiptapRef.current?.editor?.commands.focus();
          }
        }}
        placeholder="Title"
        maxLength={120}
        className="w-full bg-transparent border-none text-white font-semibold text-xl placeholder-white/30 focus:outline-none focus:ring-0 -mt-1 mb-0"
        data-testid="sticky-title"
      />

      {/* Content — always visible and editable so "Write something..." shows by default */}
      <div className="flex-1 min-h-0 overflow-auto">
        <MinimalTiptapEditor
          content={contentJson}
          onUpdate={handleContentUpdate}
          isExpanded={isExpanded}
          editable={true}
          placeholder="Write something..."
          editorRef={tiptapRef}
        />
      </div>

      {/* Delete button bottom-right */}
      <div className="flex justify-end pt-1 mt-auto flex-shrink-0">
        <button
          type="button"
          aria-label="Delete sticky"
          onClick={() => setIsDeleteDialogOpen(true)}
          className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Delete sticky?"
        message="This cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
}
