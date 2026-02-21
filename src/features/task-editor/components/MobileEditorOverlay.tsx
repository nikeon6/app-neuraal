"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { TaskEditor } from "./TaskEditor";
import type { ApiEntry } from "@/shared/api/sdk";

interface MobileEditorOverlayProps {
  entry: ApiEntry | null;
  onClose: () => void;
}

export function MobileEditorOverlay({
  entry,
  onClose,
}: Readonly<MobileEditorOverlayProps>) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Lock body + html scroll while overlay is open
  useEffect(() => {
    if (!entry) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [entry]);

  // Scroll the editor area to top and auto-focus the content editor
  useEffect(() => {
    if (!entry) return;
    requestAnimationFrame(() => {
      const el = scrollAreaRef.current;
      if (el && typeof el.scrollTo === "function") {
        el.scrollTo(0, 0);
      }

      // Focus the TiptapEditor's contenteditable at the start of the content.
      // Small delay lets the overlay animation settle so the focus doesn't
      // fight with Framer Motion's initial render.
      setTimeout(() => {
        const editable = el?.querySelector<HTMLElement>(
          "[contenteditable='true']",
        );
        if (editable) {
          editable.focus({ preventScroll: true });
          // Place caret at the very beginning
          const sel = window.getSelection();
          if (sel && editable.firstChild) {
            sel.collapse(editable.firstChild, 0);
          } else if (sel) {
            sel.collapse(editable, 0);
          }
        }
      }, 350);
    });
  }, [entry]);

  // Prevent the browser from scrolling the editor area when focus moves
  // between child elements (title input → contenteditable on Enter).
  //
  // The browser's native scroll-into-view fires DURING the focus() call,
  // BEFORE focusin dispatches. So locking in focusin is too late. Instead
  // we lock overflowY on the CAPTURE phase of keydown (Enter/Tab) which
  // runs before React's bubble-phase handler calls editor.commands.focus().
  // With overflowY:hidden the container is not a "scroll container" per
  // CSS spec, so the browser skips it entirely during scroll-into-view.
  useEffect(() => {
    if (!entry) return;
    const scrollEl = scrollAreaRef.current;
    if (!scrollEl) return;

    let stableTop = scrollEl.scrollTop;
    let locked = false;
    let unlockTimer: ReturnType<typeof setTimeout> | null = null;

    const unlock = (target: number) => {
      if (unlockTimer) clearTimeout(unlockTimer);
      unlockTimer = setTimeout(() => {
        scrollEl.scrollTop = target;
        scrollEl.style.overflowY = "";
        locked = false;
        stableTop = target;
        unlockTimer = null;
      }, 200);
    };

    const trackScroll = () => {
      if (!locked) stableTop = scrollEl.scrollTop;
    };

    // Capture-phase keydown: fires BEFORE React's handler, so we lock
    // BEFORE editor.commands.focus() is called.
    const onKeydownCapture = (e: Event) => {
      if (!locked) stableTop = scrollEl.scrollTop;
      if (
        e instanceof KeyboardEvent &&
        (e.key === "Enter" || e.key === "Tab")
      ) {
        const target = stableTop;
        locked = true;
        scrollEl.style.overflowY = "hidden";
        scrollEl.scrollTop = target;
        unlock(target);
      }
    };

    const onPointerdownCapture = () => {
      if (!locked) stableTop = scrollEl.scrollTop;
    };

    // Fallback for focus changes not triggered by keyboard (e.g. taps)
    const onFocusIn = () => {
      if (locked) return;
      const target = stableTop;
      locked = true;
      scrollEl.style.overflowY = "hidden";
      scrollEl.scrollTop = target;
      unlock(target);
    };

    scrollEl.addEventListener("scroll", trackScroll, { passive: true });
    scrollEl.addEventListener("keydown", onKeydownCapture, true);
    scrollEl.addEventListener("pointerdown", onPointerdownCapture, true);
    scrollEl.addEventListener("focusin", onFocusIn);
    return () => {
      if (unlockTimer) clearTimeout(unlockTimer);
      scrollEl.removeEventListener("scroll", trackScroll);
      scrollEl.removeEventListener("keydown", onKeydownCapture, true);
      scrollEl.removeEventListener("pointerdown", onPointerdownCapture, true);
      scrollEl.removeEventListener("focusin", onFocusIn);
    };
  }, [entry]);

  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!entry) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [entry, onClose]);

  return createPortal(
    <AnimatePresence>
      {entry && (
        <motion.div
          ref={overlayRef}
          key="mobile-editor-overlay"
          data-testid="mobile-editor-overlay"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
            <button
              type="button"
              aria-label="Go back"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-white/50">
              Edit entry
            </span>
          </div>

          {/* Scrollable editor area — no JS height tracking; the browser
              handles keyboard viewport natively for position:fixed elements */}
          <div
            ref={scrollAreaRef}
            className="flex-1 overflow-y-auto overscroll-none p-4 min-h-0"
          >
            <TaskEditor entry={entry} onClose={onClose} forceExpanded />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
