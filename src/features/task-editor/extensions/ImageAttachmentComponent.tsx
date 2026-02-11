"use client";

import React, { useState, useCallback, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { X, ScanSearch, Eye, Loader2, Copy, Check, Brain } from "lucide-react";
import * as entriesSdk from "@/shared/api/sdk/entries";
import type { VisionMode } from "@/shared/api/sdk/entries";
import { visionQueue } from "@/shared/lib/visionQueue";

/**
 * React NodeView for ImageAttachment nodes.
 * Renders the image with overlay buttons: Scan text (OCR), Describe, and Delete.
 * Vision requests go through visionQueue to avoid overloading Ollama.
 * Results are shown in a "Neuraal Vision" panel below the image.
 */
export function ImageAttachmentComponent({
  node,
  deleteNode,
  selected,
  editor,
  getPos,
}: Readonly<NodeViewProps>) {
  const { src, alt, uploading, attachmentId, visionResult, visionMode: persistedVisionMode } = node.attrs;

  // Initialize vision state from persisted node attrs (restored after remount)
  const [visionState, setVisionState] = useState<
    "idle" | "queued" | "loading" | "done" | "error"
  >(visionResult ? "done" : "idle");
  const [visionText, setVisionText] = useState<string>(
    (visionResult as string) || ""
  );
  const [visionError, setVisionError] = useState<string>("");
  const [activeMode, setActiveMode] = useState<VisionMode | null>(
    (persistedVisionMode as VisionMode) || null
  );
  const [copied, setCopied] = useState(false);
  const [queueAhead, setQueueAhead] = useState(0);

  const hasAttachment = !!attachmentId && !uploading;

  // Sync local state when node attrs are updated externally (e.g. server sync)
  useEffect(() => {
    if (visionResult && visionState !== "done") {
      setVisionText(visionResult as string);
      setActiveMode((persistedVisionMode as VisionMode) || "scan");
      setVisionState("done");
    }
  }, [visionResult, persistedVisionMode, visionState]);

  // Subscribe to queue pending changes to update "queued" feedback
  useEffect(() => {
    const unsub = visionQueue.onPendingChange((pending) => {
      if (visionState === "queued") {
        // Our task is in the queue; others ahead = pending - 1 (ourselves)
        setQueueAhead(Math.max(0, pending - 1));
      }
    });
    return unsub;
  }, [visionState]);

  const handleVision = useCallback(
    async (e: React.MouseEvent, mode: VisionMode) => {
      e.preventDefault();
      e.stopPropagation();

      if (visionState === "loading" || visionState === "queued") return;

      const entryId = (editor.storage.image?.entryId ??
        editor.storage.imageAttachment?.entryId) as string | undefined;
      if (!entryId || !attachmentId) return;

      setActiveMode(mode);
      setVisionText("");
      setVisionError("");

      // Check if there are already tasks in the queue
      const pendingBefore = visionQueue.pending;
      if (pendingBefore > 0) {
        setVisionState("queued");
        setQueueAhead(pendingBefore);
      } else {
        setVisionState("loading");
      }

      try {
        const result = await visionQueue.enqueue(() => {
          // Transition from queued to loading when our turn comes
          setVisionState("loading");
          return entriesSdk.analyzeImage(
            entryId,
            attachmentId as string,
            mode
          );
        });
        setVisionText(result.extractedText);
        setVisionState("done");

        // Persist result to node attrs so it survives remount / autosave
        persistVisionToNode(editor, getPos, result.extractedText, mode);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Vision analysis failed";
        setVisionError(message);
        setVisionState("error");
      }
    },
    [visionState, editor, attachmentId]
  );

  const handleCopyText = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!visionText) return;

      try {
        await navigator.clipboard.writeText(visionText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = visionText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [visionText]
  );

  const isProcessing = visionState === "loading" || visionState === "queued";

  /** Loading overlay label */
  const getOverlayLabel = (): string => {
    if (visionState === "queued") {
      const ahead = queueAhead > 0 ? ` (${queueAhead} ahead)` : "";
      return `Queued${ahead}...`;
    }
    if (activeMode === "describe") return "Describing image (may take up to 1 min)...";
    return "Extracting text (may take up to 1 min)...";
  };

  /** CSS class for the Scan button based on current state */
  const getScanButtonClass = (): string => {
    if (isProcessing && activeMode === "scan") {
      return "bg-sky-500/40 text-sky-200 cursor-wait";
    }
    if (visionState === "done" && activeMode === "scan") {
      return "bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/40";
    }
    return "bg-sky-500/30 text-sky-200 hover:bg-sky-500/50 hover:text-white";
  };

  /** CSS class for the Describe button based on current state */
  const getDescribeButtonClass = (): string => {
    if (isProcessing && activeMode === "describe") {
      return "bg-violet-500/40 text-violet-200 cursor-wait";
    }
    if (visionState === "done" && activeMode === "describe") {
      return "bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/40";
    }
    return "bg-violet-500/30 text-violet-200 hover:bg-violet-500/50 hover:text-white";
  };

  return (
    <NodeViewWrapper
      className="image-attachment-wrapper"
      onDragStart={(e: React.DragEvent) => {
        // Prevent native/ProseMirror drag interactions from image node views while
        // the parent Task card is being reordered with Framer Motion.
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className={`relative inline-block max-w-full ${selected ? "ring-2 ring-primary/50 rounded-lg" : ""}`}
      >
        {/* The image */}
        <img
          src={src as string}
          alt={(alt as string) || ""}
          className={`max-w-full h-auto rounded-lg ${uploading ? "opacity-50" : ""}`}
          draggable={false}
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />

        {/* Upload overlay */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
            <span className="text-white/80 text-sm font-medium">
              Uploading...
            </span>
          </div>
        )}

        {/* Vision processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
              <span className="text-white/90 text-sm font-medium text-center px-4">
                {getOverlayLabel()}
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Action buttons below image (avoid overlay interactions while dragging cards) */}
      {!uploading && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {hasAttachment && (
            <>
              {/* Scan text (OCR) button */}
              <button
                type="button"
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md backdrop-blur-sm text-xs font-medium transition-all ${getScanButtonClass()}`}
                title="Extract text from image (OCR)"
                disabled={isProcessing}
                onMouseDown={(e) => handleVision(e, "scan")}
              >
                {isProcessing && activeMode === "scan" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ScanSearch className="w-3.5 h-3.5" />
                )}
                <span>Scan</span>
              </button>

              {/* Describe button */}
              <button
                type="button"
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md backdrop-blur-sm text-xs font-medium transition-all ${getDescribeButtonClass()}`}
                title="Describe image with AI"
                disabled={isProcessing}
                onMouseDown={(e) => handleVision(e, "describe")}
              >
                {isProcessing && activeMode === "describe" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>Describe</span>
              </button>
            </>
          )}

          {/* Delete button */}
          <button
            type="button"
            className="p-1.5 rounded-md bg-black/50 backdrop-blur-sm text-white/70 hover:text-red-400 hover:bg-black/70 transition-all"
            title="Remove image"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode();
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Neuraal Vision Result panel */}
      {visionState === "done" && visionText && (
        <div className="mt-2 rounded-lg bg-sky-500/[0.07] border border-sky-500/15 p-3 max-w-full">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wide">
                Neuraal Vision
              </span>
              <span className="text-[10px] text-white/30 font-medium">
                {activeMode === "describe" ? "description" : "text scan"}
              </span>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              title="Copy text"
              onMouseDown={handleCopyText}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap break-words font-mono max-h-48 overflow-y-auto custom-scrollbar">
            {visionText}
          </pre>
        </div>
      )}

      {/* Error panel */}
      {visionState === "error" && visionError && (
        <div className="mt-2 rounded-lg bg-red-500/[0.07] border border-red-500/15 p-3 max-w-full">
          <div className="flex items-center gap-1.5 mb-1">
            <Brain className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wide">
              Neuraal Vision — Failed
            </span>
          </div>
          <p className="text-xs text-red-300/70 leading-relaxed">
            {visionError}
          </p>
          {activeMode && (
            <button
              type="button"
              className="mt-2 text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors"
              onMouseDown={(e) => handleVision(e, activeMode)}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Persist the vision result into the ProseMirror node attributes so it is
 * included in the Tiptap JSON. The normal editor `onUpdate` callback will
 * fire, which triggers the autosave — no extra save needed.
 */
function persistVisionToNode(
  editor: NodeViewProps["editor"],
  getPos: NodeViewProps["getPos"],
  text: string,
  mode: VisionMode
): void {
  if (!editor || editor.isDestroyed) return;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return;

  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== "image") return;

  const { tr } = editor.state;
  tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    visionResult: text,
    visionMode: mode,
  });
  editor.view.dispatch(tr);
}
