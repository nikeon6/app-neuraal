import Youtube from "@tiptap/extension-youtube";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { YoutubeEmbedComponent } from "./YoutubeEmbedComponent";

/**
 * YoutubeEmbed — extends the default Tiptap YouTube extension
 * to add a React NodeView with Transcribe and Delete buttons.
 *
 * Adds a `transcription` attribute to store the transcription text
 * directly on the YouTube node (injected by the transcription callback).
 *
 * Also adds extension storage for `entryId` so the component can
 * trigger the transcription API.
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
    };
  },

  addStorage() {
    return {
      entryId: null as string | null,
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeEmbedComponent, {
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
