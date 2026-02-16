"use client";

import React, { useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { FileIcon, Download, Trash2 } from "lucide-react";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";

/**
 * Format bytes to human-readable string.
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
 * React NodeView for FileAttachment nodes.
 * Renders an interactive block with file info, download, and delete buttons.
 */
export function FileAttachmentComponent({
  node,
  deleteNode,
  selected,
}: Readonly<NodeViewProps>) {
  const { attachmentId, filename, mimeType, sizeBytes } = node.attrs;

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!attachmentId) return;
      attachmentsSdk
        .getDownloadUrl(attachmentId as string)
        .then(({ presignedGetUrl }) => {
          globalThis.open(presignedGetUrl, "_blank", "noopener");
        })
        .catch((error) => {
          console.error("[FileAttachment] Download failed:", error);
        });
    },
    [attachmentId],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      deleteNode();
    },
    [deleteNode],
  );

  return (
    <NodeViewWrapper>
      <div
        className={`file-attachment-node ${selected ? "ring-1 ring-primary/50" : ""}`}
        contentEditable={false}
      >
        <FileIcon className="file-icon" />
        <div className="file-info">
          <div className="file-name">{filename as string}</div>
          <div className="file-size">
            {formatBytes(sizeBytes as number)} · {mimeType as string}
          </div>
        </div>
        <button
          type="button"
          className="file-download"
          title={`Download ${filename as string}`}
          onMouseDown={handleDownload}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="file-download"
          title="Remove attachment"
          onMouseDown={handleDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
