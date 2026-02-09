"use client";

import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Languages, X } from "lucide-react";

/**
 * Converts a YouTube watch/short URL to an embed URL.
 * Handles youtube.com/watch?v=, youtu.be/, youtube.com/embed/, etc.
 */
function toEmbedUrl(url: string): string {
  if (!url) return "";

  // Already an embed URL
  if (url.includes("/embed/")) return url;

  let videoId: string | null = null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1);
    } else if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtube-nocookie.com")
    ) {
      videoId = parsed.searchParams.get("v");

      if (!videoId && parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1];
      }
    }
  } catch {
    return url;
  }

  if (videoId) {
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }

  return url;
}

/**
 * React NodeView for YouTube embed nodes.
 * Renders the YouTube iframe with Transcribe and Delete buttons.
 */
export function YoutubeEmbedComponent({
  node,
  selected,
  deleteNode,
}: Readonly<NodeViewProps>) {
  const { src, width, height } = node.attrs;

  const embedUrl = toEmbedUrl(src as string);

  return (
    <NodeViewWrapper>
      <div
        className={`youtube-embed-wrapper ${selected ? "ring-2 ring-primary/50 rounded-lg" : ""}`}
        data-youtube-video=""
      >
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={embedUrl}
            title="YouTube video"
            width={(width as number) || 640}
            height={(height as number) || 360}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="w-full h-full rounded-lg"
            style={{ border: "none" }}
          />
        </div>

        {/* Action bar below the video */}
        <div className="flex justify-between items-center mt-1.5 mb-1">
          {/* Transcribe button — disabled, coming soon */}
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-white/5 text-white/40 cursor-not-allowed"
            title="Transcribe with AI (coming soon)"
            disabled
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Transcribe</span>
          </button>

          {/* Delete button */}
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Remove video"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode();
            }}
          >
            <X className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
