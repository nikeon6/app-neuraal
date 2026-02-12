"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiTopic } from "@/shared/api/sdk";
import { createTopicAndInvalidate } from "@/shared/api/mutations";
import { cn } from "@/shared/lib/utils";

// Maximum characters allowed for topic name
const MAX_TOPIC_NAME_LENGTH = 18;

// ============================================================================
// Color Options for Topic Creation
// ============================================================================
const COLOR_OPTIONS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#d946ef", // fuchsia
  "#e11d48", // rose
  "#0891b2", // dark cyan
  "#a855f7", // purple
  "#ea580c", // burnt orange
] as const;

// ============================================================================
// CreateTopicDialog Component
// ============================================================================

export interface CreateTopicDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly existingTopics: ApiTopic[];
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function CreateTopicDialog({
  isOpen,
  onClose,
  existingTopics,
  triggerRef,
}: CreateTopicDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Validation
  const trimmedName = name.trim();
  const isNameEmpty = trimmedName.length === 0;
  const isTooLong = trimmedName.length > MAX_TOPIC_NAME_LENGTH;
  const isColorSelected = color !== null;
  const isDuplicate = useMemo(() => {
    const normalizedInput = trimmedName.toLowerCase();
    return existingTopics.some(
      (t) => t.name.trim().toLowerCase() === normalizedInput
    );
  }, [trimmedName, existingTopics]);

  // Colors already used by existing topics
  const usedColors = useMemo(() => {
    const colors = new Set<string>();
    for (const t of existingTopics) {
      colors.add(t.color.toLowerCase());
    }
    return colors;
  }, [existingTopics]);

  const isColorUsed = color !== null && usedColors.has(color.toLowerCase());
  const isValid = !isNameEmpty && !isDuplicate && !isTooLong && isColorSelected && !isColorUsed && !isSubmitting;
  const charsRemaining = MAX_TOPIC_NAME_LENGTH - name.length;

  const closeAndReturnFocus = useCallback(() => {
    onClose();
    // Return focus to trigger after a short delay for DOM update
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  }, [onClose, triggerRef]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || !color) return;

      setIsSubmitting(true);
      try {
        await createTopicAndInvalidate(queryClient, { name: trimmedName, color });
        // Reset form and close
        setName("");
        setColor(null);
        closeAndReturnFocus();
      } catch (error) {
        console.error("[CreateTopicDialog] Failed to create topic:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isValid, queryClient, trimmedName, color, closeAndReturnFocus]
  );

  const handleCancel = useCallback(() => {
    setName("");
    setColor(null);
    closeAndReturnFocus();
  }, [closeAndReturnFocus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleCancel]
  );

  if (!isOpen) return null;

  // Use portal to render at document.body level, avoiding stacking context issues
  const dialogContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        data-testid="dialog-backdrop"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-topic-title"
        className="relative z-10 w-full max-w-md mx-4 bg-slate-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl"
      >
        <h2
          id="create-topic-title"
          className="text-xl font-semibold text-white mb-4"
        >
          Create Topic
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="topic-name"
                className="block text-sm font-medium text-white/70"
              >
                Topic name
              </label>
              <span
                className={cn(
                  "text-xs",
                  charsRemaining < 0
                    ? "text-red-400"
                    : charsRemaining <= 5
                      ? "text-amber-400"
                      : "text-white/40"
                )}
              >
                {name.length}/{MAX_TOPIC_NAME_LENGTH}
              </span>
            </div>
            <input
              ref={inputRef}
              id="topic-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_TOPIC_NAME_LENGTH}
              placeholder="Enter topic name..."
              className={cn(
                "w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-white/30",
                "focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all",
                isDuplicate || isTooLong
                  ? "border-red-500/50"
                  : "border-white/10 focus:border-sky-500/50"
              )}
            />
            {isDuplicate && (
              <p className="text-sm text-red-400">
                Topic already exists
              </p>
            )}
          </div>

          {/* Color selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              Color
            </label>
            <div
              data-testid="color-selector"
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Select color"
            >
              {COLOR_OPTIONS.map((c) => {
                const isUsed = usedColors.has(c.toLowerCase());
                return (
                  <button
                    key={c}
                    type="button"
                    data-testid={`color-option-${c}`}
                    role="radio"
                    aria-checked={color === c}
                    aria-disabled={isUsed}
                    aria-label={isUsed ? `Color ${c} (already in use)` : `Select color ${c}`}
                    onClick={() => { if (!isUsed) setColor(c); }}
                    className={cn(
                      "relative w-8 h-8 rounded-full transition-all",
                      "ring-offset-2 ring-offset-slate-900",
                      isUsed
                        ? "opacity-25 cursor-not-allowed"
                        : color === c
                          ? "ring-2 ring-white scale-110"
                          : "hover:scale-105 opacity-70 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {isUsed && (
                      <span className="absolute inset-0 flex items-center justify-center text-white/80 text-xs font-bold">
                        ✕
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 font-medium hover:bg-white/10 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl font-medium transition-all",
                isValid
                  ? "bg-sky-500 text-white hover:bg-sky-400"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              )}
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render via portal to escape stacking context
  if (typeof document === "undefined") return null;
  return createPortal(dialogContent, document.body);
}
