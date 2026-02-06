"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// ============================================================================
// ConfirmDialog - Reusable confirmation dialog component
// ============================================================================

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Optional title for the dialog header */
  title?: string;
  /** Message content (can include React nodes for formatting) */
  message: React.ReactNode;
  /** Text for the confirm button (default: "Confirm") */
  confirmText?: string;
  /** Text for the cancel button (default: "Cancel") */
  cancelText?: string;
  /** Callback when confirm is clicked */
  onConfirm: () => void;
  /** Callback when cancel is clicked or dialog is dismissed */
  onCancel: () => void;
  /** Whether clicking the backdrop closes the dialog (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether this is a destructive action - affects button styling (default: true) */
  destructive?: boolean;
  /** Whether the dialog is in a loading state (default: false) */
  loading?: boolean;
  /** Whether the confirm button is disabled (default: false) */
  disableConfirm?: boolean;
  /** Which button to focus initially (default: "cancel" for better UX on destructive actions) */
  initialFocus?: "confirm" | "cancel";
  /** Accessible label if no title is provided */
  ariaLabel?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  closeOnBackdrop = true,
  destructive = true,
  loading = false,
  disableConfirm = false,
  initialFocus = "cancel",
  ariaLabel,
}: Readonly<ConfirmDialogProps>) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management - focus the appropriate button when dialog opens
  useEffect(() => {
    if (open) {
      const targetRef = initialFocus === "confirm" ? confirmButtonRef : cancelButtonRef;
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        targetRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, initialFocus]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    },
    [onCancel, loading]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop && !loading) {
      onCancel();
    }
  }, [closeOnBackdrop, loading, onCancel]);

  // Handle confirm click
  const handleConfirm = useCallback(() => {
    if (!loading && !disableConfirm) {
      onConfirm();
    }
  }, [loading, disableConfirm, onConfirm]);

  // Don't render if not open
  if (!open) return null;

  // Generate unique IDs for accessibility
  const titleId = title ? "confirm-dialog-title" : undefined;
  const descId = "confirm-dialog-desc";

  const dialogContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        data-testid="dialog-backdrop"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-label={!title ? (ariaLabel ?? "Confirm action") : undefined}
        className="relative z-10 w-full max-w-sm mx-4 bg-slate-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl"
      >
        {/* Title (optional) */}
        {title && (
          <h2
            id={titleId}
            className="text-lg font-semibold text-white mb-2"
          >
            {title}
          </h2>
        )}

        {/* Message */}
        <div id={descId} className="text-white/60 mb-6">
          {message}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl font-medium transition-all",
              "bg-white/5 border border-white/10 text-white/70",
              loading
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-white/10 hover:text-white"
            )}
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            disabled={loading || disableConfirm}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl font-medium transition-all inline-flex items-center justify-center gap-2",
              loading || disableConfirm
                ? "opacity-50 cursor-not-allowed"
                : "",
              destructive
                ? "bg-red-500/80 text-white hover:bg-red-500"
                : "bg-sky-500/80 text-white hover:bg-sky-500"
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  // Render via portal to escape stacking context issues
  if (typeof document === "undefined") return null;
  return createPortal(dialogContent, document.body);
}
