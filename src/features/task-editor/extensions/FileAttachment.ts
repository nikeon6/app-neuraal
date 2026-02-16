import { Node, mergeAttributes } from "@tiptap/core";
import * as attachmentsSdk from "@/shared/api/sdk/attachments";

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Helper to create an inline SVG element (Lucide-style icons).
 */
function makeSvg(paths: string, vb = "0 0 24 24"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", vb);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = paths;
  return svg;
}

/**
 * FileAttachment — custom atom node for file attachments in the editor.
 *
 * Renders as an interactive block with filename, size, download, and delete buttons.
 * Uses vanilla DOM instead of ReactNodeViewRenderer to avoid flushSync
 * conflicts with Framer Motion layout animations during drag-reorder.
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
    return ({ node, editor, getPos }) => {
      let currentNode = node;

      // ---- Root ----
      const root = document.createElement("div");
      root.className = "file-attachment-node";
      root.contentEditable = "false";

      // File icon (FileText)
      const fileIcon = makeSvg(
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
          '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>' +
          '<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
      );
      fileIcon.classList.add("file-icon");

      // File info
      const fileInfo = document.createElement("div");
      fileInfo.className = "file-info";

      const fileName = document.createElement("div");
      fileName.className = "file-name";

      const fileSize = document.createElement("div");
      fileSize.className = "file-size";

      fileInfo.append(fileName, fileSize);

      // Download button
      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "file-download";
      const downloadIcon = makeSvg(
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
          '<polyline points="7 10 12 15 17 10"/>' +
          '<line x1="12" x2="12" y1="15" y2="3"/>',
      );
      downloadIcon.style.width = "0.875rem";
      downloadIcon.style.height = "0.875rem";
      downloadBtn.appendChild(downloadIcon);

      // Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "file-download file-delete-btn";
      deleteBtn.title = "Remove attachment";
      const deleteIcon = makeSvg(
        '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>' +
          '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
      );
      deleteIcon.style.width = "0.875rem";
      deleteIcon.style.height = "0.875rem";
      deleteBtn.appendChild(deleteIcon);

      root.append(fileIcon, fileInfo, downloadBtn, deleteBtn);

      // ---- Event handlers ----
      const prevent = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };

      downloadBtn.addEventListener("mousedown", (e) => {
        prevent(e);
        const aid = currentNode.attrs.attachmentId as string | undefined;
        if (!aid) return;
        attachmentsSdk
          .getDownloadUrl(aid)
          .then(({ presignedGetUrl }) => {
            globalThis.open(presignedGetUrl, "_blank", "noopener");
          })
          .catch((error) => {
            console.error("[FileAttachment] Download failed:", error);
          });
      });

      deleteBtn.addEventListener("mousedown", (e) => {
        prevent(e);
        const pos = getPos();
        if (typeof pos === "number") {
          editor.commands.deleteRange({
            from: pos,
            to: pos + currentNode.nodeSize,
          });
        }
      });

      function refreshView(n: typeof node) {
        currentNode = n;
        const fname = (n.attrs.filename as string) || "Untitled";
        const size = (n.attrs.sizeBytes as number) || 0;
        const mime = (n.attrs.mimeType as string) || "application/octet-stream";

        fileName.textContent = fname;
        fileSize.textContent = `${formatBytes(size)} · ${mime}`;
        downloadBtn.title = `Download ${fname}`;
      }

      refreshView(node);

      return {
        dom: root,
        update(updatedNode) {
          if (updatedNode.type.name !== "fileAttachment") return false;
          refreshView(updatedNode);
          return true;
        },
        stopEvent(event) {
          const target = event.target as HTMLElement | null;
          if (!target) return false;
          return Boolean(target.closest("button"));
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});
