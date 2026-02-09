import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";
import { attachmentsQueryKey } from "@/shared/api/queries/attachments";
import type { TiptapEditorHandle } from "../components/TiptapEditor";

/**
 * Hook that provides image upload via the attachment S3 infrastructure.
 *
 * Flow: file → createObjectURL (temp preview) → insert image node →
 *       initUpload → PUT to S3 → completeUpload → update node src + attachmentId
 *
 * @param entryId - The entry to attach the image to.
 * @param editorRef - Ref to the TiptapEditor handle for inserting nodes.
 */
export function useImageUpload(
  entryId: string | undefined,
  editorRef: React.RefObject<TiptapEditorHandle | null>
) {
  const queryClient = useQueryClient();

  const uploadImages = useCallback(
    async (files: File[]) => {
      if (!entryId || !editorRef.current?.editor) return;

      for (const file of files) {
        // 1. Create temp preview URL
        const tempUrl = URL.createObjectURL(file);

        // 2. Insert image node with temp URL and uploading flag
        editorRef.current.insertImage({
          src: tempUrl,
          alt: file.name,
        });

        // Mark as uploading
        const editor = editorRef.current?.editor;
        if (editor) {
          const { doc } = editor.state;
          const tr = editor.state.tr;
          let marked = false;
          doc.descendants((node, pos) => {
            if (
              node.type.name === "image" &&
              node.attrs.src === tempUrl &&
              !marked
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                uploading: true,
              });
              marked = true;
            }
          });
          if (marked) editor.view.dispatch(tr);
        }

        try {
          // 3. Init upload
          const initResult = await attachmentsSdk.initUpload({
            entryId,
            filename: file.name,
            mimeType: file.type || "image/png",
            sizeBytes: file.size,
            kind: "inline",
          });

          // 4. Upload to S3
          const uploadResp = await fetch(initResult.presignedPutUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "image/png" },
          });

          if (!uploadResp.ok) {
            throw new Error(`S3 upload failed: ${uploadResp.status}`);
          }

          // 5. Complete upload
          await attachmentsSdk.completeUpload(initResult.attachment.id);

          // 6. Get fresh download URL
          const { presignedGetUrl } = await attachmentsSdk.getDownloadUrl(
            initResult.attachment.id
          );

          // 7. Replace temp URL with real URL in the editor, using the
          //    `attachmentId` node attribute so it persists in JSON.
          const editorNow = editorRef.current?.editor;
          if (editorNow) {
            const { doc } = editorNow.state;
            const tr = editorNow.state.tr;
            let replaced = false;

            doc.descendants((node, pos) => {
              if (
                node.type.name === "image" &&
                node.attrs.src === tempUrl &&
                !replaced
              ) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  src: presignedGetUrl,
                  attachmentId: initResult.attachment.id,
                  uploading: false,
                });
                replaced = true;
              }
            });

            if (replaced) {
              editorNow.view.dispatch(tr);
            }
          }

          // 8. Invalidate attachments query
          await queryClient.invalidateQueries({
            queryKey: attachmentsQueryKey(entryId),
          });
        } catch (error) {
          console.error("[useImageUpload] Failed to upload image:", error);
          // Remove uploading state on error
          const editorNow = editorRef.current?.editor;
          if (editorNow) {
            const { doc } = editorNow.state;
            const tr = editorNow.state.tr;
            let fixed = false;
            doc.descendants((node, pos) => {
              if (
                node.type.name === "image" &&
                node.attrs.src === tempUrl &&
                !fixed
              ) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  uploading: false,
                });
                fixed = true;
              }
            });
            if (fixed) editorNow.view.dispatch(tr);
          }
        } finally {
          URL.revokeObjectURL(tempUrl);
        }
      }
    },
    [entryId, editorRef, queryClient]
  );

  return { uploadImages };
}
