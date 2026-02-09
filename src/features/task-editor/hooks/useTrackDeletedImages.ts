import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";
import { attachmentsQueryKey } from "@/shared/api/queries/attachments";
import type { TiptapEditorHandle } from "../components/TiptapEditor";

/**
 * Collects all attachment IDs from image and fileAttachment nodes in the editor doc.
 */
function collectAttachmentIds(editor: NonNullable<TiptapEditorHandle["editor"]>): Set<string> {
  const ids = new Set<string>();
  if (!editor || editor.isDestroyed) return ids;
  editor.state.doc.descendants((node) => {
    if (
      (node.type.name === "image" || node.type.name === "fileAttachment") &&
      node.attrs.attachmentId
    ) {
      ids.add(node.attrs.attachmentId as string);
    }
  });
  return ids;
}

/** Maximum retries to wait for the editor to initialise. */
const MAX_RETRIES = 50; // 50 × 100ms = 5 seconds max wait

/**
 * Hook that detects when image/file nodes are removed from the editor
 * and automatically deletes the corresponding attachments in the backend.
 *
 * Uses a retry mechanism because `editorRef.current.editor` may be `null`
 * on the first render (Tiptap with `immediatelyRender: false` needs an
 * extra render cycle to initialise the editor).
 *
 * @param entryId - The entry the attachments belong to.
 * @param editorRef - Ref to the TiptapEditor handle.
 */
export function useTrackDeletedImages(
  entryId: string | undefined,
  editorRef: React.RefObject<TiptapEditorHandle | null>
) {
  const queryClient = useQueryClient();
  const previousIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let subscribed = false;

    const handleUpdate = () => {
      const editor = editorRef.current?.editor;
      if (!editor || editor.isDestroyed) return;

      const currentIds = collectAttachmentIds(editor);

      // On first call, just record the initial set
      if (!initializedRef.current) {
        previousIdsRef.current = currentIds;
        initializedRef.current = true;
        return;
      }

      // Find IDs that were present before but are gone now
      const removedIds: string[] = [];
      for (const id of previousIdsRef.current) {
        if (!currentIds.has(id)) {
          removedIds.push(id);
        }
      }

      // Update for next comparison
      previousIdsRef.current = currentIds;

      // Delete removed attachments in the background
      if (removedIds.length > 0 && entryId) {
        for (const id of removedIds) {
          attachmentsSdk
            .deleteAttachment(id)
            .then(() =>
              queryClient.invalidateQueries({
                queryKey: attachmentsQueryKey(entryId),
              })
            )
            .catch((err) =>
              console.error("[useTrackDeletedImages] Failed to delete attachment:", id, err)
            );
        }
      }
    };

    function trySubscribe() {
      const editor = editorRef.current?.editor;

      if (!editor || editor.isDestroyed || !entryId) {
        // Editor not ready yet — retry after a short delay
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          retryTimer = setTimeout(trySubscribe, 100);
        }
        return;
      }

      // Subscribe to Tiptap update events
      editor.on("update", handleUpdate);

      // Initialize with the current set of attachment IDs
      previousIdsRef.current = collectAttachmentIds(editor);
      initializedRef.current = true;
      subscribed = true;
    }

    trySubscribe();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (subscribed) {
        const editor = editorRef.current?.editor;
        if (editor && !editor.isDestroyed) {
          editor.off("update", handleUpdate);
        }
      }
      initializedRef.current = false;
    };
  }, [editorRef, entryId, queryClient]);
}
