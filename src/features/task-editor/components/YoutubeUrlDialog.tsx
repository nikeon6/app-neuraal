"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CirclePlay } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// ============================================================================
// YoutubeUrlDialog Component
// ============================================================================

export interface YoutubeUrlDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (url: string) => void;
}

/** Regex to loosely validate YouTube URLs. */
const YOUTUBE_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch|embed|shorts)|youtu\.be\/)/i;

export function YoutubeUrlDialog({
  isOpen,
  onClose,
  onSubmit,
}: YoutubeUrlDialogProps) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setUrl("");
      // Small delay so the portal is mounted before focusing
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  const trimmedUrl = url.trim();
  const isValidUrl = YOUTUBE_REGEX.test(trimmedUrl);
  const showError = trimmedUrl.length > 0 && !isValidUrl;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValidUrl) return;
      onSubmit(trimmedUrl);
      setUrl("");
      onClose();
    },
    [isValidUrl, trimmedUrl, onSubmit, onClose],
  );

  const handleCancel = useCallback(() => {
    setUrl("");
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleCancel],
  );

  if (!isOpen) return null;

  const dialogContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-url-title"
        className="relative z-10 w-full max-w-md mx-4 bg-slate-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl"
      >
        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20">
            <CirclePlay className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2
              id="youtube-url-title"
              className="text-lg font-semibold text-white"
            >
              Embed YouTube video
            </h2>
            <p className="text-xs text-white/40">Paste the video URL below</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL input */}
          <div className="space-y-2">
            <label
              htmlFor="youtube-url"
              className="block text-sm font-medium text-white/70"
            >
              YouTube URL
            </label>
            <input
              ref={inputRef}
              id="youtube-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={cn(
                "w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-white/30",
                "focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all",
                showError
                  ? "border-red-500/50"
                  : "border-white/10 focus:border-red-500/40",
              )}
            />
            {showError && (
              <p className="text-sm text-red-400">Enter a valid YouTube URL</p>
            )}
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
              disabled={!isValidUrl}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl font-medium transition-all",
                isValidUrl
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "bg-white/5 text-white/30 cursor-not-allowed",
              )}
            >
              Embed
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialogContent, document.body);
}
