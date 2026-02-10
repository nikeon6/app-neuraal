"use client";

import React, { useEffect, useImperativeHandle, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { common, createLowlight } from "lowlight";
import { cn } from "@/shared/lib";
import { CodeBlockWithLineNumbers } from "../extensions/CodeBlockWithLineNumbers";
import { ImageAttachment } from "../extensions/ImageAttachment";
import { FileAttachment } from "../extensions/FileAttachment";
import { YoutubeEmbed } from "../extensions/YoutubeEmbed";
import "../styles/tiptap.css";

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TiptapEditorHandle {
  editor: ReturnType<typeof useEditor>;
  /** Insert an image node at the current cursor position. */
  insertImage: (attrs: { src: string; alt?: string; attachmentId?: string }) => void;
  /** Insert a code block at the current cursor position. */
  insertCodeBlock: (language?: string) => void;
  /** Insert a YouTube embed at the current cursor position. */
  insertYoutube: (url: string) => void;
  /** Insert a file attachment node at the current cursor position. */
  insertFileNode: (attrs: {
    attachmentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }) => void;
  /**
   * Inject transcription text into YouTube nodes, keyed by src URL.
   * This uses a ProseMirror transaction without triggering onUpdate
   * to avoid autosave loops. Returns the updated JSON if any node was modified.
   */
  syncYoutubeTranscriptions: (
    transcriptions: Map<string, string>
  ) => Record<string, unknown> | null;
  /**
   * Inject vision results into image nodes, keyed by attachmentId.
   * Like syncYoutubeTranscriptions, suppresses onUpdate to avoid loops.
   */
  syncImageVisionResults: (
    visionResults: Map<string, { text: string; mode: string }>
  ) => Record<string, unknown> | null;
}

interface TiptapEditorProps {
  /** TipTap/ProseMirror JSON content. */
  readonly content: Record<string, unknown>;
  /** Called when editor content changes (debounced by parent). */
  readonly onUpdate: (json: Record<string, unknown>) => void;
  /** Whether the editor is in expanded mode. */
  readonly isExpanded?: boolean;
  /** Whether the editor is editable. */
  readonly editable?: boolean;
  /** Placeholder text. */
  readonly placeholder?: string;
  /** Ref to access editor commands. */
  readonly editorRef?: React.Ref<TiptapEditorHandle>;
  /** Called when user pastes image files. Parent handles S3 upload. */
  readonly onImagePaste?: (files: File[]) => void;
  /** Called when user pastes non-image files. Parent handles S3 upload + node insert. */
  readonly onFilePaste?: (files: File[]) => void;
  /** Called when editor receives focus. */
  readonly onFocus?: () => void;
  /** Entry ID — passed to ImageAttachment extension for OCR feature. */
  readonly entryId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TiptapEditor — WYSIWYG rich text editor based on Tiptap/ProseMirror.
 *
 * Supports: rich text, code blocks with syntax highlighting,
 * images with attachment persistence, YouTube embeds with transcribe UI,
 * and file attachment nodes with download/delete.
 */
export function TiptapEditor({
  content,
  onUpdate,
  isExpanded = false,
  editable = true,
  placeholder = "Start writing...",
  editorRef,
  onImagePaste,
  onFilePaste,
  onFocus,
  entryId,
}: TiptapEditorProps) {
  // Track whether we should skip the next onUpdate (to avoid loops when setting content)
  const skipUpdateRef = useRef(false);
  // Track current content hash to avoid setting same content
  const contentHashRef = useRef<string>("");

  const editor = useEditor({
    // Prevent SSR hydration mismatch — Tiptap must only render on client
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable the built-in codeBlock in favour of CodeBlockLowlight
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      CodeBlockWithLineNumbers.configure({
        lowlight,
        defaultLanguage: null,
        languageClassPrefix: "language-",
      }),
      ImageAttachment.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "tiptap-image",
        },
      }),
      FileAttachment,
      YoutubeEmbed.configure({
        inline: false,
        HTMLAttributes: {
          class: "tiptap-youtube",
        },
      }),
    ],
    content: isValidContent(content) ? content : undefined,
    editable,
    editorProps: {
      attributes: {
        class: cn("tiptap", isExpanded && "is-expanded"),
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        const imageFiles: File[] = [];
        const otherFiles: File[] = [];

        for (const item of items) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (!file) continue;

            if (item.type.startsWith("image/")) {
              imageFiles.push(file);
            } else {
              otherFiles.push(file);
            }
          }
        }

        // Handle image paste
        if (imageFiles.length > 0 && onImagePaste) {
          event.preventDefault();
          onImagePaste(imageFiles);
          return true;
        }

        // Handle non-image file paste
        if (otherFiles.length > 0 && onFilePaste) {
          event.preventDefault();
          onFilePaste(otherFiles);
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (skipUpdateRef.current) {
        skipUpdateRef.current = false;
        return;
      }
      const json = ed.getJSON() as Record<string, unknown>;
      onUpdate(json);
    },
    onFocus: () => {
      onFocus?.();
    },
  });

  // Update editable when prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Pass entryId to extension storage (used by OCR and transcription features)
  useEffect(() => {
    if (editor && entryId) {
      // ImageAttachment extension storage (OCR feature)
      if (editor.storage.image) {
        editor.storage.image.entryId = entryId;
      }
      // YoutubeEmbed extension storage (transcription feature)
      if (editor.storage.youtube) {
        editor.storage.youtube.entryId = entryId;
      }
    }
  }, [editor, entryId]);

  // Update editor class when isExpanded changes
  useEffect(() => {
    if (editor) {
      editor.setOptions({
        editorProps: {
          attributes: {
            class: cn("tiptap", isExpanded && "is-expanded"),
          },
        },
      });
    }
  }, [editor, isExpanded]);

  // Sync external content changes (e.g., when entry changes from API)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const newHash = JSON.stringify(content);
    if (newHash === contentHashRef.current) return;
    contentHashRef.current = newHash;

    // Don't update if editor has focus (user is typing)
    if (editor.isFocused) return;

    const validContent = isValidContent(content) ? content : undefined;
    if (validContent) {
      skipUpdateRef.current = true;
      editor.commands.setContent(validContent);
      // Safety: Tiptap's setContent(content, false) sets preventUpdate meta,
      // which suppresses the onUpdate callback. Reset skipUpdateRef so the
      // first user edit is not silently dropped. The save-hash dedup in
      // runSave() prevents duplicate API calls if onUpdate somehow fires.
      skipUpdateRef.current = false;
    }
  }, [editor, content]);

  // Expose editor instance and commands via ref
  const insertImage = useCallback(
    (attrs: { src: string; alt?: string; attachmentId?: string }) => {
      if (!editor) return;
      editor.chain().focus().setImage(attrs).run();
    },
    [editor]
  );

  const insertCodeBlock = useCallback(
    (language?: string) => {
      if (!editor) return;
      // Use null to trigger lowlight's highlightAuto (auto-detect language)
      const lang = language || null;

      if (editor.isActive("codeBlock")) {
        // If already inside a code block, insert a new one AFTER the current one
        editor
          .chain()
          .focus()
          .command(({ tr, state }) => {
            const { $from } = state.selection;
            // Walk up to find the code block node
            for (let d = $from.depth; d > 0; d--) {
              const parentNode = $from.node(d);
              if (parentNode.type.name === "codeBlock") {
                const parentPos = $from.before(d);
                const endPos = parentPos + parentNode.nodeSize;
                // Insert a new code block after the current one
                const newBlock = state.schema.nodes.codeBlock.create(
                  { language: lang }
                );
                tr.insert(endPos, newBlock);
                return true;
              }
            }
            return false;
          })
          .run();
      } else {
        // Insert a new code block at cursor position
        editor
          .chain()
          .focus()
          .insertContent({
            type: "codeBlock",
            attrs: { language: lang },
          })
          .run();
      }
    },
    [editor]
  );

  const insertYoutube = useCallback(
    (url: string) => {
      if (!editor) return;
      editor.commands.setYoutubeVideo({ src: url });
    },
    [editor]
  );

  const insertFileNode = useCallback(
    (attrs: {
      attachmentId: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    }) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "fileAttachment",
          attrs,
        })
        .run();
    },
    [editor]
  );

  const syncYoutubeTranscriptions = useCallback(
    (transcriptions: Map<string, string>): Record<string, unknown> | null => {
      if (!editor || editor.isDestroyed || transcriptions.size === 0) return null;

      const { tr } = editor.state;
      let modified = false;

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "youtube" && node.attrs.src) {
          const serverText = transcriptions.get(node.attrs.src as string);
          if (serverText && !node.attrs.transcription) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              transcription: serverText,
            });
            modified = true;
          }
        }
      });

      if (!modified) return null;

      // Suppress onUpdate callback to avoid autosave loop
      skipUpdateRef.current = true;
      editor.view.dispatch(tr);
      skipUpdateRef.current = false;

      return editor.getJSON() as Record<string, unknown>;
    },
    [editor]
  );

  const syncImageVisionResults = useCallback(
    (
      visionResults: Map<string, { text: string; mode: string }>
    ): Record<string, unknown> | null => {
      if (!editor || editor.isDestroyed || visionResults.size === 0) return null;

      const { tr } = editor.state;
      let modified = false;

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "image" && node.attrs.attachmentId) {
          const entry = visionResults.get(node.attrs.attachmentId as string);
          if (entry && !node.attrs.visionResult) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              visionResult: entry.text,
              visionMode: entry.mode,
            });
            modified = true;
          }
        }
      });

      if (!modified) return null;

      skipUpdateRef.current = true;
      editor.view.dispatch(tr);
      skipUpdateRef.current = false;

      return editor.getJSON() as Record<string, unknown>;
    },
    [editor]
  );

  useImperativeHandle(
    editorRef,
    () => ({
      editor,
      insertImage,
      insertCodeBlock,
      insertYoutube,
      insertFileNode,
      syncYoutubeTranscriptions,
      syncImageVisionResults,
    }),
    [editor, insertImage, insertCodeBlock, insertYoutube, insertFileNode, syncYoutubeTranscriptions, syncImageVisionResults]
  );

  return (
    <div
      data-testid="tiptap-editor"
      className={cn("tiptap-editor", isExpanded && "is-expanded")}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if content is a valid TipTap JSON object. */
function isValidContent(content: Record<string, unknown>): boolean {
  return content && typeof content === "object" && Object.keys(content).length > 0;
}
