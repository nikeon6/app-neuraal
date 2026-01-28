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
} from "lucide-react";
import { useStore } from "@/shared/store";
import { TOPICS, TOPIC_IDS } from "@/shared/constants";
import { type TopicId, type DefaultTopicId } from "@/shared/types";
import { cn, getDefaultTopic } from "@/shared/lib";

interface TaskEditorProps {
  taskId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialTopic?: TopicId | "auto";
  onClose?: () => void;
}

export function TaskEditor({
  taskId,
  initialTitle = "",
  initialContent = "",
  initialTopic = "auto",
  onClose,
}: TaskEditorProps) {
  const { selectedDay, addTask, removeTask } = useStore();

  // Form state
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [selectedTopic, setSelectedTopic] = useState<TopicId | "auto">(initialTopic);

  // UI state
  const [isContentMenuOpen, setIsContentMenuOpen] = useState(false);
  const [isTopicMenuOpen, setIsTopicMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totalFileSize, setTotalFileSize] = useState(0);

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const contentMenuRef = useRef<HTMLDivElement>(null);
  const topicMenuRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Max file size: 20MB in bytes
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      // Simulate save delay
      setTimeout(() => {
        setIsSaving(false);
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
  const handleTopicSelect = (topic: TopicId | "auto") => {
    setSelectedTopic(topic);
    setIsTopicMenuOpen(false);
    triggerAutoSave();
  };

  // Handle delete
  const handleDelete = () => {
    if (taskId) {
      removeTask(selectedDay, taskId);
    }
    onClose?.();
  };

  // Handle click inside editor - expand
  const handleEditorClick = () => {
    setIsExpanded(true);
  };

  // Handle click outside editor - collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editorRef.current &&
        !editorRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
        setIsContentMenuOpen(false);
        setIsTopicMenuOpen(false);
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
  const contentMenuItems = [
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
      className="task-editor glass-panel rounded-2xl p-5 w-full max-w-[55%] min-w-[320px]"
    >
      {/* Top Row: Title + Topic Selector + Action Buttons */}
      <div className="flex items-center justify-between gap-4 mb-2">
        {/* Title Input - Left side */}
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
            placeholder="Title"
            className="w-full bg-transparent border-none outline-none text-2xl font-semibold text-white/90 placeholder:text-white/30 focus:placeholder:text-white/10 transition-all"
          />
        </div>

        {/* Right side: Buttons + File size */}
        <div className="flex flex-col items-end gap-2">
          {/* Buttons Row */}
          <div className="flex items-center gap-2">
            {/* Topic Selector Dropdown */}
            <div className="relative" ref={topicMenuRef}>
              <button
                type="button"
                aria-label="Topic"
                aria-haspopup="listbox"
                aria-expanded={isTopicMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTopicMenuOpen(!isTopicMenuOpen);
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
                style={{ width: `${(totalFileSize / MAX_FILE_SIZE) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-white/30 whitespace-nowrap">
              {(totalFileSize / (1024 * 1024)).toFixed(0)}/20MB
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
                    setIsContentMenuOpen(!isContentMenuOpen);
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
                            setIsContentMenuOpen(false);
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
