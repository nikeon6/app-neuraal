"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { useStore } from "@/shared/store";
import { TOPICS, TOPIC_IDS } from "@/shared/constants";
import type { EntryId, DefaultTopicId, TopicMode, EntryType } from "@/shared/types";
import { MAX_ATTACHMENTS_SIZE_BYTES } from "@/shared/constants";
import { cn, getDefaultTopic } from "@/shared/lib";
import type { ContentMenuItem, TaskEditorUIState } from "../types";

/**
 * Props for TaskEditor component.
 */
interface TaskEditorProps {
  /** Entry ID for editing existing entry */
  entryId?: EntryId;
  /** Initial title value */
  initialTitle?: string;
  /** Initial content value */
  initialContent?: string;
  /** Initial topic selection */
  initialTopic?: DefaultTopicId | "auto";
  /** Initial entry type (task or note) */
  initialEntryType?: EntryType;
  /** Initial completed state (for tasks) */
  initialCompleted?: boolean;
  /** Callback when editor is closed */
  onClose?: () => void;
}

export function TaskEditor({
  entryId,
  initialTitle = "",
  initialContent = "",
  initialTopic = "auto",
  initialEntryType = "task",
  initialCompleted = false,
  onClose,
}: TaskEditorProps) {
  const { selectedDay, addTask, removeTask } = useStore();

  // Form state (draft)
  const [title, setTitle] = useState<string>(initialTitle);
  const [content, setContent] = useState<string>(initialContent);
  const [selectedTopic, setSelectedTopic] = useState<DefaultTopicId | "auto">(initialTopic);
  const [topicMode, setTopicMode] = useState<TopicMode>(initialTopic === "auto" ? "auto" : "manual");
  const [entryType, setEntryType] = useState<EntryType>(initialEntryType);
  const [isCompleted, setIsCompleted] = useState<boolean>(initialCompleted);

  // UI state
  const [uiState, setUIState] = useState<TaskEditorUIState>({
    isExpanded: false,
    isContentMenuOpen: false,
    isTopicMenuOpen: false,
    isSaving: false,
    saveError: undefined,
  });
  const [totalFileSize, setTotalFileSize] = useState<number>(0);

  // Destructure UI state for convenience
  const { isExpanded, isContentMenuOpen, isTopicMenuOpen, isSaving } = uiState;

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const contentMenuRef = useRef<HTMLDivElement>(null);
  const topicMenuRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setUIState(prev => ({ ...prev, isSaving: true }));
      // Simulate save delay
      // TODO: Implement actual save with Entry type
      setTimeout(() => {
        setUIState(prev => ({ ...prev, isSaving: false }));
      }, 500);
    }, 1000);
  }, []);

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    triggerAutoSave();
  };

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    triggerAutoSave();
    // Auto-resize textarea
    if (contentRef.current) {
      contentRef.current.style.height = "auto";
      contentRef.current.style.height = contentRef.current.scrollHeight + "px";
    }
  };

  // Handle topic selection
  const handleTopicSelect = (topic: DefaultTopicId | "auto") => {
    setSelectedTopic(topic);
    setTopicMode(topic === "auto" ? "auto" : "manual");
    setUIState(prev => ({ ...prev, isTopicMenuOpen: false }));
    triggerAutoSave();
  };

  // Handle entry type toggle
  const handleEntryTypeToggle = () => {
    const newType: EntryType = entryType === "task" ? "note" : "task";
    setEntryType(newType);
    // Reset completed state when switching to note
    if (newType === "note") {
      setIsCompleted(false);
    }
    triggerAutoSave();
  };

  // Handle toggle completed (for tasks only)
  const handleToggleCompleted = () => {
    if (entryType !== "task") return;
    setIsCompleted(prev => !prev);
    triggerAutoSave();
  };

  // Handle delete
  const handleDelete = () => {
    if (entryId) {
      removeTask(selectedDay, entryId);
    }
    onClose?.();
  };

  // Handle click inside editor - expand
  const handleEditorClick = () => {
    setUIState(prev => ({ ...prev, isExpanded: true }));
  };

  // Handle click outside editor - collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editorRef.current &&
        !editorRef.current.contains(event.target as Node)
      ) {
        setUIState(prev => ({
          ...prev,
          isExpanded: false,
          isContentMenuOpen: false,
          isTopicMenuOpen: false,
        }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Content menu items
  const contentMenuItems: ContentMenuItem[] = [
    { id: "image", label: "Image", icon: Image },
    { id: "code", label: "Code snippet", icon: Code },
    { id: "youtube", label: "YouTube video", icon: Youtube },
    { id: "file", label: "Attach file", icon: Paperclip },
  ];

  // Get current topic display info
  const currentTopicDisplay = selectedTopic === "auto" 
    ? { name: "Auto", color: "#8b5cf6" }
    : (() => {
        const topic = getDefaultTopic(selectedTopic);
        return { name: topic?.name ?? "Unknown", color: topic?.color ?? "#6b7280" };
      })();

  return (
    <motion.div
      ref={editorRef}
      data-testid="task-editor"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onClick={handleEditorClick}
      className="task-editor glass-panel rounded-2xl p-5 w-full"
    >
      {/* Top Row: Title + Topic Selector + Action Buttons */}
      <div className="flex items-center justify-between gap-4 mb-2">
        {/* Left side: Complete button (task only) + Title */}
        <div className="flex items-center gap-3 flex-1">
          {/* Complete/Uncomplete button - only for tasks */}
          {entryType === "task" && (
            <button
              type="button"
              aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCompleted();
              }}
              className={cn(
                "p-1 rounded-lg transition-all flex-shrink-0",
                isCompleted 
                  ? "text-emerald-400 hover:text-emerald-300" 
                  : "text-white/40 hover:text-white/70"
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

          {/* Title Input */}
          <div className="flex-1">
            <label htmlFor="task-title" className="sr-only">
              Title
            </label>
            <input
              ref={titleRef}
              id="task-title"
              type="text"
              aria-label="Title"
              value={title}
              onChange={handleTitleChange}
              placeholder={entryType === "task" ? "Task title" : "Note title"}
              className={cn(
                "w-full bg-transparent border-none outline-none text-2xl font-semibold placeholder:text-white/30 focus:placeholder:text-white/10 transition-all",
                isCompleted ? "text-white/50 line-through" : "text-white/90"
              )}
            />
          </div>
        </div>

        {/* Right side: Buttons + File size */}
        <div className="flex flex-col items-end gap-2">
          {/* Buttons Row */}
          <div className="flex items-center gap-2">
            {/* Entry Type Toggle */}
            <button
              type="button"
              aria-label={entryType === "task" ? "Switch to note" : "Switch to task"}
              onClick={(e) => {
                e.stopPropagation();
                handleEntryTypeToggle();
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
                entryType === "task"
                  ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                  : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
              )}
              title={entryType === "task" ? "Task (click to switch to note)" : "Note (click to switch to task)"}
            >
              {entryType === "task" ? (
                <>
                  <ListTodo className="w-4 h-4" />
                  <span>Task</span>
                </>
              ) : (
                <>
                  <StickyNote className="w-4 h-4" />
                  <span>Note</span>
                </>
              )}
            </button>

            {/* Topic Selector Dropdown */}
            <div className="relative" ref={topicMenuRef}>
              <button
                type="button"
                aria-label="Topic"
                aria-haspopup="listbox"
                aria-expanded={isTopicMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setUIState(prev => ({ ...prev, isTopicMenuOpen: !prev.isTopicMenuOpen }));
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 hover:text-white transition-all"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentTopicDisplay.color }}
                />
                <span>{currentTopicDisplay.name}</span>
                {selectedTopic === "auto" && <Sparkles className="w-3 h-3 text-purple-400" />}
                <ChevronDown className={cn("w-3 h-3 transition-transform", isTopicMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isTopicMenuOpen && (
                  <motion.div
                    role="listbox"
                    aria-label="Select topic"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px] z-50"
                  >
                    {/* Auto option */}
                    <button
                      role="option"
                      aria-selected={selectedTopic === "auto"}
                      className={cn(
                        "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                        selectedTopic === "auto" 
                          ? "bg-white/10 text-white" 
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      )}
                      onClick={() => handleTopicSelect("auto")}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#8b5cf6" }}
                      />
                      <span>Auto</span>
                      <Sparkles className="w-3 h-3 text-purple-400 ml-auto" />
                    </button>

                    {/* Divider */}
                    <div className="h-px bg-white/10 mx-2" />

                    {/* Topics */}
                    {TOPIC_IDS.map((id) => (
                      <button
                        key={id}
                        role="option"
                        aria-selected={selectedTopic === id}
                        className={cn(
                          "w-full px-4 py-3 flex items-center gap-3 text-sm transition-all",
                          selectedTopic === id 
                            ? "bg-white/10 text-white" 
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        )}
                        onClick={() => handleTopicSelect(id)}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: TOPICS[id].color }}
                        />
                        <span>{TOPICS[id].name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Subconscious Button */}
            <button
              type="button"
              aria-label="Subconscious - Schedule reminder"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
              title="Schedule reminder"
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* Brainstorming Button */}
            <button
              type="button"
              aria-label="Brainstorming"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
              title="AI Brainstorming"
            >
              <Brain className="w-5 h-5" />
            </button>
          </div>

          {/* File Size Indicator - horizontal, same width as buttons */}
          <div
            data-testid="file-size-indicator"
            className="flex items-center gap-2 w-full"
          >
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 transition-all rounded-full"
                style={{ width: `${(totalFileSize / MAX_ATTACHMENTS_SIZE_BYTES) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-white/30 whitespace-nowrap">
              {(totalFileSize / (1024 * 1024)).toFixed(0)}/{(MAX_ATTACHMENTS_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB
            </span>
          </div>
        </div>
      </div>

      {/* Content Area - Auto-expanding */}
      <motion.div
        animate={{ 
          height: isExpanded ? "auto" : "80px",
          minHeight: isExpanded ? "120px" : "80px"
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <label htmlFor="task-content" className="sr-only">
          Content
        </label>
        <textarea
          ref={contentRef}
          id="task-content"
          aria-label="Content"
          value={content}
          onChange={handleContentChange}
          placeholder="Note"
          className={cn(
            "w-full bg-transparent border-none outline-none text-base text-white/80 placeholder:text-white/30 focus:placeholder:text-white/10 resize-none transition-all leading-relaxed",
            isExpanded ? "min-h-[100px]" : "h-[60px]"
          )}
          style={{ overflow: "hidden" }}
        />
      </motion.div>

      {/* Bottom Toolbar - Only visible when expanded (NO border/line) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between mt-4"
          >
            {/* Left Buttons */}
            <div className="flex items-center gap-2">
              {/* Content Dropdown */}
              <div className="relative" ref={contentMenuRef}>
                <button
                  type="button"
                  aria-label="Add content"
                  aria-haspopup="menu"
                  aria-expanded={isContentMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setUIState(prev => ({ ...prev, isContentMenuOpen: !prev.isContentMenuOpen }));
                  }}
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
                          onClick={() => {
                            setUIState(prev => ({ ...prev, isContentMenuOpen: false }));
                            // TODO: Implement content insertion
                          }}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Format Button */}
              <button
                type="button"
                aria-label="Format"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                title="Text format"
              >
                <Palette className="w-5 h-5" />
              </button>
            </div>

            {/* Center - Auto-save Indicator */}
            <div
              data-testid="auto-save-indicator"
              className={cn(
                "text-xs transition-opacity duration-300",
                isSaving ? "text-primary opacity-100" : "text-white/30 opacity-50"
              )}
            >
              {isSaving ? "Saving..." : "Auto-saved"}
            </div>

            {/* Right - Delete Button */}
            <button
              type="button"
              aria-label="Delete"
              onClick={handleDelete}
              className="p-2 rounded-lg bg-white/5 hover:bg-destructive/20 text-white/60 hover:text-destructive transition-all"
              title="Delete task"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
