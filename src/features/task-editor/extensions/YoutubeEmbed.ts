import Youtube from "@tiptap/extension-youtube";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { YoutubeEmbedComponent } from "./YoutubeEmbedComponent";

/**
 * YoutubeEmbed — extends the default Tiptap YouTube extension
 * to add a React NodeView with a "Transcribe" button (disabled for now).
 */
export const YoutubeEmbed = Youtube.extend({
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeEmbedComponent, {
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
