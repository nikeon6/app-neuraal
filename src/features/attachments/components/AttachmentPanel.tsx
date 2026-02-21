"use client";

import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paperclip,
  Download,
  Trash2,
  FileIcon,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEntryAttachmentsQuery } from "@/shared/api/queries";
import { deleteAttachmentAndInvalidate } from "@/shared/api/mutations";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";
import { cn } from "@/shared/lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttachmentPanelProps {
  /** Entry ID to list attachments for. */
  readonly entryId: string;
  /** Date key for potential cache invalidation. */
  readonly dateKey: string;
  /** Called after an attachment is deleted from the panel, so the editor can remove the node. */
  readonly onAttachmentDeleted?: (attachmentId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats bytes into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Returns an icon-friendly short MIME label.
 */
function mimeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "Sheet";
  if (mimeType.includes("document") || mimeType.includes("word")) return "Doc";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "Zip";
  return "File";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AttachmentPanel — collapsible read-only list of attachments for an entry.
 *
 * Shows existing attachments with download/delete functionality and quota info.
 * Collapsed by default, shows only "Attachments (N)" and a toggle button.
 */
export function AttachmentPanel({
  entryId,
  dateKey: _dateKey,
  onAttachmentDeleted,
}: AttachmentPanelProps) {
  const queryClient = useQueryClient();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch attachments + usage
  const { data, isLoading } = useEntryAttachmentsQuery(entryId);
  const attachments = data?.attachments ?? [];
  const usage = data?.usage;

  // -----------------------------------------------------------------------
  // Download
  // -----------------------------------------------------------------------

  const handleDownload = useCallback(async (attachmentId: string) => {
    try {
      const { presignedGetUrl } =
        await attachmentsSdk.getDownloadUrl(attachmentId);
      globalThis.open(presignedGetUrl, "_blank", "noopener");
    } catch {
      // Silently fail — could add toast in the future
    }
  }, []);

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      setDeletingIds((prev) => new Set(prev).add(attachmentId));
      try {
        await deleteAttachmentAndInvalidate(queryClient, attachmentId, entryId);
        // Notify parent so the corresponding editor node can be removed
        onAttachmentDeleted?.(attachmentId);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(attachmentId);
          return next;
        });
      }
    },
    [queryClient, entryId, onAttachmentDeleted],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  // Don't render anything while loading or when there are no attachments.
  // This prevents a brief flash of the panel header on entries with no attachments.
  if (isLoading || attachments.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {/* Collapsible header — always visible */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded((prev) => !prev);
        }}
        className="flex items-center gap-2 text-white/50 text-xs hover:text-white/70 transition-colors w-full group"
        aria-expanded={isExpanded}
      >
        <Paperclip className="w-3.5 h-3.5" />
        <span>Attachments</span>
        {attachments.length > 0 && (
          <span className="text-white/30">({attachments.length})</span>
        )}
        <ChevronDown
          className={cn(
            "w-3 h-3 ml-auto transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Quota usage */}
            {usage && (
              <div className="flex gap-4 mt-2 mb-2 text-[10px] text-white/30">
                <span>
                  Entry: {formatBytes(usage.entryBytesUsed)} /{" "}
                  {formatBytes(usage.entryLimitBytes)}
                </span>
                <span>
                  Account: {formatBytes(usage.userBytesUsed)} /{" "}
                  {formatBytes(usage.userLimitBytes)}
                </span>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center gap-2 text-white/30 text-xs py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading attachments...</span>
              </div>
            )}

            {/* Attachment list */}
            {attachments.length > 0 && (
              <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1 mt-2">
                <AnimatePresence initial={false}>
                  {attachments.map((att) => {
                    const isDeleting = deletingIds.has(att.id);
                    return (
                      <motion.div
                        key={att.id}
                        layout
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 group",
                          isDeleting && "opacity-50",
                        )}
                      >
                        <FileIcon className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 truncate">
                            {att.filename}
                          </p>
                          <p className="text-[10px] text-white/30">
                            {formatBytes(att.sizeBytes)} ·{" "}
                            {mimeLabel(att.mimeType)}
                            {att.status === "pending" && (
                              <span className="ml-1 text-yellow-400/70">
                                (processing)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            aria-label={`Download ${att.filename}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(att.id);
                            }}
                            disabled={att.status !== "ready" || isDeleting}
                            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-30 transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${att.filename}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(att.id);
                            }}
                            disabled={isDeleting}
                            className="p-1 rounded hover:bg-destructive/20 text-white/40 hover:text-destructive disabled:opacity-30 transition-all"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
