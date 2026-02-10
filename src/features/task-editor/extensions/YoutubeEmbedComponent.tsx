"use client";

import React, { useState, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  FileText,
  X,
  Loader2,
  Copy,
  Check,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Markdown from "react-markdown";
import { useQueryClient } from "@tanstack/react-query";
import { requestTranscriptionAndInvalidate } from "@/shared/api/mutations";

/**
 * Converts a YouTube watch/short URL to an embed URL.
 */
function toEmbedUrl(url: string): string {
  if (!url) return "";
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
 * Shows the transcription result below the video when available.
 */
export function YoutubeEmbedComponent({
  node,
  selected,
  deleteNode,
  editor,
}: Readonly<NodeViewProps>) {
  const { src, width, height, transcription } = node.attrs;
  const queryClient = useQueryClient();

  const embedUrl = toEmbedUrl(src as string);

  // Transcription state
  const [transcribeState, setTranscribeState] = useState<
    "idle" | "loading" | "done" | "error"
  >(transcription ? "done" : "idle");
  const [transcribeError, setTranscribeError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleTranscribe = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (transcribeState === "loading") return;

      const entryId = editor.storage.youtube?.entryId as string | undefined;
      if (!entryId || !src) return;

      setTranscribeState("loading");
      setTranscribeError("");

      try {
        await requestTranscriptionAndInvalidate(
          queryClient,
          entryId,
          src as string
        );
        setTranscribeState("done");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Transcription request failed";
        setTranscribeError(message);
        setTranscribeState("error");
      }
    },
    [transcribeState, editor, src, queryClient]
  );

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = transcription as string;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [transcription]
  );

  const hasTranscription = !!transcription;

  const getTranscribeLabel = (): string => {
    if (hasTranscription) return "Transcribed";
    if (transcribeState === "loading") return "Transcribing...";
    return "Transcribe";
  };

  const getTranscribeTitle = (): string => {
    if (hasTranscription) return "Transcription available";
    if (transcribeState === "loading") return "Transcription in progress...";
    return "Transcribe video with AI";
  };

  const getTranscribeButtonClass = (): string => {
    if (transcribeState === "loading") {
      return "bg-sky-500/20 text-sky-300 cursor-wait";
    }
    if (hasTranscription) {
      return "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30";
    }
    return "bg-white/5 text-white/60 hover:text-sky-300 hover:bg-sky-500/10";
  };

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

          {/* Loading overlay */}
          {transcribeState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
                <span className="text-white/90 text-sm font-medium text-center px-4">
                  Requesting transcription...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action bar below the video */}
        <div className="flex justify-between items-center mt-1.5 mb-1">
          {/* Transcribe button */}
          <button
            type="button"
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all ${getTranscribeButtonClass()}`}
            title={getTranscribeTitle()}
            disabled={transcribeState === "loading"}
            onMouseDown={handleTranscribe}
          >
            {transcribeState === "loading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span>{getTranscribeLabel()}</span>
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

        {/* Transcription submitted (async — waiting for result) */}
        {transcribeState === "done" && !hasTranscription && (
          <div className="mt-1 rounded-lg bg-sky-500/[0.07] border border-sky-500/15 p-3">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wide">
                Transcription Requested
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              The transcription is being processed. You&apos;ll receive a
              notification when it&apos;s ready.
            </p>
          </div>
        )}

        {/* Transcription result panel */}
        {hasTranscription && (
          <div className="mt-1 rounded-lg bg-sky-500/[0.07] border border-sky-500/15 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wide">
                  Neuraal Transcription
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
                  title="Copy transcription"
                  onMouseDown={handleCopy}
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
                <button
                  type="button"
                  className="p-0.5 rounded text-white/40 hover:text-white/70 transition-colors"
                  title={expanded ? "Collapse" : "Expand"}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                >
                  {expanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div
              className={`summary-markdown text-xs text-white/70 leading-relaxed overflow-y-auto custom-scrollbar ${
                expanded ? "max-h-[500px]" : "max-h-40"
              }`}
            >
              <Markdown>{transcription as string}</Markdown>
            </div>
          </div>
        )}

        {/* Error panel */}
        {transcribeState === "error" && transcribeError && (
          <div className="mt-1 rounded-lg bg-red-500/[0.07] border border-red-500/15 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wide">
                Transcription Failed
              </span>
            </div>
            <p className="text-xs text-red-300/70 leading-relaxed">
              {transcribeError}
            </p>
            <button
              type="button"
              className="mt-2 text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors"
              onMouseDown={handleTranscribe}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
