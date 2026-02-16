import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";
import { attachmentsQueryKey } from "@/shared/api/queries/attachments";
import type { TiptapEditorHandle } from "../components/TiptapEditor";

type EditorInstance = TiptapEditorHandle["editor"];

function updateFirstImageNodeByTempUrl(
  editor: EditorInstance,
  tempUrl: string,
  attrsUpdater: (attrs: Record<string, unknown>) => Record<string, unknown>,
): boolean {
  if (!editor) return false;

  const { doc } = editor.state;
  const tr = editor.state.tr;
  let updated = false;

  doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src === tempUrl && !updated) {
      tr.setNodeMarkup(
        pos,
        undefined,
        attrsUpdater(node.attrs as Record<string, unknown>),
      );
      updated = true;
    }
  });

  if (updated) {
    editor.view.dispatch(tr);
  }

  return updated;
}

async function uploadInlineImage(
  entryId: string,
  file: File,
): Promise<{ attachmentId: string; presignedGetUrl: string }> {
  const initResult = await attachmentsSdk.initUpload({
    entryId,
    filename: file.name,
    mimeType: file.type || "image/png",
    sizeBytes: file.size,
    kind: "inline",
  });

  const uploadResp = await fetch(initResult.presignedPutUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "image/png" },
  });

  if (!uploadResp.ok) {
    throw new Error(`S3 upload failed: ${uploadResp.status}`);
  }

  await attachmentsSdk.completeUpload(initResult.attachment.id);
  const { presignedGetUrl } = await attachmentsSdk.getDownloadUrl(
    initResult.attachment.id,
  );

  return {
    attachmentId: initResult.attachment.id,
    presignedGetUrl,
  };
}

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
  editorRef: React.RefObject<TiptapEditorHandle | null>,
) {
  const queryClient = useQueryClient();

  const uploadImages = useCallback(
    async (files: File[]) => {
      if (!entryId || !editorRef.current?.editor) return;

      for (const file of files) {
        const tempUrl = URL.createObjectURL(file);

        editorRef.current.insertImage({
          src: tempUrl,
          alt: file.name,
        });

        updateFirstImageNodeByTempUrl(
          editorRef.current?.editor,
          tempUrl,
          (attrs) => ({
            ...attrs,
            uploading: true,
          }),
        );

        try {
          const uploaded = await uploadInlineImage(entryId, file);

          updateFirstImageNodeByTempUrl(
            editorRef.current?.editor,
            tempUrl,
            (attrs) => ({
              ...attrs,
              src: uploaded.presignedGetUrl,
              attachmentId: uploaded.attachmentId,
              uploading: false,
            }),
          );

          await queryClient.invalidateQueries({
            queryKey: attachmentsQueryKey(entryId),
          });
        } catch (error) {
          console.error("[useImageUpload] Failed to upload image:", error);
          updateFirstImageNodeByTempUrl(
            editorRef.current?.editor,
            tempUrl,
            (attrs) => ({
              ...attrs,
              uploading: false,
            }),
          );
        } finally {
          URL.revokeObjectURL(tempUrl);
        }
      }
    },
    [entryId, editorRef, queryClient],
  );

  return { uploadImages };
}
