"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Palette,
  Trash2,
  Brain,
  Bell,
  Image,
  Code,
  Youtube,
  Paperclip,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Circle,
  ListTodo,
  StickyNote,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore, selectDateKey } from "@/shared/store";
import type { EntryType } from "@/shared/types";
import type { ApiEntry } from "@/shared/api/sdk";
import { useTopicsQuery, entriesQueryKey, attachmentsQueryKey } from "@/shared/api/queries";
import { updateEntryAndInvalidate, deleteEntryAndInvalidate, summarizeEntryAndInvalidate, createReminderAndInvalidate, updateReminderAndInvalidate } from "@/shared/api/mutations";
import * as entriesSdk from "@/shared/api/sdk/entries";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";
import { ApiError } from "@/shared/api/apiClient";
import { cn } from "@/shared/lib";
import { ConfirmDialog } from "@/shared/ui";
import { ReminderDialog } from "./ReminderDialog";
import { AttachmentPanel } from "@/features/attachments";
import { TiptapEditor } from "./TiptapEditor";
import type { TiptapEditorHandle } from "./TiptapEditor";
import { useImageUpload } from "../hooks/useImageUpload";
import { useResolveAttachmentUrls } from "../hooks/useResolveAttachmentUrls";
import { useTrackDeletedImages } from "../hooks/useTrackDeletedImages";
import type { ContentMenuItem, TaskEditorUIState } from "../types";

const AUTOSAVE_DEBOUNCE_MS = 1000;

/** Sentinel value for "auto-classify" topic mode. Not a real topic ID. */
const AUTO_TOPIC = "__auto__" as const;

/**
 * Props for TaskEditor component.
 *
 * Receives the full ApiEntry object from the parent (TasksContainer).
 * All edits trigger debounced API calls via the store.
 */
interface TaskEditorProps {
  /** The entry being edited. */
  entry: ApiEntry;
  /** Callback when editor is closed / entry deleted. */
  onClose?: () => void;
}

// ============================================================================
// TopicDropdown — portal-rendered to escape parent overflow clipping
// ============================================================================
interface TopicDropdownProps {
  topicMenuRef: React.RefObject<HTMLDivElement | null>;
  isTopicMenuOpen: boolean;
  onToggle: () => void;
  currentTopicDisplay: { name: string; color: string };
  selectedTopicId: string | null;
  topics: Array<{ id: string; name: string; color: string }>;
  onSelect: (topicId: string | null) => void;
}

function TopicDropdown({
  topicMenuRef,
  isTopicMenuOpen,
  onToggle,
  currentTopicDisplay,
  selectedTopicId,
  topics,
  onSelect,
}: TopicDropdownProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Recalculate position when menu opens or on scroll/resize
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 8,
      left: rect.left,
    });
  }, []);

  useEffect(() => {
    if (!isTopicMenuOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isTopicMenuOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!isTopicMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onToggle();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isTopicMenuOpen, onToggle]);

  return (
    <div className="relative min-w-0" ref={topicMenuRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Topic"
        aria-haspopup="listbox"
        aria-expanded={isTopicMenuOpen}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex items-center gap-1.5 @[380px]:gap-2 px-2 @[420px]:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 hover:text-white transition-all min-w-0 max-w-[100px] @[380px]:max-w-[120px] @[420px]:max-w-[180px]"
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: currentTopicDisplay.color }}
        />
        <span className="flex-1 min-w-0 truncate">{currentTopicDisplay.name}</span>
        {selectedTopicId === AUTO_TOPIC && <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />}
        <ChevronDown className={cn("w-3 h-3 transition-transform flex-shrink-0", isTopicMenuOpen && "rotate-180")} />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isTopicMenuOpen && (
              <motion.div
                ref={panelRef}
                role="listbox"
                aria-label="Select topic"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  top: panelPos.top,
                  left: panelPos.left,
                  zIndex: 9999,
                }}
                className="bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
              >
                {/* Auto option */}
                <button
                  role="option"
                  aria-selected={selectedTopicId === AUTO_TOPIC}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                    selectedTopicId === AUTO_TOPIC
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => onSelect(AUTO_TOPIC)}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
                  <span>Auto</span>
                  <Sparkles className="w-3 h-3 text-purple-400 ml-auto" />
                </button>

                {/* No topic option */}
                <button
                  role="option"
                  aria-selected={selectedTopicId === null}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                    selectedTopicId === null
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => onSelect(null)}
                >
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <span>No topic</span>
                </button>

                {topics.length > 0 && <div className="h-px bg-white/10 mx-2" />}

                {/* API topics */}
                {topics.map((t) => (
                  <button
                    key={t.id}
                    role="option"
                    aria-selected={selectedTopicId === t.id}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                      selectedTopicId === t.id
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    )}
                    onClick={() => onSelect(t.id)}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span>{t.name}</span>
                  </button>
                ))}

                {topics.length === 0 && (
                  <div className="px-4 py-3 text-xs text-white/40">
                    No topics yet. Create one in Topics section.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

export function TaskEditor({
  entry,
  onClose,
}: TaskEditorProps) {
  const queryClient = useQueryClient();
  const dateKey = useStore(selectDateKey);
  const { data: topics = [] } = useTopicsQuery();

  // ---------------------------------------------------------------------------
  // Form state (draft — initialized from entry props)
  // ---------------------------------------------------------------------------
  const [title, setTitle] = useState<string>(entry.title);

  // Store content as TipTap JSON directly (no more plain text extraction)
  const [contentJson, setContentJson] = useState<Record<string, unknown>>(
    entry.content && typeof entry.content === "object" && Object.keys(entry.content).length > 0
      ? entry.content
      : {}
  );

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    entry.topicId ?? AUTO_TOPIC
  );
  const [entryType, setEntryType] = useState<EntryType>(entry.type);
  const [isCompleted, setIsCompleted] = useState<boolean>(entry.completed ?? false);

  // ---------------------------------------------------------------------------
  // Refs that mirror draft state — used inside setTimeout to always read the
  // LATEST value, avoiding stale closures that caused topic/completed not saving.
  // ---------------------------------------------------------------------------
  const titleRef = useRef<HTMLInputElement>(null);
  const tiptapRef = useRef<TiptapEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef({
    title: entry.title,
    contentJson: (entry.content && typeof entry.content === "object" && Object.keys(entry.content).length > 0
      ? entry.content
      : {}) as Record<string, unknown>,
    selectedTopicId: (entry.topicId ?? AUTO_TOPIC) as string | null,
    entryType: entry.type as EntryType,
    isCompleted: entry.completed ?? false,
  });

  // Keep draftRef in sync with state
  useEffect(() => { draftRef.current.title = title; }, [title]);
  useEffect(() => { draftRef.current.contentJson = contentJson; }, [contentJson]);
  useEffect(() => { draftRef.current.selectedTopicId = selectedTopicId; }, [selectedTopicId]);
  useEffect(() => { draftRef.current.entryType = entryType; }, [entryType]);
  useEffect(() => { draftRef.current.isCompleted = isCompleted; }, [isCompleted]);

  // Image upload hook
  const { uploadImages } = useImageUpload(entry.id, tiptapRef);

  // Resolve attachment URLs on content load
  useResolveAttachmentUrls(tiptapRef, contentJson);

  // Track deleted image/file nodes and clean up their attachments
  useTrackDeletedImages(entry.id, tiptapRef);

  // Track the current entry version for optimistic concurrency
  const versionRef = useRef<number>(entry.version);
  useEffect(() => { versionRef.current = entry.version; }, [entry.version]);

  // UI state
  const [uiState, setUIState] = useState<TaskEditorUIState>({
    isExpanded: false,
    isContentMenuOpen: false,
    isTopicMenuOpen: false,
    isSaving: false,
    saveError: undefined,
  });

  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { isExpanded, isContentMenuOpen, isTopicMenuOpen, isSaving } = uiState;

  // DOM / timer refs
  const editorRef = useRef<HTMLDivElement>(null);
  const contentMenuRef = useRef<HTMLDivElement>(null);
  const topicMenuRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSavedHashRef = useRef<string>("");

  const topicMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const t of topics) {
      map.set(t.id, { name: t.name, color: t.color });
    }
    return map;
  }, [topics]);

  const runSave = useCallback(async () => {
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    const draft = draftRef.current;
    const topicIdToSend = draft.selectedTopicId === AUTO_TOPIC ? null : draft.selectedTopicId;

    // Use TipTap JSON content directly — no more plain text conversion
    const contentToSave = Object.keys(draft.contentJson).length > 0
      ? draft.contentJson
      : {};

    const payload = {
      title: draft.title.trim() || entry.title,
      content: contentToSave as Record<string, unknown>,
      topicId: topicIdToSend,
      completed: draft.entryType === "task" ? draft.isCompleted : undefined,
      type: draft.entryType as "task" | "note",
      version: versionRef.current,
    };

    const hash = `${payload.title}|${JSON.stringify(payload.content)}|${payload.topicId}|${payload.type}|${payload.completed}`;
    if (hash === lastSavedHashRef.current) {
      setUIState((prev) => ({ ...prev, isSaving: false }));
      if (draft.selectedTopicId === AUTO_TOPIC) {
        try {
          const res = await entriesSdk.autoTopicEntry(entry.id);
          if (res.selectedTopicId) {
            setSelectedTopicId(res.selectedTopicId);
            await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    setUIState((prev) => ({ ...prev, isSaving: true }));

    try {
      const result = await updateEntryAndInvalidate(queryClient, entry.id, dateKey, payload);
      if (result) {
        versionRef.current = result.version;
        lastSavedHashRef.current = hash;
      }
      if (draft.selectedTopicId === AUTO_TOPIC) {
        const res = await entriesSdk.autoTopicEntry(entry.id);
        if (res.selectedTopicId) {
          setSelectedTopicId(res.selectedTopicId);
          await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
        }
      }
    } catch (error) {
      if (ac.signal.aborted) return;
      if (error instanceof ApiError) {
        if (error.status === 401) console.warn("Not authenticated");
        else if (error.status === 404) {
          await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
          onClose?.();
        } else if (error.status === 409) {
          await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
          console.warn("Conflict (version). Refreshed entries.");
        } else console.error("[TaskEditor] update failed:", error);
      } else console.error("[TaskEditor] update failed:", error);
    } finally {
      if (!ac.signal.aborted) setUIState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [entry.id, entry.title, dateKey, queryClient, onClose]);

  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(runSave, AUTOSAVE_DEBOUNCE_MS);
  }, [runSave]);

  const flushPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      void runSave();
    }
  }, [runSave]);

  // ---- Handlers -----------------------------------------------------------

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    triggerAutoSave();
  };

  const handleContentUpdate = useCallback((json: Record<string, unknown>) => {
    setContentJson(json);
    triggerAutoSave();
  }, [triggerAutoSave]);

  const handleTopicSelect = (topicId: string | null) => {
    setSelectedTopicId(topicId);
    setUIState((prev) => ({ ...prev, isTopicMenuOpen: false }));
    triggerAutoSave();
  };

  const handleEntryTypeToggle = () => {
    const newType: EntryType = entryType === "task" ? "note" : "task";
    setEntryType(newType);
    if (newType === "note") {
      setIsCompleted(false);
    }
    triggerAutoSave();
  };

  const handleToggleCompleted = () => {
    if (entryType !== "task") return;
    setIsCompleted((prev) => !prev);
    triggerAutoSave();
  };

  // Handle delete - opens confirmation dialog
  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete - actually removes the entry via API
  const handleConfirmDelete = useCallback(async () => {
    setIsDeleteDialogOpen(false);
    try {
      await deleteEntryAndInvalidate(queryClient, entry.id, dateKey);
      onClose?.();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
        onClose?.();
      } else console.error("[TaskEditor] delete failed:", error);
    }
  }, [queryClient, entry.id, dateKey, onClose]);

  // Cancel delete
  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Summarize (async — result arrives via Notifications)
  // ---------------------------------------------------------------------------
  const [isSummarizing, setIsSummarizing] = useState(false);
  // Track the summaryUpdatedAt at the time of clicking summarize,
  // so we know when the summary has actually arrived from the callback.
  const summaryRequestedAtRef = useRef<string | null>(null);

  // When the entry's summaryUpdatedAt changes after we requested a summary,
  // clear the "thinking" state.
  useEffect(() => {
    if (!summaryRequestedAtRef.current) return;
    if (
      entry.summaryUpdatedAt &&
      entry.summaryUpdatedAt > summaryRequestedAtRef.current
    ) {
      summaryRequestedAtRef.current = null;
      setIsSummarizing(false);
    }
  }, [entry.summaryUpdatedAt]);

  const handleSummarize = useCallback(async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    summaryRequestedAtRef.current = new Date().toISOString();
    try {
      await summarizeEntryAndInvalidate(queryClient, entry.id);
      // Summary is async (202). Keep isSummarizing=true until the
      // entry.summaryUpdatedAt changes (detected by the effect above).
      console.info("[TaskEditor] Summary requested. Waiting for result...");
    } catch (error) {
      // On error, clear thinking state immediately
      setIsSummarizing(false);
      summaryRequestedAtRef.current = null;
      if (error instanceof ApiError) {
        if (error.status === 404) {
          await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
          onClose?.();
        } else {
          console.error("[TaskEditor] summarize failed:", error);
        }
      } else {
        console.error("[TaskEditor] summarize failed:", error);
      }
    }
  }, [isSummarizing, queryClient, entry.id, dateKey, onClose]);

  // ---------------------------------------------------------------------------
  // Reminders (create / reschedule / cancel)
  // ---------------------------------------------------------------------------
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [activeReminderId, setActiveReminderId] = useState<string | null>(null);
  const [isReminderSaving, setIsReminderSaving] = useState(false);

  const handleCreateReminder = useCallback(
    async (scheduledAt: string, channel: "whatsapp" | "email" | "push" | "sms", message?: string) => {
      setIsReminderSaving(true);
      try {
        const reminder = await createReminderAndInvalidate(queryClient, {
          entryId: entry.id,
          scheduledAt,
          channel,
          message: message ?? null,
        });
        setActiveReminderId(reminder.id);
        setIsReminderDialogOpen(false);
        console.info("[TaskEditor] Reminder scheduled:", reminder.id);
      } catch (error) {
        console.error("[TaskEditor] create reminder failed:", error);
      } finally {
        setIsReminderSaving(false);
      }
    },
    [queryClient, entry.id]
  );

  const handleRescheduleReminder = useCallback(
    async (scheduledAt: string) => {
      if (!activeReminderId) return;
      setIsReminderSaving(true);
      try {
        await updateReminderAndInvalidate(queryClient, activeReminderId, { scheduledAt });
        setIsReminderDialogOpen(false);
        console.info("[TaskEditor] Reminder rescheduled.");
      } catch (error) {
        // If the reminder was already sent/processed, clear the local state
        if (error instanceof ApiError && (error.status === 409 || error.status === 400)) {
          console.warn("[TaskEditor] Reminder already sent or processed, clearing local state.");
          setActiveReminderId(null);
          setIsReminderDialogOpen(false);
        } else {
          console.error("[TaskEditor] reschedule reminder failed:", error);
        }
      } finally {
        setIsReminderSaving(false);
      }
    },
    [queryClient, activeReminderId]
  );

  const handleCancelReminder = useCallback(async () => {
    if (!activeReminderId) return;
    setIsReminderSaving(true);
    try {
      await updateReminderAndInvalidate(queryClient, activeReminderId, { status: "canceled" });
      setActiveReminderId(null);
      setIsReminderDialogOpen(false);
      console.info("[TaskEditor] Reminder canceled.");
    } catch (error) {
      // If the reminder was already sent/processed, clear the local state
      if (error instanceof ApiError && (error.status === 409 || error.status === 400)) {
        console.warn("[TaskEditor] Reminder already sent or processed, clearing local state.");
        setActiveReminderId(null);
        setIsReminderDialogOpen(false);
      } else {
        console.error("[TaskEditor] cancel reminder failed:", error);
      }
    } finally {
      setIsReminderSaving(false);
    }
  }, [queryClient, activeReminderId]);

  const handleEditorClick = () => {
    // Only expand if not already expanded — avoids scroll jump
    setUIState((prev) => {
      if (prev.isExpanded) return prev;
      return { ...prev, isExpanded: true };
    });
  };

  // Click outside → collapse (but ignore clicks on portal-rendered dialogs)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't collapse if clicking inside the editor itself
      if (editorRef.current && editorRef.current.contains(target)) return;

      // Don't collapse if clicking inside a portal-rendered dialog (ReminderDialog,
      // ConfirmDialog, etc.) — these are outside the editor DOM but still "ours"
      const targetEl = target instanceof HTMLElement ? target : target.parentElement;
      if (targetEl?.closest("[role='dialog'], [role='alertdialog'], [data-dialog-backdrop], [role='listbox']")) return;

      flushPendingSave();
      setUIState((prev) => ({
        ...prev,
        isExpanded: false,
        isContentMenuOpen: false,
        isTopicMenuOpen: false,
      }));
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [flushPendingSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Content menu items
  const contentMenuItems: ContentMenuItem[] = [
    { id: "image", label: "Image", icon: Image },
    { id: "code", label: "Code snippet", icon: Code },
    { id: "youtube", label: "YouTube video", icon: Youtube },
    { id: "file", label: "Attach file", icon: Paperclip },
  ];

  // Handle "+" menu item clicks
  const handleContentMenuAction = useCallback((itemId: string) => {
    setUIState((prev) => ({ ...prev, isContentMenuOpen: false }));

    switch (itemId) {
      case "image": {
        // Open file picker for images
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.onchange = () => {
          const files = Array.from(input.files ?? []);
          if (files.length > 0) {
            uploadImages(files);
          }
        };
        input.click();
        break;
      }
      case "code":
        tiptapRef.current?.insertCodeBlock();
        break;
      case "youtube": {
        const url = globalThis.prompt("Paste YouTube URL:");
        if (url?.trim()) {
          tiptapRef.current?.insertYoutube(url.trim());
        }
        break;
      }
      case "file": {
        fileInputRef.current?.click();
        break;
      }
    }
  }, [uploadImages]);

  // Handle pasted non-image files (from TiptapEditor paste handler)
  const handleFilePaste = useCallback(async (files: File[]) => {
    if (files.length === 0 || !entry.id) return;

    for (const file of files) {
      try {
        const initResult = await attachmentsSdk.initUpload({
          entryId: entry.id,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          kind: "file",
        });

        const uploadResp = await fetch(initResult.presignedPutUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        if (!uploadResp.ok) {
          throw new Error(`Upload failed: ${uploadResp.status}`);
        }

        await attachmentsSdk.completeUpload(initResult.attachment.id);

        await queryClient.invalidateQueries({
          queryKey: attachmentsQueryKey(entry.id),
        });

        tiptapRef.current?.insertFileNode({
          attachmentId: initResult.attachment.id,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });

        triggerAutoSave();
      } catch (error) {
        console.error("[TaskEditor] File paste attachment failed:", error);
      }
    }
  }, [entry.id, triggerAutoSave, queryClient]);

  // Handle file attachment upload (from "+" menu → Attach file)
  const handleFileAttach = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !entry.id) return;
    e.target.value = "";

    for (const file of files) {
      try {
        // Init upload
        const initResult = await attachmentsSdk.initUpload({
          entryId: entry.id,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          kind: "file",
        });

        // Upload to S3
        const uploadResp = await fetch(initResult.presignedPutUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        if (!uploadResp.ok) {
          throw new Error(`Upload failed: ${uploadResp.status}`);
        }

        // Complete
        await attachmentsSdk.completeUpload(initResult.attachment.id);

        // Invalidate attachments query so AttachmentPanel updates
        await queryClient.invalidateQueries({
          queryKey: attachmentsQueryKey(entry.id),
        });

        // Insert file node in editor
        tiptapRef.current?.insertFileNode({
          attachmentId: initResult.attachment.id,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });

        // Trigger save since editor content changed
        triggerAutoSave();
      } catch (error) {
        console.error("[TaskEditor] File attachment failed:", error);
      }
    }
  }, [entry.id, triggerAutoSave, queryClient]);

  // Handle attachment deleted from the AttachmentPanel — remove the
  // corresponding image or file node from the Tiptap editor content.
  const handleAttachmentDeletedFromPanel = useCallback(
    (attachmentId: string) => {
      const editor = tiptapRef.current?.editor;
      if (!editor || editor.isDestroyed) return;

      const { doc, tr } = editor.state;
      let deletedPos = -1;
      let deletedSize = 0;

      doc.descendants((node, pos) => {
        if (deletedPos >= 0) return false; // already found
        if (
          (node.type.name === "image" || node.type.name === "fileAttachment") &&
          node.attrs.attachmentId === attachmentId
        ) {
          deletedPos = pos;
          deletedSize = node.nodeSize;
          return false;
        }
      });

      if (deletedPos >= 0) {
        tr.delete(deletedPos, deletedPos + deletedSize);
        editor.view.dispatch(tr);
      }
    },
    []
  );

  // Current topic display info
  const currentTopicDisplay = (() => {
    if (selectedTopicId === AUTO_TOPIC) return { name: "Auto", color: "#8b5cf6" };
    if (selectedTopicId === null) return { name: "No topic", color: "#6b7280" };
    return topicMap.get(selectedTopicId) ?? { name: "Unknown", color: "#6b7280" };
  })();

  return (
    <motion.div
      ref={editorRef}
      data-testid="task-editor"
      data-task-id={entry.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onClick={handleEditorClick}
      className="task-editor glass-panel rounded-2xl p-5 w-full @container"
    >
      {/* Top Row: Title + Action Buttons */}
      <div className="flex flex-col gap-3 mb-2 @[640px]:flex-row @[640px]:items-center @[640px]:justify-between @[640px]:gap-4">
        {/* Left side: Complete button + Title */}
        <div className="flex items-center gap-3 w-full min-w-0 order-2 @[640px]:order-1 @[640px]:flex-1 @[640px]:w-auto">
          {entryType === "task" && (
            <button
              type="button"
              aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
              onClick={(e) => { e.stopPropagation(); handleToggleCompleted(); }}
              className={cn(
                "p-1 rounded-lg transition-all flex-shrink-0",
                isCompleted
                  ? "text-emerald-400 hover:text-emerald-300"
                  : "text-white/40 hover:text-white/70"
              )}
              title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
            >
              {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <label htmlFor={`title-${entry.id}`} className="sr-only">Title</label>
            <input
              ref={titleRef}
              id={`title-${entry.id}`}
              type="text"
              aria-label="Title"
              value={title}
              onChange={handleTitleChange}
              placeholder={entryType === "task" ? "Task title" : "Note title"}
              className={cn(
                "w-full bg-transparent border-none outline-none text-xl @[640px]:text-2xl font-semibold placeholder:text-white/30 focus:placeholder:text-white/10 transition-all",
                isCompleted ? "text-white/50 line-through" : "text-white/90"
              )}
            />
          </div>
        </div>

        {/* Right side: Buttons */}
        <div className="flex flex-col items-end gap-2 w-full @[640px]:w-auto order-1 @[640px]:order-2">
          <div className="flex items-center gap-1.5 @[380px]:gap-2 flex-wrap justify-end">
            {/* Entry Type Toggle */}
            <button
              type="button"
              aria-label={entryType === "task" ? "Switch to note" : "Switch to task"}
              onClick={(e) => { e.stopPropagation(); handleEntryTypeToggle(); }}
              className={cn(
                "flex items-center gap-1.5 px-2 @[420px]:px-3 py-1.5 rounded-lg text-sm transition-all flex-shrink-0",
                entryType === "task"
                  ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                  : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
              )}
              title={entryType === "task" ? "Task (click to switch to note)" : "Note (click to switch to task)"}
            >
              {entryType === "task" ? (
                <>
                  <ListTodo className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden @[420px]:inline">Task</span>
                </>
              ) : (
                <>
                  <StickyNote className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden @[420px]:inline">Note</span>
                </>
              )}
            </button>

            {/* Topic Selector Dropdown — uses API topics, rendered via portal */}
            <TopicDropdown
              topicMenuRef={topicMenuRef}
              isTopicMenuOpen={isTopicMenuOpen}
              onToggle={() => setUIState((prev) => ({ ...prev, isTopicMenuOpen: !prev.isTopicMenuOpen }))}
              currentTopicDisplay={currentTopicDisplay}
              selectedTopicId={selectedTopicId}
              topics={topics}
              onSelect={handleTopicSelect}
            />

            {/* Reminder Button */}
            <button
              type="button"
              aria-label="Schedule reminder"
              className={cn(
                "p-1.5 @[380px]:p-2 rounded-lg transition-all flex-shrink-0",
                activeReminderId
                  ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                  : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
              )}
              title={activeReminderId ? "Reminder scheduled (click to manage)" : "Schedule reminder"}
              onClick={() => setIsReminderDialogOpen(true)}
            >
              <Bell className="w-4 h-4 @[380px]:w-5 @[380px]:h-5" />
            </button>

            {/* Summarize Button */}
            <button
              type="button"
              aria-label={isSummarizing ? "Summary in progress" : "Summarize with AI"}
              className={cn(
                "p-1.5 @[380px]:p-2 rounded-lg transition-all flex-shrink-0",
                isSummarizing
                  ? "bg-sky-500/15 text-sky-400 cursor-wait"
                  : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
              )}
              title={isSummarizing ? "Summary in progress..." : "Summarize with AI"}
              onClick={handleSummarize}
              disabled={isSummarizing}
            >
              <Brain className={cn("w-4 h-4 @[380px]:w-5 @[380px]:h-5", isSummarizing && "animate-pulse")} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area — Tiptap WYSIWYG Editor */}
      <div
        className="overflow-hidden"
        style={{
          height: isExpanded ? "auto" : "80px",
          minHeight: isExpanded ? "120px" : "80px",
        }}
      >
        <TiptapEditor
          content={contentJson}
          onUpdate={handleContentUpdate}
          isExpanded={isExpanded}
          editable={true}
          placeholder={entryType === "task" ? "Describe your task..." : "Write your note..."}
          editorRef={tiptapRef}
          onImagePaste={uploadImages}
          onFilePaste={handleFilePaste}
        />
      </div>

      {/* AI Summary Section */}
      <AnimatePresence>
        {entry.summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3"
          >
            <div className="bg-sky-500/[0.07] border border-sky-500/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wide">
                  AI Summary
                </span>
              </div>
              <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                {entry.summary}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments panel (only when expanded and entry is saved) */}
      {isExpanded && entry.id && (
        <AttachmentPanel entryId={entry.id} dateKey={dateKey} onAttachmentDeleted={handleAttachmentDeletedFromPanel} />
      )}

      {/* Bottom Toolbar */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between mt-4"
          >
            <div className="flex items-center gap-2">
              <div className="relative" ref={contentMenuRef}>
                <button
                  type="button"
                  aria-label="Add content"
                  aria-haspopup="menu"
                  aria-expanded={isContentMenuOpen}
                  onClick={(e) => { e.stopPropagation(); setUIState((prev) => ({ ...prev, isContentMenuOpen: !prev.isContentMenuOpen })); }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1"
                >
                  <Plus className="w-5 h-5" />
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isContentMenuOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isContentMenuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 mb-2 bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px] z-50"
                    >
                      {contentMenuItems.map((item) => (
                        <button
                          key={item.id}
                          role="menuitem"
                          aria-label={item.label}
                          className="w-full px-4 py-3 flex items-center gap-3 text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm"
                          onClick={() => handleContentMenuAction(item.id)}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                aria-label="Format"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                title="Text format"
              >
                <Palette className="w-5 h-5" />
              </button>
            </div>

            <div
              data-testid="auto-save-indicator"
              className={cn(
                "text-xs transition-opacity duration-300",
                isSaving ? "text-primary opacity-100" : "text-white/30 opacity-50"
              )}
            >
              {isSaving ? "Saving..." : "Auto-saved"}
            </div>

            <button
              type="button"
              aria-label="Delete"
              onClick={handleDeleteClick}
              className="p-2 rounded-lg bg-white/5 hover:bg-destructive/20 text-white/60 hover:text-destructive transition-all"
              title="Delete entry"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input for generic file attachments */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        tabIndex={-1}
        onChange={handleFileAttach}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={entryType === "task" ? "Delete task" : "Delete note"}
        message={
          <>
            Are you sure you want to delete{" "}
            <strong className="text-white">{title || (entryType === "task" ? "this task" : "this note")}</strong>?{" "}
            This action cannot be undone.
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        closeOnBackdrop={true}
        destructive={true}
        initialFocus="cancel"
      />

      {/* Reminder dialog */}
      <ReminderDialog
        open={isReminderDialogOpen}
        onClose={() => setIsReminderDialogOpen(false)}
        onCreate={handleCreateReminder}
        onReschedule={handleRescheduleReminder}
        onCancel={handleCancelReminder}
        hasActiveReminder={!!activeReminderId}
        isSaving={isReminderSaving}
      />
    </motion.div>
  );
}
