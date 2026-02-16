import Image from "@tiptap/extension-image";
import * as entriesSdk from "@/shared/api/sdk/entries";
import type { VisionMode } from "@/shared/api/sdk/entries";
import { visionQueue } from "@/shared/lib/visionQueue";

/**
 * ImageAttachment — extends the default Tiptap Image extension
 * to persist `attachmentId` in the ProseMirror schema so it survives
 * JSON serialization (getJSON / setContent).
 *
 * Also adds a vanilla NodeView with delete/OCR/describe buttons.
 *
 * Extension storage:
 * - `entryId`: set by the parent component (TaskEditor) so that the
 *   OCR button in the NodeView knows which entry the image belongs to.
 */
export const ImageAttachment = Image.extend({
  name: "image",
  draggable: false,

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
        parseHTML: (element: HTMLElement) => element.dataset.visionMode ?? null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.visionMode) return {};
          return { "data-vision-mode": attributes.visionMode };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      let processingState: "idle" | "queued" | "loading" = "idle";
      let activeMode: VisionMode | null = null;
      let queueAhead = 0;
      let lastVisionText = (node.attrs.visionResult as string | null) ?? "";
      let lastVisionMode = (node.attrs.visionMode as VisionMode | null) ?? null;

      // Subscribe to queue changes for "Queued (N ahead)..." feedback
      const unsubQueue = visionQueue.onPendingChange((pending) => {
        if (processingState === "queued") {
          queueAhead = Math.max(0, pending - 1);
          refreshProcessingState();
        }
      });

      const root = document.createElement("div");
      root.className = "image-attachment-wrapper";
      root.contentEditable = "false";
      root.draggable = false;
      root.addEventListener("dragstart", blockNativeDrag);

      const frame = document.createElement("div");
      frame.className = "image-attachment-frame";
      frame.draggable = false;
      frame.addEventListener("dragstart", blockNativeDrag);

      const img = document.createElement("img");
      img.className = "image-attachment-img";
      img.draggable = false;
      img.addEventListener("dragstart", blockNativeDrag);

      const processingOverlay = document.createElement("div");
      processingOverlay.className = "image-attachment-processing";
      const processingLabel = document.createElement("span");
      processingLabel.className = "image-attachment-processing-label";
      processingOverlay.appendChild(processingLabel);

      const controls = document.createElement("div");
      controls.className = "image-attachment-controls";

      // Helper to create inline SVG icons
      const makeSvg = (paths: string, vb = "0 0 24 24") => {
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.setAttribute("viewBox", vb);
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.innerHTML = paths;
        return svg;
      };

      // Scan button — ScanText icon
      const scanBtn = document.createElement("button");
      scanBtn.type = "button";
      scanBtn.className = "image-attachment-btn image-attachment-btn-action";
      scanBtn.title = "Extract text from image (OCR)";
      const scanIcon = makeSvg(
        '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
          '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
          '<path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/>',
      );
      const scanLabel = document.createElement("span");
      scanLabel.textContent = "Scan";
      scanBtn.append(scanIcon, scanLabel);

      // Describe button — Sparkles icon
      const describeBtn = document.createElement("button");
      describeBtn.type = "button";
      describeBtn.className =
        "image-attachment-btn image-attachment-btn-action";
      describeBtn.title = "Describe image with AI";
      const describeIcon = makeSvg(
        '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>' +
          '<circle cx="12" cy="12" r="3"/>',
      );
      const describeLabel = document.createElement("span");
      describeLabel.textContent = "Describe";
      describeBtn.append(describeIcon, describeLabel);

      // Delete button — X icon (circle)
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "image-attachment-btn image-attachment-btn-delete";
      deleteBtn.title = "Remove image";
      const deleteIcon = makeSvg(
        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      );
      deleteBtn.appendChild(deleteIcon);

      controls.append(scanBtn, describeBtn, deleteBtn);
      frame.append(img, processingOverlay, controls);

      // --- Result panel (Neuraal Vision) ---
      const resultPanel = document.createElement("div");
      resultPanel.className = "image-attachment-result";

      const resultHeader = document.createElement("div");
      resultHeader.className = "image-attachment-result-header";

      const headerLeft = document.createElement("div");
      headerLeft.className = "image-attachment-result-header-left";

      // Brain icon (inline SVG — matches lucide Brain)
      const brainIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      brainIcon.setAttribute("viewBox", "0 0 24 24");
      brainIcon.setAttribute("fill", "none");
      brainIcon.setAttribute("stroke", "currentColor");
      brainIcon.setAttribute("stroke-width", "2");
      brainIcon.setAttribute("stroke-linecap", "round");
      brainIcon.setAttribute("stroke-linejoin", "round");
      brainIcon.classList.add("image-attachment-result-icon");
      brainIcon.innerHTML =
        '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>' +
        '<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>' +
        '<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>' +
        '<path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>' +
        '<path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>' +
        '<path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>' +
        '<path d="M19.938 10.5a4 4 0 0 1 .585.396"/>' +
        '<path d="M6 18a4 4 0 0 1-1.967-.516"/>' +
        '<path d="M19.967 17.484A4 4 0 0 1 18 18"/>';

      const resultTitle = document.createElement("span");
      resultTitle.className = "image-attachment-result-title";
      resultTitle.textContent = "Neuraal Vision";

      const resultMode = document.createElement("span");
      resultMode.className = "image-attachment-result-mode";

      headerLeft.append(brainIcon, resultTitle, resultMode);

      // Copy button
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "image-attachment-result-copy";
      const copyIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      copyIcon.setAttribute("viewBox", "0 0 24 24");
      copyIcon.setAttribute("fill", "none");
      copyIcon.setAttribute("stroke", "currentColor");
      copyIcon.setAttribute("stroke-width", "2");
      copyIcon.setAttribute("stroke-linecap", "round");
      copyIcon.setAttribute("stroke-linejoin", "round");
      copyIcon.innerHTML =
        '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
        '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>';
      const copyLabel = document.createElement("span");
      copyLabel.textContent = "Copy";
      copyBtn.append(copyIcon, copyLabel);

      copyBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!lastVisionText) return;
        navigator.clipboard
          .writeText(lastVisionText)
          .then(() => {
            copyLabel.textContent = "Copied!";
            copyBtn.style.color = "rgb(52, 211, 153)"; // emerald-400
            setTimeout(() => {
              copyLabel.textContent = "Copy";
              copyBtn.style.color = "";
            }, 2000);
          })
          .catch(() => {
            // Fallback: try deprecated execCommand
            try {
              const ta = document.createElement("textarea");
              ta.value = lastVisionText;
              ta.style.cssText = "position:fixed;left:-9999px";
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
              copyLabel.textContent = "Copied!";
              setTimeout(() => {
                copyLabel.textContent = "Copy";
              }, 2000);
            } catch {
              /* ignore */
            }
          });
      });

      resultHeader.append(headerLeft, copyBtn);

      const resultBody = document.createElement("pre");
      resultBody.className = "image-attachment-result-body";
      resultPanel.append(resultHeader, resultBody);

      root.append(frame, resultPanel);

      // Stop click propagation on interactive controls/panels only (not the root)
      // so that height changes from vision result panels don't reach
      // TaskEditorWrapper's onClick which triggers auto-scroll.
      // Clicks on the image area still propagate so the editor can expand.
      controls.addEventListener("click", (e) => e.stopPropagation());
      resultPanel.addEventListener("click", (e) => e.stopPropagation());

      const preventBtnInteraction = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };

      scanBtn.addEventListener("mousedown", (e) => {
        preventBtnInteraction(e);
        void runVision("scan");
      });

      describeBtn.addEventListener("mousedown", (e) => {
        preventBtnInteraction(e);
        void runVision("describe");
      });

      deleteBtn.addEventListener("mousedown", (e) => {
        preventBtnInteraction(e);
        const pos = getPos();
        if (typeof pos === "number") {
          editor.commands.deleteRange({
            from: pos,
            to: pos + currentNode.nodeSize,
          });
        }
      });

      refreshView(node);

      async function runVision(mode: VisionMode): Promise<void> {
        if (processingState === "loading" || processingState === "queued")
          return;

        const entryId = (editor.storage as { image?: { entryId?: string } })
          .image?.entryId as string | undefined;
        const attachmentId = currentNode.attrs.attachmentId as
          | string
          | undefined;
        if (!entryId || !attachmentId) return;

        activeMode = mode;

        // Check if there are already tasks in the queue
        const pendingBefore = visionQueue.pending;
        if (pendingBefore > 0) {
          processingState = "queued";
          queueAhead = pendingBefore;
        } else {
          processingState = "loading";
        }
        refreshProcessingState();

        try {
          const result = await visionQueue.enqueue(() => {
            // Transition from queued to loading when our turn comes
            processingState = "loading";
            refreshProcessingState();
            return entriesSdk.analyzeImage(entryId, attachmentId, mode);
          });

          lastVisionText = result.extractedText;
          lastVisionMode = mode;
          persistVisionToNode(
            editor,
            getPos,
            currentNode,
            result.extractedText,
            mode,
          );
          refreshResult();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Vision analysis failed";
          lastVisionText = message;
          lastVisionMode = mode;
          refreshResult(true);
        } finally {
          processingState = "idle";
          activeMode = null;
          queueAhead = 0;
          refreshProcessingState();
        }
      }

      function refreshView(n: typeof node) {
        currentNode = n;
        const src = (n.attrs.src as string) || "";
        const alt = (n.attrs.alt as string) || "";
        const uploading = Boolean(n.attrs.uploading);
        const visionResult = (n.attrs.visionResult as string | null) ?? "";
        const visionMode = (n.attrs.visionMode as VisionMode | null) ?? null;

        img.src = src;
        img.alt = alt;
        img.style.opacity = uploading ? "0.5" : "1";

        if (visionResult) {
          lastVisionText = visionResult;
          lastVisionMode = visionMode;
        }

        controls.style.display = uploading ? "none" : "flex";
        refreshProcessingState();
        refreshResult();
      }

      function refreshProcessingState() {
        const busy = processingState !== "idle";
        processingOverlay.style.display = busy ? "flex" : "none";

        if (processingState === "queued") {
          const ahead = queueAhead > 0 ? ` (${queueAhead} ahead)` : "";
          processingLabel.textContent = `Queued${ahead}...`;
        } else if (processingState === "loading") {
          processingLabel.textContent =
            activeMode === "describe"
              ? "Describing image (may take up to 1 min)..."
              : "Extracting text (may take up to 1 min)...";
        }

        scanBtn.disabled = busy;
        describeBtn.disabled = busy;
      }

      function refreshResult(isError = false) {
        if (!lastVisionText) {
          resultPanel.style.display = "none";
          return;
        }
        resultPanel.style.display = "block";
        resultMode.textContent =
          lastVisionMode === "describe" ? "description" : "text scan";
        resultBody.textContent = lastVisionText;
        resultPanel.dataset.error = isError ? "true" : "false";
      }

      function blockNativeDrag(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
      }

      return {
        dom: root,
        update(updatedNode) {
          if (updatedNode.type.name !== "image") return false;
          refreshView(updatedNode);
          return true;
        },
        stopEvent(event) {
          const target = event.target as HTMLElement | null;
          if (!target) return false;
          return Boolean(
            target.closest(".image-attachment-controls") ||
            target.closest(".image-attachment-result"),
          );
        },
        ignoreMutation() {
          return true;
        },
        destroy() {
          unsubQueue();
        },
      };
    };
  },
});

function persistVisionToNode(
  editor: import("@tiptap/core").Editor,
  getPos: () => number | undefined,
  currentNode: { attrs: Record<string, unknown> },
  text: string,
  mode: VisionMode,
): void {
  if (!editor || editor.isDestroyed) return;
  const pos = getPos();
  if (typeof pos !== "number") return;

  const nodeAtPos = editor.state.doc.nodeAt(pos);
  const baseAttrs =
    nodeAtPos?.type.name === "image" ? nodeAtPos.attrs : currentNode.attrs;

  const tr = editor.state.tr;
  tr.setNodeMarkup(pos, undefined, {
    ...baseAttrs,
    visionResult: text,
    visionMode: mode,
  });
  editor.view.dispatch(tr);
}
