"use client";

import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { X, ScanSearch } from "lucide-react";

/**
 * React NodeView for ImageAttachment nodes.
 * Renders the image with overlay buttons: delete (X) and OCR analyze.
 */
export function ImageAttachmentComponent({
  node,
  deleteNode,
  selected,
}: Readonly<NodeViewProps>) {
  const { src, alt, uploading } = node.attrs;

  return (
    <NodeViewWrapper className="image-attachment-wrapper">
      <div className={`relative group inline-block max-w-full ${selected ? "ring-2 ring-primary/50 rounded-lg" : ""}`}>
        {/* The image */}
        <img
          src={src as string}
          alt={(alt as string) || ""}
          className={`max-w-full h-auto rounded-lg ${uploading ? "opacity-50" : ""}`}
          draggable={false}
        />

        {/* Upload overlay */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
            <span className="text-white/80 text-sm font-medium">Uploading...</span>
          </div>
        )}

        {/* Action buttons — visible on hover, use onMouseDown to bypass ProseMirror */}
        {!uploading && (
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* OCR / Analyze button (disabled — coming soon) */}
            <button
              type="button"
              className="p-1.5 rounded-md bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all cursor-not-allowed opacity-60"
              title="Analyze with AI (coming soon)"
              disabled
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <ScanSearch className="w-4 h-4" />
            </button>

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
      </div>
    </NodeViewWrapper>
  );
}
