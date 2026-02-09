import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileAttachmentComponent } from "./FileAttachmentComponent";

/**
 * FileAttachment — custom atom node for file attachments in the editor.
 *
 * Renders as an interactive block with filename, size, download, and delete buttons.
 * Attrs are persisted in the TipTap JSON for save/restore.
 */
export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: { default: null },
      filename: { default: "" },
      mimeType: { default: "application/octet-stream" },
      sizeBytes: { default: 0 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="file-attachment"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-attachment" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentComponent, {
      // Allow mouse events on buttons inside the NodeView to pass through
      stopEvent: ({ event }) => {
        if (
          event.type === "mousedown" ||
          event.type === "mouseup" ||
          event.type === "click"
        ) {
          // Let button clicks through
          const target = event.target as HTMLElement;
          if (target.closest("button")) return true;
        }
        return false;
      },
    });
  },
});
