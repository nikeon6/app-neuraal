"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Heading1,
  Heading2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { Editor } from "@tiptap/core";

// ============================================================================
// FormatMenu Component
// ============================================================================

export interface FormatMenuProps {
  readonly editor: Editor;
  readonly onClose: () => void;
  /** Ref to the trigger button so outside-click detection can exclude it. */
  readonly triggerRef?: RefObject<HTMLElement | null>;
}

/**
 * Text formatting popover — similar to Google Keep's format toolbar.
 * Provides heading level selection and inline mark toggles.
 * Works on selected text (toggle marks) or sets the format for new text.
 */
export function FormatMenu({ editor, onClose, triggerRef }: FormatMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside (excluding the trigger button so it can toggle closed)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        // If the click landed on the trigger button, let the trigger's onClick
        // handle it (toggle closed). Don't call onClose() here to avoid the
        // race condition where onClose sets false and then onClick toggles true.
        if (triggerRef?.current?.contains(target)) return;
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Re-render when editor state changes (marks toggled, heading changed, etc.)
  // Without this, isActive() checks are stale until the menu is reopened.
  const [, setTick] = useState(0);
  useEffect(() => {
    const onTransaction = () => setTick((n) => n + 1);
    editor.on("transaction", onTransaction);
    return () => { editor.off("transaction", onTransaction); };
  }, [editor]);

  // ---- Heading commands ----
  const setNormal = useCallback(() => {
    editor.chain().focus().setParagraph().run();
  }, [editor]);

  const setH1 = useCallback(() => {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  }, [editor]);

  const setH2 = useCallback(() => {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  // ---- Mark commands ----
  const toggleBold = useCallback(() => {
    editor.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleUnderline = useCallback(() => {
    editor.chain().focus().toggleUnderline().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor.chain().focus().toggleStrike().run();
  }, [editor]);

  // ---- Active state checks ----
  const isNormal =
    !editor.isActive("heading", { level: 1 }) &&
    !editor.isActive("heading", { level: 2 });
  const isH1 = editor.isActive("heading", { level: 1 });
  const isH2 = editor.isActive("heading", { level: 2 });
  const isBold = editor.isActive("bold");
  const isItalic = editor.isActive("italic");
  const isUnderline = editor.isActive("underline");
  const isStrike = editor.isActive("strike");

  return (
    <motion.div
      ref={menuRef}
      role="toolbar"
      aria-label="Text formatting"
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      // Prevent focus steal from editor when interacting with the menu itself
      onMouseDown={(e) => e.preventDefault()}
      className="absolute bottom-full left-0 mb-2 bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 p-1.5"
    >
      {/* Heading row */}
      <div className="flex items-center gap-0.5 px-1 pb-1.5 mb-1.5 border-b border-white/10">
        <FormatButton
          active={isNormal}
          onClick={setNormal}
          label="Normal text"
        >
          <Type className="w-4 h-4" />
          <span className="text-xs ml-1">Normal</span>
        </FormatButton>

        <FormatButton
          active={isH1}
          onClick={setH1}
          label="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </FormatButton>

        <FormatButton
          active={isH2}
          onClick={setH2}
          label="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </FormatButton>
      </div>

      {/* Marks row */}
      <div className="flex items-center gap-0.5 px-1">
        <FormatButton
          active={isBold}
          onClick={toggleBold}
          label="Bold"
        >
          <Bold className="w-4 h-4" />
        </FormatButton>

        <FormatButton
          active={isItalic}
          onClick={toggleItalic}
          label="Italic"
        >
          <Italic className="w-4 h-4" />
        </FormatButton>

        <FormatButton
          active={isUnderline}
          onClick={toggleUnderline}
          label="Underline"
        >
          <Underline className="w-4 h-4" />
        </FormatButton>

        <FormatButton
          active={isStrike}
          onClick={toggleStrike}
          label="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </FormatButton>
      </div>
    </motion.div>
  );
}

// ============================================================================
// FormatButton — individual toggle button
// ============================================================================

interface FormatButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly children: React.ReactNode;
}

function FormatButton({ active, onClick, label, children }: FormatButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      // Prevent mousedown from stealing focus from the Tiptap editor.
      // This keeps the text selection intact and allows mark toggles
      // to work even without an active selection (sets format for next typed text).
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-sm transition-all",
        active
          ? "bg-white/15 text-white"
          : "text-white/50 hover:text-white hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}
