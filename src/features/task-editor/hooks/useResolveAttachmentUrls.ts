import { useEffect, useRef } from "react";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";
import type { TiptapEditorHandle } from "../components/TiptapEditor";

/**
 * Hook that resolves attachment IDs in the editor to fresh presigned URLs.
 *
 * When editor content is loaded, images may reference expired presigned URLs.
 * This hook scans for image nodes with `attachmentId` attr and refreshes their `src`.
 *
 * @param editorRef - Ref to the TiptapEditor handle.
 * @param content - The content JSON (triggers resolution when it changes).
 */
export function useResolveAttachmentUrls(
  editorRef: React.RefObject<TiptapEditorHandle | null>,
  content: Record<string, unknown>
) {
  const resolvedRef = useRef(new Set<string>());

  useEffect(() => {
    const editor = editorRef.current?.editor;
    if (!editor || editor.isDestroyed) return;

    // Small delay to let editor render the content first
    const timer = setTimeout(async () => {
      const { doc } = editor.state;
      const imagesToResolve: Array<{
        pos: number;
        attachmentId: string;
        currentSrc: string;
      }> = [];

      doc.descendants((node, pos) => {
        if (node.type.name === "image") {
          // Use the persisted `attachmentId` attribute (not data-attachment-id)
          const attachmentId = node.attrs.attachmentId as string | undefined;
          if (attachmentId && !resolvedRef.current.has(attachmentId)) {
            imagesToResolve.push({
              pos,
              attachmentId,
              currentSrc: node.attrs.src as string,
            });
          }
        }
      });

      if (imagesToResolve.length === 0) return;

      // Resolve URLs in parallel
      const results = await Promise.allSettled(
        imagesToResolve.map(async (img) => {
          const { presignedGetUrl } = await attachmentsSdk.getDownloadUrl(
            img.attachmentId
          );
          return { ...img, newSrc: presignedGetUrl };
        })
      );

      // Apply URL updates
      const tr = editor.state.tr;
      let updated = false;

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { pos, attachmentId, newSrc } = result.value;

        // Re-check position since editor state may have changed
        const node = editor.state.doc.nodeAt(pos);
        if (
          node?.type.name === "image" &&
          node.attrs.attachmentId === attachmentId
        ) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            src: newSrc,
          });
          resolvedRef.current.add(attachmentId);
          updated = true;
        }
      }

      if (updated) {
        editor.view.dispatch(tr);
      }
    }, 200);

    return () => clearTimeout(timer);
    // Only run when content reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editorRef]);
}
