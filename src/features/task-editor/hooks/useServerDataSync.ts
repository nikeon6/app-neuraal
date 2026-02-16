import { useEffect, type RefObject } from "react";
import type { TiptapEditorHandle } from "../components/TiptapEditor";

/**
 * Recursively traverse a Tiptap/ProseMirror JSON doc and collect
 * `src → transcription` pairs from YouTube nodes that have a transcription.
 */
function collectYoutubeTranscriptions(
  node: Record<string, unknown>,
  map: Map<string, string>,
): void {
  if (node.type === "youtube" && node.attrs) {
    const attrs = node.attrs as Record<string, unknown>;
    if (
      typeof attrs.src === "string" &&
      typeof attrs.transcription === "string" &&
      attrs.transcription
    ) {
      map.set(attrs.src, attrs.transcription);
    }
  }

  const content = node.content;
  if (Array.isArray(content)) {
    for (const child of content) {
      collectYoutubeTranscriptions(child as Record<string, unknown>, map);
    }
  }
}

/**
 * Recursively traverse a Tiptap/ProseMirror JSON doc and collect
 * `attachmentId → { text, mode }` pairs from image nodes that have
 * a persisted vision result (OCR / describe).
 */
function collectImageVisionResults(
  node: Record<string, unknown>,
  map: Map<string, { text: string; mode: string }>,
): void {
  if (node.type === "image" && node.attrs) {
    const attrs = node.attrs as Record<string, unknown>;
    if (
      typeof attrs.attachmentId === "string" &&
      typeof attrs.visionResult === "string" &&
      attrs.visionResult
    ) {
      map.set(attrs.attachmentId, {
        text: attrs.visionResult,
        mode: (attrs.visionMode as string) || "scan",
      });
    }
  }

  const content = node.content;
  if (Array.isArray(content)) {
    for (const child of content) {
      collectImageVisionResults(child as Record<string, unknown>, map);
    }
  }
}

/**
 * Hook that syncs server-injected data (YouTube transcriptions, image vision
 * results) from the entry's content JSON into the live Tiptap editor.
 *
 * When server-side code injects results into entry.content JSON, we need
 * to push them into the live editor without a full page reload.
 */
export function useServerDataSync(
  entryContent: unknown,
  tiptapRef: RefObject<TiptapEditorHandle | null>,
  setContentJson: (json: Record<string, unknown>) => void,
  draftRef: RefObject<{ contentJson: Record<string, unknown> }>,
): void {
  useEffect(() => {
    if (!entryContent || typeof entryContent !== "object") return;

    const serverContent = entryContent as Record<string, unknown>;
    let latestJson: Record<string, unknown> | null = null;

    // 1. Sync YouTube transcriptions
    const serverTranscriptions = new Map<string, string>();
    collectYoutubeTranscriptions(serverContent, serverTranscriptions);

    if (serverTranscriptions.size > 0) {
      const updated =
        tiptapRef.current?.syncYoutubeTranscriptions(serverTranscriptions);
      if (updated) {
        latestJson = updated;
        console.info("[TaskEditor] Transcription synced from server to editor");
      }
    }

    // 2. Sync image vision results (OCR / describe)
    const serverVision = new Map<string, { text: string; mode: string }>();
    collectImageVisionResults(serverContent, serverVision);

    if (serverVision.size > 0) {
      const updated = tiptapRef.current?.syncImageVisionResults(serverVision);
      if (updated) {
        latestJson = updated;
        console.info(
          "[TaskEditor] Vision results synced from server to editor",
        );
      }
    }

    // Update local state if anything changed
    if (latestJson) {
      setContentJson(latestJson);
      draftRef.current.contentJson = latestJson;
    }
  }, [entryContent, tiptapRef, setContentJson, draftRef]);
}
