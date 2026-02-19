import Youtube from "@tiptap/extension-youtube";
import * as entriesSdk from "@/shared/api/sdk/entries";

/**
 * Convert a YouTube watch / short URL to a privacy-enhanced embed URL.
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
 * YoutubeEmbed — extends the default Tiptap YouTube extension
 * to add a vanilla (pure-DOM) NodeView with Transcribe and Delete buttons.
 *
 * Adds a `transcription` attribute to store the transcription text
 * directly on the YouTube node (injected by the transcription callback).
 *
 * Uses vanilla DOM instead of ReactNodeViewRenderer to avoid flushSync
 * conflicts with Framer Motion layout animations during drag-reorder.
 */
export const YoutubeEmbed = Youtube.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      transcription: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.dataset.transcription ?? null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.transcription) return {};
          return { "data-transcription": attributes.transcription };
        },
      },
      transcriptionRequested: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.dataset.transcriptionRequested === "true",
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.transcriptionRequested) return {};
          return { "data-transcription-requested": "true" };
        },
      },
    };
  },

  addStorage() {
    return {
      entryId: null as string | null,
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      const hasInitialTranscription = Boolean(node.attrs.transcription);
      const hasPendingRequest = Boolean(node.attrs.transcriptionRequested);
      let transcribeState: "idle" | "loading" | "requested" | "done" | "error" =
        "idle";
      if (hasInitialTranscription) {
        transcribeState = "done";
      } else if (hasPendingRequest) {
        transcribeState = "requested";
      }
      let transcribeError = "";
      let expanded = false;

      // ---- Root wrapper ----
      const root = document.createElement("div");
      root.className = "youtube-embed-wrapper";
      root.contentEditable = "false";

      // ---- Video container (16:9) ----
      const videoContainer = document.createElement("div");
      videoContainer.className = "youtube-embed-video";

      const iframe = document.createElement("iframe");
      iframe.className = "youtube-embed-iframe";
      iframe.title = "YouTube video";
      iframe.allowFullscreen = true;
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.style.border = "none";

      // Loading overlay
      const loadingOverlay = document.createElement("div");
      loadingOverlay.className = "youtube-embed-loading-overlay";
      const loadingSpinner = makeSvg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>');
      loadingSpinner.classList.add("youtube-embed-spinner");
      const loadingLabel = document.createElement("span");
      loadingLabel.className = "youtube-embed-loading-label";
      loadingLabel.textContent = "Requesting transcription...";
      const loadingInner = document.createElement("div");
      loadingInner.className = "youtube-embed-loading-inner";
      loadingInner.append(loadingSpinner, loadingLabel);
      loadingOverlay.appendChild(loadingInner);

      videoContainer.append(iframe, loadingOverlay);

      // ---- Action bar ----
      const actionBar = document.createElement("div");
      actionBar.className = "youtube-embed-actions";

      // Transcribe button
      const transcribeBtn = document.createElement("button");
      transcribeBtn.type = "button";
      transcribeBtn.className =
        "youtube-embed-btn youtube-embed-btn-transcribe";

      const transcribeIcon = makeSvg(
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
          '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>' +
          '<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
      );
      transcribeIcon.classList.add("youtube-embed-btn-icon");
      const transcribeLabel = document.createElement("span");
      transcribeLabel.textContent = "Transcribe";
      transcribeBtn.append(transcribeIcon, transcribeLabel);

      // Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "youtube-embed-btn youtube-embed-btn-delete";
      deleteBtn.title = "Remove video";
      const deleteIcon = makeSvg(
        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      );
      deleteIcon.classList.add("youtube-embed-btn-icon");
      const deleteLabel = document.createElement("span");
      deleteLabel.textContent = "Remove";
      deleteBtn.append(deleteIcon, deleteLabel);

      actionBar.append(transcribeBtn, deleteBtn);

      // ---- "Transcription Requested" info panel ----
      const requestedPanel = document.createElement("div");
      requestedPanel.className = "youtube-embed-panel youtube-embed-panel-info";
      const requestedHeader = document.createElement("div");
      requestedHeader.className = "youtube-embed-panel-header";
      const reqBrainIcon = makeSvg(
        '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>' +
          '<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>' +
          '<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
      );
      reqBrainIcon.classList.add("youtube-embed-panel-icon");
      const reqTitle = document.createElement("span");
      reqTitle.className = "youtube-embed-panel-title";
      reqTitle.textContent = "Transcription Requested";
      requestedHeader.append(reqBrainIcon, reqTitle);
      const reqBody = document.createElement("p");
      reqBody.className = "youtube-embed-panel-body-muted";
      reqBody.textContent =
        "The transcription is being processed. You'll receive a notification when it's ready.";
      requestedPanel.append(requestedHeader, reqBody);

      // ---- Transcription result panel ----
      const resultPanel = document.createElement("div");
      resultPanel.className = "youtube-embed-panel youtube-embed-panel-result";

      const resultHeader = document.createElement("div");
      resultHeader.className =
        "youtube-embed-panel-header youtube-embed-panel-header-between";
      const resultLeft = document.createElement("div");
      resultLeft.className = "youtube-embed-panel-header-left";
      const resBrainIcon = makeSvg(
        '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>' +
          '<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>' +
          '<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
      );
      resBrainIcon.classList.add("youtube-embed-panel-icon");
      const resTitle = document.createElement("span");
      resTitle.className = "youtube-embed-panel-title";
      resTitle.textContent = "Neuraal Transcription";
      resultLeft.append(resBrainIcon, resTitle);

      const resultRight = document.createElement("div");
      resultRight.className = "youtube-embed-panel-actions";

      // Copy button
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "youtube-embed-panel-copy";
      const copyIcon = makeSvg(
        '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
          '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
      );
      copyIcon.classList.add("youtube-embed-panel-btn-icon");
      const copyLabel = document.createElement("span");
      copyLabel.textContent = "Copy";
      copyBtn.append(copyIcon, copyLabel);

      // Expand/Collapse button
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "youtube-embed-panel-toggle";
      const chevronDown = makeSvg('<path d="m6 9 6 6 6-6"/>');
      chevronDown.classList.add("youtube-embed-panel-btn-icon");
      toggleBtn.appendChild(chevronDown);

      resultRight.append(copyBtn, toggleBtn);
      resultHeader.append(resultLeft, resultRight);

      const resultContent = document.createElement("div");
      resultContent.className = "youtube-embed-panel-content";

      resultPanel.append(resultHeader, resultContent);

      // ---- Error panel ----
      const errorPanel = document.createElement("div");
      errorPanel.className = "youtube-embed-panel youtube-embed-panel-error";
      const errorHeader = document.createElement("div");
      errorHeader.className = "youtube-embed-panel-header";
      const errBrainIcon = makeSvg(
        '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>' +
          '<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>' +
          '<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
      );
      errBrainIcon.classList.add("youtube-embed-panel-icon-error");
      const errTitle = document.createElement("span");
      errTitle.className = "youtube-embed-panel-title-error";
      errTitle.textContent = "Transcription Failed";
      errorHeader.append(errBrainIcon, errTitle);
      const errorBody = document.createElement("p");
      errorBody.className = "youtube-embed-panel-body-error";
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "youtube-embed-panel-retry";
      retryBtn.textContent = "Retry";
      errorPanel.append(errorHeader, errorBody, retryBtn);

      // ---- Assemble root ----
      root.append(
        videoContainer,
        actionBar,
        requestedPanel,
        resultPanel,
        errorPanel,
      );

      // Stop click propagation on interactive panels only (not the root)
      // so that height changes from toggling transcription/panels don't
      // reach TaskEditorWrapper's onClick which triggers auto-scroll.
      // Clicks on the video area still propagate so the editor can expand.
      actionBar.addEventListener("click", (e) => e.stopPropagation());
      resultPanel.addEventListener("click", (e) => e.stopPropagation());
      requestedPanel.addEventListener("click", (e) => e.stopPropagation());
      errorPanel.addEventListener("click", (e) => e.stopPropagation());

      // ---- Event handlers ----

      const prevent = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };

      transcribeBtn.addEventListener("mousedown", (e) => {
        prevent(e);
        void handleTranscribe();
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

      copyBtn.addEventListener("mousedown", (e) => {
        prevent(e);
        const text = currentNode.attrs.transcription as string;
        if (!text) return;
        navigator.clipboard
          .writeText(text)
          .then(() => {
            copyLabel.textContent = "Copied!";
            copyBtn.style.color = "rgb(52, 211, 153)";
            setTimeout(() => {
              copyLabel.textContent = "Copy";
              copyBtn.style.color = "";
            }, 2000);
          })
          .catch(() => {
            try {
              const ta = document.createElement("textarea");
              ta.value = text;
              ta.style.cssText = "position:fixed;left:-9999px";
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              ta.remove();
              copyLabel.textContent = "Copied!";
              setTimeout(() => {
                copyLabel.textContent = "Copy";
              }, 2000);
            } catch {
              /* ignore */
            }
          });
      });

      toggleBtn.addEventListener("mousedown", (e) => {
        prevent(e);
        expanded = !expanded;
        resultContent.classList.toggle(
          "youtube-embed-panel-content-expanded",
          expanded,
        );
        chevronDown.style.transform = expanded ? "rotate(180deg)" : "";
        toggleBtn.title = expanded ? "Collapse" : "Expand";
      });

      retryBtn.addEventListener("mousedown", (e) => {
        prevent(e);
        void handleTranscribe();
      });

      async function handleTranscribe(): Promise<void> {
        if (transcribeState === "loading") return;

        const entryId = (editor.storage as { youtube?: { entryId?: string } })
          .youtube?.entryId;
        const src = currentNode.attrs.src as string | undefined;
        if (!entryId || !src) return;

        transcribeState = "loading";
        transcribeError = "";
        refreshUI();

        try {
          await entriesSdk.requestTranscription(entryId, src);
          transcribeState = "requested";
          persistTranscriptionRequested(true);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Transcription request failed";
          transcribeError = message;
          transcribeState = "error";
        }
        refreshUI();
      }

      function persistTranscriptionRequested(requested: boolean): void {
        const pos = getPos();
        if (typeof pos !== "number") return;
        editor
          .chain()
          .command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...currentNode.attrs,
              transcriptionRequested: requested,
            });
            return true;
          })
          .run();
      }

      function refreshUI() {
        const hasTranscription = !!currentNode.attrs.transcription;
        const embedUrl = toEmbedUrl((currentNode.attrs.src as string) || "");
        const width = (currentNode.attrs.width as number) || 640;
        const height = (currentNode.attrs.height as number) || 360;

        iframe.src = embedUrl;
        iframe.width = String(width);
        iframe.height = String(height);

        // Loading overlay
        loadingOverlay.style.display =
          transcribeState === "loading" ? "flex" : "none";

        // Transcribe button states
        if (transcribeState === "loading") {
          transcribeBtn.disabled = true;
          transcribeBtn.className =
            "youtube-embed-btn youtube-embed-btn-transcribe youtube-embed-btn-loading";
          transcribeLabel.textContent = "Transcribing...";
          transcribeBtn.title = "Transcription in progress...";
        } else if (hasTranscription) {
          transcribeBtn.disabled = false;
          transcribeBtn.className =
            "youtube-embed-btn youtube-embed-btn-transcribe youtube-embed-btn-done";
          transcribeLabel.textContent = "Transcribed";
          transcribeBtn.title = "Transcription available";
        } else {
          transcribeBtn.disabled = false;
          transcribeBtn.className =
            "youtube-embed-btn youtube-embed-btn-transcribe";
          transcribeLabel.textContent = "Transcribe";
          transcribeBtn.title = "Transcribe video with AI";
        }

        // Panels visibility
        requestedPanel.style.display =
          transcribeState === "requested" && !hasTranscription
            ? "block"
            : "none";
        resultPanel.style.display = hasTranscription ? "block" : "none";
        errorPanel.style.display =
          transcribeState === "error" && transcribeError ? "block" : "none";

        // Result content
        if (hasTranscription) {
          resultContent.textContent = currentNode.attrs.transcription as string;
        }

        // Error content
        if (transcribeState === "error") {
          errorBody.textContent = transcribeError;
        }
      }

      // Initial render
      refreshUI();

      return {
        dom: root,
        update(updatedNode) {
          if (updatedNode.type.name !== "youtube") return false;
          currentNode = updatedNode;
          // Update transcribeState if server pushed a transcription
          if (updatedNode.attrs.transcription && transcribeState !== "done") {
            transcribeState = "done";
          } else if (
            updatedNode.attrs.transcriptionRequested &&
            transcribeState === "idle"
          ) {
            transcribeState = "requested";
          }
          if (
            updatedNode.attrs.transcription &&
            updatedNode.attrs.transcriptionRequested
          ) {
            persistTranscriptionRequested(false);
          }
          refreshUI();
          return true;
        },
        stopEvent(event) {
          const target = event.target as HTMLElement | null;
          if (!target) return false;
          return Boolean(
            target.closest(".youtube-embed-actions") ||
            target.closest(".youtube-embed-panel-copy") ||
            target.closest(".youtube-embed-panel-toggle") ||
            target.closest(".youtube-embed-panel-retry"),
          );
        },
        // Tell ProseMirror to ignore all DOM mutations inside this NodeView.
        // We manage our own DOM; without this, ProseMirror's MutationObserver
        // detects class/style changes (e.g. expand toggle), triggers a
        // document sync, and calls scrollIntoView on the current selection,
        // which causes the scroll container to jump.
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});
