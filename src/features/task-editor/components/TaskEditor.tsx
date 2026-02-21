"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Brain,
  Bell,
  Image,
  Code,
  CirclePlay,
  Paperclip,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Circle,
  ListTodo,
  StickyNote,
  X,
  ALargeSmall,
} from "lucide-react";
import Markdown from "react-markdown";
import { useQueryClient } from "@tanstack/react-query";
import { useStore, selectDateKey } from "@/shared/store";
import type { EntryType } from "@/shared/types";
import type { ApiEntry } from "@/shared/api/sdk";
import {
  useTopicsQuery,
  useUserProfileQuery,
  entriesQueryKey,
  attachmentsQueryKey,
} from "@/shared/api/queries";
import {
  updateEntryAndInvalidate,
  deleteEntryAndInvalidate,
} from "@/shared/api/mutations";
import * as entriesSdk from "@/shared/api/sdk/entries";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";
import { ApiError } from "@/shared/api/apiClient";
import { cn, uid } from "@/shared/lib";
import { extractPlainText } from "@/shared/lib/extractPlainText";
import { ConfirmDialog } from "@/shared/ui";
import { ReminderDialog } from "./ReminderDialog";
import { AttachmentPanel } from "@/features/attachments";
import "@/features/tasks-container/styles/scrollbar.css";
import { TiptapEditor } from "./TiptapEditor";
import type { TiptapEditorHandle } from "./TiptapEditor";
import { useImageUpload } from "../hooks/useImageUpload";
import { useResolveAttachmentUrls } from "../hooks/useResolveAttachmentUrls";
import { useTrackDeletedImages } from "../hooks/useTrackDeletedImages";
import { useServerDataSync } from "../hooks/useServerDataSync";
import { useReminderActions } from "../hooks/useReminderActions";
import { useSummaryActions } from "../hooks/useSummaryActions";
import {
  useEditorCollapse,
  useContentMenuClose,
} from "../hooks/useEditorCollapse";
import type { ContentMenuItem, TaskEditorUIState } from "../types";
import { YoutubeUrlDialog } from "./YoutubeUrlDialog";
import { FormatMenu } from "./FormatMenu";

const AUTOSAVE_DEBOUNCE_MS = 1800;

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
// Extracted helpers — reduce Cognitive Complexity of callbacks
// ============================================================================

/**
 * Parse entry content JSON, returning an empty object when absent/invalid.
 * Reused by both initial state and draftRef initialization.
 */
function parseEntryContent(content: unknown): Record<string, unknown> {
  return content &&
    typeof content === "object" &&
    Object.keys(content as Record<string, unknown>).length > 0
    ? (content as Record<string, unknown>)
    : {};
}

/**
 * Resolve topic display info (name + color) from the selected topic ID.
 */
function getTopicDisplayInfo(
  selectedTopicId: string | null,
  topicMap: Map<string, { name: string; color: string }>,
): { name: string; color: string } {
  if (selectedTopicId === AUTO_TOPIC) return { name: "Auto", color: "#8b5cf6" };
  if (selectedTopicId === null) return { name: "No topic", color: "#6b7280" };
  return (
    topicMap.get(selectedTopicId) ?? { name: "No topic", color: "#6b7280" }
  );
}

/**
 * Attempt auto-topic classification via the API. Silently ignores errors.
 */
async function tryAutoClassifyTopic(
  entryId: string,
  dateKey: string,
  queryClient: ReturnType<typeof useQueryClient>,
  setSelectedTopicId: (id: string) => void,
): Promise<void> {
  try {
    const res = await entriesSdk.autoTopicEntry(entryId);
    if (res.selectedTopicId) {
      setSelectedTopicId(res.selectedTopicId);
      await queryClient.invalidateQueries({
        queryKey: entriesQueryKey(dateKey),
      });
    }
  } catch {
    // Auto-topic is best-effort; swallow errors silently
  }
}

/**
 * Handle API errors from entry save operations.
 */
async function handleSaveApiError(
  error: unknown,
  dateKey: string,
  queryClient: ReturnType<typeof useQueryClient>,
  onClose?: () => void,
): Promise<void> {
  if (!(error instanceof ApiError)) {
    console.error("[TaskEditor] update failed:", error);
    return;
  }
  switch (error.status) {
    case 401:
      console.warn("Not authenticated");
      break;
    case 404:
      await queryClient.invalidateQueries({
        queryKey: entriesQueryKey(dateKey),
      });
      onClose?.();
      break;
    case 409:
      await queryClient.invalidateQueries({
        queryKey: entriesQueryKey(dateKey),
      });
      console.warn("Conflict (version). Refreshed entries.");
      break;
    default:
      console.error("[TaskEditor] update failed:", error);
  }
}

// ============================================================================
// TaskEditorActionButtons — right-side action buttons (type, topic, etc.)
// Extracted to reduce TaskEditor Cognitive Complexity.
// ============================================================================
interface TaskEditorActionButtonsProps {
  entryType: EntryType;
  onToggleEntryType: () => void;
  topicMenuRef: React.RefObject<HTMLDivElement | null>;
  isTopicMenuOpen: boolean;
  onToggleTopicMenu: () => void;
  currentTopicDisplay: { name: string; color: string };
  selectedTopicId: string | null;
  topics: Array<{ id: string; name: string; color: string }>;
  onSelectTopic: (topicId: string | null) => void;
  activeReminderId: string | null;
  onOpenReminder: () => void;
  isSummarizing: boolean;
  onSummarize: () => void;
  summarizeError: string | null;
  onDismissError: () => void;
}

function TaskEditorActionButtons({
  entryType,
  onToggleEntryType,
  topicMenuRef,
  isTopicMenuOpen,
  onToggleTopicMenu,
  currentTopicDisplay,
  selectedTopicId,
  topics,
  onSelectTopic,
  activeReminderId,
  onOpenReminder,
  isSummarizing,
  onSummarize,
  summarizeError,
  onDismissError,
}: Readonly<TaskEditorActionButtonsProps>) {
  return (
    <div className="flex flex-col items-end gap-2 w-full @[640px]:w-auto order-1 @[640px]:order-2">
      <div className="flex items-center gap-1.5 @[380px]:gap-2 flex-wrap justify-end">
        {/* Entry Type Toggle */}
        <button
          type="button"
          aria-label={
            entryType === "task" ? "Switch to note" : "Switch to task"
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleEntryType();
          }}
          className={cn(
            "flex items-center gap-1.5 px-2 @[420px]:px-3 py-1.5 rounded-lg text-sm transition-all flex-shrink-0",
            entryType === "task"
              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30",
          )}
          title={
            entryType === "task"
              ? "Task (click to switch to note)"
              : "Note (click to switch to task)"
          }
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

        {/* Topic Selector Dropdown */}
        <TopicDropdown
          topicMenuRef={topicMenuRef}
          isTopicMenuOpen={isTopicMenuOpen}
          onToggle={onToggleTopicMenu}
          currentTopicDisplay={currentTopicDisplay}
          selectedTopicId={selectedTopicId}
          topics={topics}
          onSelect={onSelectTopic}
        />

        {/* Reminder Button */}
        <button
          type="button"
          aria-label="Schedule reminder"
          className={cn(
            "p-1.5 @[380px]:p-2 rounded-lg transition-all flex-shrink-0",
            activeReminderId
              ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white",
          )}
          title={
            activeReminderId
              ? "Reminder scheduled (click to manage)"
              : "Schedule reminder"
          }
          onClick={onOpenReminder}
        >
          <Bell className="w-4 h-4 @[380px]:w-5 @[380px]:h-5" />
        </button>

        {/* Summarize Button */}
        <button
          type="button"
          aria-label={
            isSummarizing ? "Summary in progress" : "Summarize with Neuraal"
          }
          className={cn(
            "p-1.5 @[380px]:p-2 rounded-lg transition-all flex-shrink-0",
            isSummarizing
              ? "bg-sky-500/15 text-sky-400 cursor-wait"
              : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white",
          )}
          title={
            isSummarizing ? "Summary in progress..." : "Summarize with Neuraal"
          }
          onClick={onSummarize}
          disabled={isSummarizing}
        >
          <Brain
            className={cn(
              "w-4 h-4 @[380px]:w-5 @[380px]:h-5",
              isSummarizing && "animate-pulse",
            )}
          />
        </button>
      </div>
      {summarizeError && (
        <p
          className="text-xs text-amber-400 mt-1 flex items-center gap-1"
          role="alert"
        >
          {summarizeError}
          <button
            type="button"
            aria-label="Dismiss"
            className="text-white/60 hover:text-white ml-1"
            onClick={onDismissError}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </p>
      )}
    </div>
  );
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
}: Readonly<TopicDropdownProps>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    opensUp: boolean;
  }>({ top: 0, left: 0, opensUp: false });

  // Recalculate position when menu opens or on scroll/resize
  // Smart positioning: opens below if space, otherwise above
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const PANEL_MAX_H = 320; // estimated max dropdown height
    const GAP = 8;
    const spaceBelow = vh - rect.bottom;

    if (spaceBelow >= PANEL_MAX_H + GAP) {
      // Enough space below — open downward
      setPanelPos({ top: rect.bottom + GAP, left: rect.left, opensUp: false });
    } else {
      // Not enough space below — open upward (bottom edge at button top)
      setPanelPos({ top: rect.top - GAP, left: rect.left, opensUp: true });
    }
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
        aria-haspopup="menu"
        aria-expanded={isTopicMenuOpen}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-1.5 @[380px]:gap-2 px-2 @[420px]:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 hover:text-white transition-all min-w-0 max-w-[100px] @[380px]:max-w-[120px] @[420px]:max-w-[180px]"
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 topic-dot"
          style={
            { "--dot-color": currentTopicDisplay.color } as React.CSSProperties
          }
        />
        <span className="flex-1 min-w-0 truncate">
          {currentTopicDisplay.name}
        </span>
        {selectedTopicId === AUTO_TOPIC && (
          <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />
        )}
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform flex-shrink-0",
            isTopicMenuOpen && "rotate-180",
          )}
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isTopicMenuOpen && (
              <motion.div
                ref={panelRef}
                role="menu"
                aria-label="Select topic"
                initial={{
                  opacity: 0,
                  y: panelPos.opensUp ? 10 : -10,
                  scale: 0.95,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: panelPos.opensUp ? 10 : -10,
                  scale: 0.95,
                }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  ...(panelPos.opensUp
                    ? {
                        bottom: window.innerHeight - panelPos.top,
                        left: panelPos.left,
                      }
                    : { top: panelPos.top, left: panelPos.left }),
                  zIndex: 9999,
                  maxHeight: "min(320px, 50vh)",
                  overflowY: "auto",
                }}
                className="bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px] tasks-scrollbar"
              >
                {/* Auto option */}
                <button
                  role="menuitemradio"
                  aria-checked={selectedTopicId === AUTO_TOPIC}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                    selectedTopicId === AUTO_TOPIC
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5",
                  )}
                  onClick={() => onSelect(AUTO_TOPIC)}
                >
                  <div
                    className="w-3 h-3 rounded-full topic-dot"
                    style={{ "--dot-color": "#8b5cf6" } as React.CSSProperties}
                  />
                  <span>Auto</span>
                  <Sparkles className="w-3 h-3 text-purple-400 ml-auto" />
                </button>

                {/* No topic option */}
                <button
                  role="menuitemradio"
                  aria-checked={selectedTopicId === null}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                    selectedTopicId === null
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5",
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
                    role="menuitemradio"
                    aria-checked={selectedTopicId === t.id}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                      selectedTopicId === t.id
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/5",
                    )}
                    onClick={() => onSelect(t.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-full topic-dot"
                      style={{ "--dot-color": t.color } as React.CSSProperties}
                    />
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
          document.body,
        )}
    </div>
  );
}

export function TaskEditor({ entry, onClose }: Readonly<TaskEditorProps>) {
  const queryClient = useQueryClient();
  const dateKey = useStore(selectDateKey);
  const { data: topics = [] } = useTopicsQuery();

  // ---------------------------------------------------------------------------
  // Form state (draft — initialized from entry props)
  // ---------------------------------------------------------------------------
  const [title, setTitle] = useState<string>(entry.title);

  // Store content as TipTap JSON directly (no more plain text extraction)
  const [contentJson, setContentJson] = useState<Record<string, unknown>>(() =>
    parseEntryContent(entry.content),
  );

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    entry.topicId ?? AUTO_TOPIC,
  );
  const [entryType, setEntryType] = useState<EntryType>(entry.type);
  const [isCompleted, setIsCompleted] = useState<boolean>(
    entry.completed ?? false,
  );

  // ---------------------------------------------------------------------------
  // Refs that mirror draft state — used inside setTimeout to always read the
  // LATEST value, avoiding stale closures that caused topic/completed not saving.
  // ---------------------------------------------------------------------------
  const titleRef = useRef<HTMLInputElement>(null);
  const tiptapRef = useRef<TiptapEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formatTriggerRef = useRef<HTMLButtonElement>(null);
  const draftRef = useRef({
    title: entry.title,
    contentJson: parseEntryContent(entry.content),
    selectedTopicId: (entry.topicId ?? AUTO_TOPIC) as string | null,
    entryType: entry.type as EntryType,
    isCompleted: entry.completed ?? false,
  });

  // Keep draftRef in sync with state
  useEffect(() => {
    draftRef.current.title = title;
  }, [title]);
  useEffect(() => {
    draftRef.current.contentJson = contentJson;
  }, [contentJson]);
  useEffect(() => {
    draftRef.current.selectedTopicId = selectedTopicId;
  }, [selectedTopicId]);
  useEffect(() => {
    draftRef.current.entryType = entryType;
  }, [entryType]);
  useEffect(() => {
    draftRef.current.isCompleted = isCompleted;
  }, [isCompleted]);

  // Image upload hook
  const { uploadImages } = useImageUpload(entry.id, tiptapRef);

  // Resolve attachment URLs on content load
  useResolveAttachmentUrls(tiptapRef, contentJson);

  // Track deleted image/file nodes and clean up their attachments
  useTrackDeletedImages(entry.id, tiptapRef);

  // Track the current entry version for optimistic concurrency
  const versionRef = useRef<number>(entry.version);
  useEffect(() => {
    versionRef.current = entry.version;
  }, [entry.version]);

  // Track whether the user has manually edited the title at least once.
  // Auto-topic should NOT fire until the user touches the title — otherwise
  // simply creating a new entry would auto-assign a topic immediately.
  const titleEditedRef = useRef(false);

  // Sync server-injected data (transcription, vision) → Tiptap editor
  useServerDataSync(entry.content, tiptapRef, setContentJson, draftRef);

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

  // Format menu state
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);

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
    const topicIdToSend =
      draft.selectedTopicId === AUTO_TOPIC ? null : draft.selectedTopicId;
    const contentToSave =
      Object.keys(draft.contentJson).length > 0 ? draft.contentJson : {};
    const shouldAutoTopic =
      draft.selectedTopicId === AUTO_TOPIC && titleEditedRef.current;

    const payload = {
      title: draft.title.trim() || entry.title,
      content: contentToSave,
      topicId: topicIdToSend,
      completed: draft.entryType === "task" ? draft.isCompleted : undefined,
      type: draft.entryType as "task" | "note",
      version: versionRef.current,
    };

    const hash = `${payload.title}|${JSON.stringify(payload.content)}|${payload.topicId}|${payload.type}|${payload.completed}`;
    if (hash === lastSavedHashRef.current) {
      setUIState((prev) => ({ ...prev, isSaving: false }));
      if (shouldAutoTopic) {
        await tryAutoClassifyTopic(
          entry.id,
          dateKey,
          queryClient,
          setSelectedTopicId,
        );
      }
      return;
    }

    setUIState((prev) => ({ ...prev, isSaving: true }));

    try {
      const result = await updateEntryAndInvalidate(
        queryClient,
        entry.id,
        dateKey,
        payload,
      );
      if (result) {
        versionRef.current = result.version;
        lastSavedHashRef.current = hash;
      }
      if (shouldAutoTopic) {
        await tryAutoClassifyTopic(
          entry.id,
          dateKey,
          queryClient,
          setSelectedTopicId,
        );
      }
    } catch (error) {
      if (!ac.signal.aborted) {
        await handleSaveApiError(error, dateKey, queryClient, onClose);
      }
    } finally {
      if (!ac.signal.aborted) {
        setUIState((prev) => ({ ...prev, isSaving: false }));
      }
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

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      titleEditedRef.current = true;
      const newTitle = e.target.value;
      setTitle(newTitle);

      // Optimistic update: reflect title immediately in VerticalCalendar
      queryClient.setQueryData<ApiEntry[]>(entriesQueryKey(dateKey), (old) =>
        old?.map((en) =>
          en.id === entry.id ? { ...en, title: newTitle } : en,
        ),
      );

      triggerAutoSave();
    },
    [queryClient, dateKey, entry.id, triggerAutoSave],
  );

  const handleContentUpdate = useCallback(
    (json: Record<string, unknown>) => {
      setContentJson(json);
      triggerAutoSave();
    },
    [triggerAutoSave],
  );

  const handleTopicSelect = useCallback(
    (topicId: string | null) => {
      setSelectedTopicId(topicId);
      setUIState((prev) => ({ ...prev, isTopicMenuOpen: false }));

      // Optimistic update: reflect topic immediately in FloatingTopics bubbles
      const optimisticTopicId = topicId === AUTO_TOPIC ? null : topicId;
      queryClient.setQueryData<ApiEntry[]>(entriesQueryKey(dateKey), (old) =>
        old?.map((en) =>
          en.id === entry.id ? { ...en, topicId: optimisticTopicId } : en,
        ),
      );

      // If the user explicitly picks "Auto", allow auto-topic to run
      // even if title hasn't been edited (they're opting in intentionally)
      if (topicId === AUTO_TOPIC && title.trim().length > 0) {
        titleEditedRef.current = true;
      }
      triggerAutoSave();
    },
    [title, triggerAutoSave, queryClient, dateKey, entry.id],
  );

  const handleEntryTypeToggle = useCallback(() => {
    const newType: EntryType = entryType === "task" ? "note" : "task";
    setEntryType(newType);
    if (newType === "note") {
      setIsCompleted(false);
    }

    // Optimistic update: reflect type change immediately in VerticalCalendar
    queryClient.setQueryData<ApiEntry[]>(entriesQueryKey(dateKey), (old) =>
      old?.map((en) =>
        en.id === entry.id
          ? {
              ...en,
              type: newType,
              completed: newType === "note" ? null : en.completed,
            }
          : en,
      ),
    );

    triggerAutoSave();
  }, [entryType, queryClient, dateKey, entry.id, triggerAutoSave]);

  const handleToggleCompleted = useCallback(() => {
    if (entryType !== "task") return;
    const newCompleted = !isCompleted;
    setIsCompleted(newCompleted);

    // Optimistic update: immediately reflect in VerticalCalendar
    // without waiting for the debounced save + API round-trip.
    // If the save fails, invalidateQueries in the catch block reverts this.
    queryClient.setQueryData<ApiEntry[]>(entriesQueryKey(dateKey), (old) =>
      old?.map((e) =>
        e.id === entry.id ? { ...e, completed: newCompleted } : e,
      ),
    );

    triggerAutoSave();
  }, [entryType, isCompleted, queryClient, dateKey, entry.id, triggerAutoSave]);

  // Handle delete - opens confirmation dialog
  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  // Confirm delete - actually removes the entry via API
  const handleConfirmDelete = useCallback(async () => {
    setIsDeleteDialogOpen(false);
    try {
      await deleteEntryAndInvalidate(queryClient, entry.id, dateKey);
      onClose?.();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await queryClient.invalidateQueries({
          queryKey: entriesQueryKey(dateKey),
        });
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
  const {
    isSummarizing,
    summarizeError,
    setSummarizeError,
    handleSummarize,
    handleClearSummary,
  } = useSummaryActions(
    entry.id,
    entry.summaryUpdatedAt,
    dateKey,
    queryClient,
    extractPlainText(contentJson).length > 0,
    onClose,
  );

  // ---------------------------------------------------------------------------
  // YouTube URL dialog
  // ---------------------------------------------------------------------------
  const [isYoutubeDialogOpen, setIsYoutubeDialogOpen] = useState(false);

  const handleYoutubeSubmit = useCallback((url: string) => {
    tiptapRef.current?.insertYoutube(url);
  }, []);

  // ---------------------------------------------------------------------------
  // Reminders (create / reschedule / cancel)
  // ---------------------------------------------------------------------------
  const {
    isReminderDialogOpen,
    setIsReminderDialogOpen,
    activeReminderId,
    isReminderSaving,
    handleCreateReminder,
    handleRescheduleReminder,
    handleCancelReminder,
  } = useReminderActions(entry.id, queryClient, isExpanded);

  const { data: userProfile } = useUserProfileQuery(isReminderDialogOpen);

  const handleEditorClick = useCallback(() => {
    // Only expand if not already expanded — avoids scroll jump
    setUIState((prev) => {
      if (prev.isExpanded) return prev;
      return { ...prev, isExpanded: true };
    });
  }, []);

  // Click outside → collapse (but ignore clicks on portal-rendered dialogs)
  useEditorCollapse(editorRef, flushPendingSave, setUIState);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Close content menu on click outside its container
  useContentMenuClose(isContentMenuOpen, contentMenuRef, setUIState);

  // Content menu items
  const contentMenuItems: ContentMenuItem[] = [
    { id: "image", label: "Image", icon: Image },
    { id: "code", label: "Code snippet", icon: Code },
    { id: "youtube", label: "YouTube video", icon: CirclePlay },
    { id: "file", label: "Attach file", icon: Paperclip },
  ];

  // Handle "+" menu item clicks
  const handleContentMenuAction = useCallback(
    (itemId: string) => {
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
        case "youtube":
          setIsYoutubeDialogOpen(true);
          break;
        case "file": {
          fileInputRef.current?.click();
          break;
        }
      }
    },
    [uploadImages],
  );

  const handleFilePaste = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || !entry.id) return;

      for (const file of files) {
        const uploadId = uid();
        const mime = file.type || "application/octet-stream";

        tiptapRef.current?.insertUploadingFileNode({
          uploadId,
          filename: file.name,
          mimeType: mime,
          sizeBytes: file.size,
        });

        try {
          const initResult = await attachmentsSdk.initUpload({
            entryId: entry.id,
            filename: file.name,
            mimeType: mime,
            sizeBytes: file.size,
            kind: "file",
          });

          const uploadResp = await fetch(initResult.presignedPutUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": mime },
          });

          if (!uploadResp.ok) {
            throw new Error(`Upload failed: ${uploadResp.status}`);
          }

          await attachmentsSdk.completeUpload(initResult.attachment.id);

          await queryClient.invalidateQueries({
            queryKey: attachmentsQueryKey(entry.id),
          });

          tiptapRef.current?.finalizeFileNode(uploadId, {
            attachmentId: initResult.attachment.id,
          });

          triggerAutoSave();
        } catch (error) {
          console.error("[TaskEditor] File paste attachment failed:", error);
          tiptapRef.current?.removeUploadingFileNode(uploadId);
        }
      }
    },
    [entry.id, triggerAutoSave, queryClient],
  );

  const handleFileAttach = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0 || !entry.id) return;
      e.target.value = "";

      for (const file of files) {
        const uploadId = uid();
        const mime = file.type || "application/octet-stream";

        tiptapRef.current?.insertUploadingFileNode({
          uploadId,
          filename: file.name,
          mimeType: mime,
          sizeBytes: file.size,
        });

        try {
          const initResult = await attachmentsSdk.initUpload({
            entryId: entry.id,
            filename: file.name,
            mimeType: mime,
            sizeBytes: file.size,
            kind: "file",
          });

          const uploadResp = await fetch(initResult.presignedPutUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": mime },
          });

          if (!uploadResp.ok) {
            throw new Error(`Upload failed: ${uploadResp.status}`);
          }

          await attachmentsSdk.completeUpload(initResult.attachment.id);

          await queryClient.invalidateQueries({
            queryKey: attachmentsQueryKey(entry.id),
          });

          tiptapRef.current?.finalizeFileNode(uploadId, {
            attachmentId: initResult.attachment.id,
          });

          triggerAutoSave();
        } catch (error) {
          console.error("[TaskEditor] File attachment failed:", error);
          tiptapRef.current?.removeUploadingFileNode(uploadId);
        }
      }
    },
    [entry.id, triggerAutoSave, queryClient],
  );

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
    [],
  );

  // Current topic display info
  const currentTopicDisplay = getTopicDisplayInfo(selectedTopicId, topicMap);

  return (
    <motion.div
      ref={editorRef}
      data-testid="task-editor"
      data-task-id={entry.id}
      aria-label="Task editor"
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
              aria-label={
                isCompleted ? "Mark as incomplete" : "Mark as complete"
              }
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCompleted();
              }}
              className={cn(
                "p-1 rounded-lg transition-all flex-shrink-0",
                isCompleted
                  ? "text-emerald-400 hover:text-emerald-300"
                  : "text-white/40 hover:text-white/70",
              )}
              title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <Circle className="w-6 h-6" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <label htmlFor={`title-${entry.id}`} className="sr-only">
              Title
            </label>
            <input
              ref={titleRef}
              id={`title-${entry.id}`}
              type="text"
              aria-label="Title"
              autoComplete="off"
              value={title}
              onChange={handleTitleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  tiptapRef.current?.editor?.commands.focus();
                }
              }}
              placeholder={entryType === "task" ? "Task title" : "Note title"}
              className={cn(
                "w-full bg-transparent border-none outline-none text-xl @[640px]:text-2xl font-semibold placeholder:text-white/30 focus:placeholder:text-white/10 transition-all",
                isCompleted ? "text-white/50 line-through" : "text-white/90",
              )}
            />
          </div>
        </div>

        {/* Right side: Buttons */}
        <TaskEditorActionButtons
          entryType={entryType}
          onToggleEntryType={handleEntryTypeToggle}
          topicMenuRef={topicMenuRef}
          isTopicMenuOpen={isTopicMenuOpen}
          onToggleTopicMenu={() =>
            setUIState((prev) => ({
              ...prev,
              isTopicMenuOpen: !prev.isTopicMenuOpen,
            }))
          }
          currentTopicDisplay={currentTopicDisplay}
          selectedTopicId={selectedTopicId}
          topics={topics}
          onSelectTopic={handleTopicSelect}
          activeReminderId={activeReminderId}
          onOpenReminder={() => setIsReminderDialogOpen(true)}
          isSummarizing={isSummarizing}
          onSummarize={handleSummarize}
          summarizeError={summarizeError}
          onDismissError={() => setSummarizeError(null)}
        />
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
          placeholder={
            entryType === "task"
              ? "Describe your task..."
              : "Write your note..."
          }
          editorRef={tiptapRef}
          onImagePaste={uploadImages}
          onFilePaste={handleFilePaste}
          onFocus={handleEditorClick}
          entryId={entry.id}
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
            <div className="bg-sky-500/[0.07] border border-sky-500/15 rounded-xl p-4 relative group/summary">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold text-sky-400 uppercase tracking-wide">
                    Neuraal Summary
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Remove summary"
                  title="Remove summary"
                  className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover/summary:opacity-100"
                  onClick={handleClearSummary}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Markdown content */}
              <div className="summary-markdown text-sm text-white/75 leading-relaxed">
                <Markdown>{entry.summary}</Markdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments panel (only when expanded and entry is saved) */}
      {isExpanded && entry.id && (
        <AttachmentPanel
          entryId={entry.id}
          dateKey={dateKey}
          onAttachmentDeleted={handleAttachmentDeletedFromPanel}
        />
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setUIState((prev) => ({
                      ...prev,
                      isContentMenuOpen: !prev.isContentMenuOpen,
                    }));
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1"
                >
                  <Plus className="w-5 h-5" />
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform",
                      isContentMenuOpen && "rotate-180",
                    )}
                  />
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

              <div className="relative">
                <button
                  ref={formatTriggerRef}
                  type="button"
                  aria-label="Text format"
                  aria-haspopup="true"
                  aria-expanded={isFormatMenuOpen}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFormatMenuOpen((prev) => !prev);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    isFormatMenuOpen
                      ? "bg-white/15 text-white"
                      : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white",
                  )}
                  title="Text format"
                >
                  <ALargeSmall className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {isFormatMenuOpen && tiptapRef.current?.editor && (
                    <FormatMenu
                      editor={tiptapRef.current.editor}
                      onClose={() => setIsFormatMenuOpen(false)}
                      triggerRef={formatTriggerRef}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div
              data-testid="auto-save-indicator"
              aria-label="Auto-save indicator"
              className={cn(
                "text-xs transition-opacity duration-300",
                isSaving
                  ? "text-primary opacity-100"
                  : "text-white/30 opacity-50",
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
            <strong className="text-white">
              {title || (entryType === "task" ? "this task" : "this note")}
            </strong>
            {"? This action cannot be undone."}
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
        userPhoneNumber={userProfile?.phoneNumber}
      />

      {/* YouTube URL dialog */}
      <YoutubeUrlDialog
        isOpen={isYoutubeDialogOpen}
        onClose={() => setIsYoutubeDialogOpen(false)}
        onSubmit={handleYoutubeSubmit}
      />
    </motion.div>
  );
}
