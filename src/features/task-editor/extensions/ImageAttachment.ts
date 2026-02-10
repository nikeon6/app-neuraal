import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageAttachmentComponent } from "./ImageAttachmentComponent";

/**
 * ImageAttachment — extends the default Tiptap Image extension
 * to persist `attachmentId` in the ProseMirror schema so it survives
 * JSON serialization (getJSON / setContent).
 *
 * Also adds a React NodeView with delete and OCR buttons.
 *
 * Extension storage:
 * - `entryId`: set by the parent component (TaskEditor) so that the
 *   OCR button in the NodeView knows which entry the image belongs to.
 */
export const ImageAttachment = Image.extend({
  name: "image",

  addStorage() {
    return {
      entryId: null as string | null,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      attachmentId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.dataset.attachmentId ?? null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.attachmentId) return {};
          return { "data-attachment-id": attributes.attachmentId };
        },
      },
      uploading: {
        default: false,
        // Don't render uploading state to HTML — it's transient
        renderHTML: () => ({}),
      },
      /** Persisted OCR / Describe result text. Survives JSON serialization. */
      visionResult: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.dataset.visionResult ?? null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.visionResult) return {};
          return { "data-vision-result": attributes.visionResult };
        },
      },
      /** Which mode produced the visionResult: "scan" or "describe". */
      visionMode: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.dataset.visionMode ?? null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.visionMode) return {};
          return { "data-vision-mode": attributes.visionMode };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageAttachmentComponent, {
      // Allow mouse events on buttons inside the NodeView to pass through
      stopEvent: ({ event }) => {
        if (
          event.type === "mousedown" ||
          event.type === "mouseup" ||
          event.type === "click"
        ) {
          const target = event.target as HTMLElement;
          if (target.closest("button")) return true;
        }
        return false;
      },
    });
  },
});
