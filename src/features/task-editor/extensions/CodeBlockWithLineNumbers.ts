import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findChildren } from "@tiptap/core";

const lineNumbersKey = new PluginKey("codeBlockLineNumbers");
const autoDetectKey = new PluginKey("codeBlockAutoDetect");

/** Minimum text length to attempt language auto-detection. */
const AUTO_DETECT_MIN_LENGTH = 12;

/**
 * Creates a line-number widget element.
 */
function createLineNumWidget(num: number): HTMLElement {
  const span = document.createElement("span");
  span.className = "code-line-num";
  span.textContent = String(num);
  span.contentEditable = "false";
  return span;
}

/**
 * CodeBlockWithLineNumbers — extends CodeBlockLowlight with:
 * - A vanilla NodeView that adds a delete button and language badge
 * - A ProseMirror plugin that auto-detects language and sets the node attribute
 * - A ProseMirror plugin that renders line numbers via widget decorations
 */
export const CodeBlockWithLineNumbers = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const pre = document.createElement("pre");
      pre.classList.add("code-block-node");

      // Code element — ProseMirror content goes here
      const code = document.createElement("code");
      pre.appendChild(code);

      // Controls bar — absolutely positioned, non-editable
      const controls = document.createElement("div");
      controls.className = "code-block-controls";
      controls.contentEditable = "false";

      // Language badge
      const langBadge = document.createElement("span");
      langBadge.className = "code-block-lang";
      controls.appendChild(langBadge);

      // Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "code-block-delete";
      deleteBtn.title = "Remove code block";
      deleteBtn.textContent = "\u00D7";

      let currentNode = node;

      deleteBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (typeof pos === "number") {
          editor.commands.deleteRange({
            from: pos,
            to: pos + currentNode.nodeSize,
          });
        }
      });
      controls.appendChild(deleteBtn);

      pre.appendChild(controls);

      /** Display the language from the node attribute, or "auto" if null. */
      function refreshBadge(n: typeof node) {
        const lang = (n.attrs.language as string) || "auto";
        langBadge.textContent = lang;
        pre.dataset.language = lang;
      }

      refreshBadge(node);

      return {
        dom: pre,
        contentDOM: code,
        update(updatedNode) {
          if (updatedNode.type.name !== "codeBlock") return false;
          currentNode = updatedNode;
          refreshBadge(updatedNode);
          return true;
        },
      };
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() || [];
    const lowlightInstance = this.options.lowlight;
    const extensionName = this.name;

    // ---- Auto-detect language plugin ----
    // When a code block has language=null and enough text, run highlightAuto
    // and set the detected language as the node attribute.
    const autoDetectPlugin = new Plugin({
      key: autoDetectKey,
      appendTransaction: (transactions, _oldState, newState) => {
        if (
          !lowlightInstance?.highlightAuto ||
          !transactions.some((tr) => tr.docChanged)
        ) {
          return null;
        }

        const codeBlocks = findChildren(
          newState.doc,
          (n) => n.type.name === extensionName
        );

        let tr: ReturnType<typeof newState.tr> | null = null;

        for (const block of codeBlocks) {
          // Skip blocks that already have an explicit language
          if (block.node.attrs.language) continue;

          const text = block.node.textContent;
          if (text.trim().length < AUTO_DETECT_MIN_LENGTH) continue;

          try {
            const result = lowlightInstance.highlightAuto(text);
            const detected = (
              result as { data?: { language?: string } }
            ).data?.language;

            if (detected) {
              if (!tr) tr = newState.tr;
              tr.setNodeMarkup(block.pos, undefined, {
                ...block.node.attrs,
                language: detected,
              });
            }
          } catch {
            // Ignore detection errors
          }
        }

        return tr;
      },
    });

    // ---- Line numbers plugin ----
    const lineNumbersPlugin = new Plugin({
      key: lineNumbersKey,
      state: {
        init: (_, { doc }) =>
          buildLineNumberDecorations(doc, extensionName),
        apply: (tr, decorationSet, _oldState, newState) => {
          if (!tr.docChanged) {
            return decorationSet.map(tr.mapping, newState.doc);
          }
          return buildLineNumberDecorations(newState.doc, extensionName);
        },
      },
      props: {
        decorations(state) {
          return lineNumbersPlugin.getState(state);
        },
      },
    });

    return [...parentPlugins, autoDetectPlugin, lineNumbersPlugin];
  },
});

/**
 * Builds a DecorationSet with line-number widget decorations
 * for every code block in the document.
 */
function buildLineNumberDecorations(
  doc: import("@tiptap/pm/model").Node,
  name: string
): DecorationSet {
  const decorations: Decoration[] = [];

  const codeBlocks = findChildren(doc, (n) => n.type.name === name);

  for (const block of codeBlocks) {
    const text = block.node.textContent;
    const contentStart = block.pos + 1;
    let lineNum = 1;

    // First line
    decorations.push(
      Decoration.widget(contentStart, createLineNumWidget(lineNum++), {
        side: -1,
        ignoreSelection: true,
      })
    );

    // Each subsequent line (after each \n)
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\n") {
        decorations.push(
          Decoration.widget(
            contentStart + i + 1,
            createLineNumWidget(lineNum++),
            { side: -1, ignoreSelection: true }
          )
        );
      }
    }
  }

  return DecorationSet.create(doc, decorations);
}
