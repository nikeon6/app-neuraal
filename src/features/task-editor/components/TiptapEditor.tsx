"use client";

import React, {
  useEffect,
  useImperativeHandle,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
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

/** Extension storage we attach (image, youtube) for entryId. */
type ExtensionStorage = {
  image?: { entryId?: string };
  youtube?: { entryId?: string };
};

export interface TiptapEditorHandle {
  editor: ReturnType<typeof useEditor> | null;
  /** Insert an image node at the current cursor position. */
  insertImage: (attrs: {
    src: string;
    alt?: string;
    attachmentId?: string;
  }) => void;
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
  /** Insert a placeholder file node with uploading state. */
  insertUploadingFileNode: (attrs: {
    uploadId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }) => void;
  /** Finalize an uploading file node by replacing its attrs with the real attachment data. */
  finalizeFileNode: (uploadId: string, attrs: { attachmentId: string }) => void;
  /** Remove an uploading file node (on error). */
  removeUploadingFileNode: (uploadId: string) => void;
  /**
   * Inject transcription text into YouTube nodes, keyed by src URL.
   * This uses a ProseMirror transaction without triggering onUpdate
   * to avoid autosave loops. Returns the updated JSON if any node was modified.
   */
  syncYoutubeTranscriptions: (
    transcriptions: Map<string, string>,
  ) => Record<string, unknown> | null;
  /**
   * Inject vision results into image nodes, keyed by attachmentId.
   * Like syncYoutubeTranscriptions, suppresses onUpdate to avoid loops.
   */
  syncImageVisionResults: (
    visionResults: Map<string, { text: string; mode: string }>,
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
 *
 * Wrapped in React.memo to prevent re-renders triggered by Framer Motion's
 * MotionContext propagation during drag-reorder. Without this, Reorder.Item
 * layout animations cause context updates that cascade through motion
 * components, eventually re-rendering EditorContent. TipTap's
 * ReactNodeViewRenderer then calls flushSync during React's render cycle,
 * corrupting image NodeViews. The memo boundary ensures TiptapEditor only
 * re-renders when its own props actually change.
 */
export const TiptapEditor = React.memo(function TiptapEditor({
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
  const onImagePasteRef = useRef<typeof onImagePaste>(onImagePaste);
  const onFilePasteRef = useRef<typeof onFilePaste>(onFilePaste);

  useEffect(() => {
    onImagePasteRef.current = onImagePaste;
  }, [onImagePaste]);

  useEffect(() => {
    onFilePasteRef.current = onFilePaste;
  }, [onFilePaste]);

  const handlePaste = useCallback((_view: unknown, event: ClipboardEvent) => {
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
    if (imageFiles.length > 0 && onImagePasteRef.current) {
      event.preventDefault();
      onImagePasteRef.current(imageFiles);
      return true;
    }

    // Handle non-image file paste
    if (otherFiles.length > 0 && onFilePasteRef.current) {
      event.preventDefault();
      onFilePasteRef.current(otherFiles);
      return true;
    }

    return false;
  }, []);

  /**
   * Handle file drop from external sources (e.g. OS file explorer, another browser window).
   * The `moved` flag is true for internal ProseMirror node drags — those are left
   * untouched so the editor's native drag behaviour continues to work correctly.
   */
  const handleDrop = useCallback(
    (_view: unknown, event: DragEvent, _slice: unknown, moved: boolean) => {
      // Internal node drag (e.g. reordering inside the editor) — let ProseMirror handle it
      if (moved) return false;

      const files = event.dataTransfer?.files;
      if (!files?.length) return false;

      const imageFiles: File[] = [];
      const otherFiles: File[] = [];

      for (const file of files) {
        if (file.type.startsWith("image/")) {
          imageFiles.push(file);
        } else {
          otherFiles.push(file);
        }
      }

      // Handle dropped images
      if (imageFiles.length > 0 && onImagePasteRef.current) {
        event.preventDefault();
        onImagePasteRef.current(imageFiles);
        return true;
      }

      // Handle dropped non-image files
      if (otherFiles.length > 0 && onFilePasteRef.current) {
        event.preventDefault();
        onFilePasteRef.current(otherFiles);
        return true;
      }

      return false;
    },
    [],
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        // Disable the built-in codeBlock in favour of CodeBlockLowlight
        codeBlock: false,
        // We configure Link explicitly below; disable StarterKit's copy
        // to avoid duplicate extension registration warnings in tests/runtime.
        link: false,
      }),
      // Note: Underline is included in StarterKit v3, no need to add separately
      Placeholder.configure({
        placeholder,
      }),
      CodeBlockWithLineNumbers.configure({
        lowlight,
        defaultLanguage: null,
        languageClassPrefix: "language-",
      }),
      Link.configure({
        // Don't open on simple click (user may be editing).
        // Use Ctrl/Cmd + click to open links in a new tab.
        openOnClick: false,
        // Automatically detect and linkify URLs as the user types.
        autolink: true,
        HTMLAttributes: {
          class: "tiptap-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
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
    [placeholder],
  );

  /**
   * Open links with Ctrl/Cmd + click so the editor can remain editable on
   * plain click (selecting, positioning cursor, etc.).
   */
  const handleClick = useCallback(
    (_view: unknown, _pos: number, event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        const target = event.target as HTMLElement;
        const anchor = target.closest("a");
        if (anchor?.href) {
          window.open(anchor.href, "_blank", "noopener,noreferrer");
          return true;
        }
      }
      return false;
    },
    [],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "tiptap",
      },
      handlePaste,
      handleDrop,
      handleClick,
    }),
    [handlePaste, handleDrop, handleClick],
  );

  const editor = useEditor(
    {
      // Prevent SSR hydration mismatch — Tiptap must only render on client
      immediatelyRender: false,
      extensions,
      content: isValidContent(content) ? content : undefined,
      editable,
      editorProps,
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
    },
    [extensions, editorProps],
  );

  // Update editable when prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Keep expanded styling in sync without recreating editor options/deps.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dom.classList.toggle("is-expanded", isExpanded);
  }, [editor, isExpanded]);

  // Update placeholder when prop changes (e.g. task ↔ note toggle)
  useEffect(() => {
    if (!editor) return;
    const placeholderExt = editor.extensionManager.extensions.find(
      (ext) => ext.name === "placeholder",
    );
    if (placeholderExt) {
      placeholderExt.options.placeholder = placeholder;
      // Force re-render so Tiptap picks up the new placeholder text
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, placeholder]);

  // Pass entryId to extension storage (used by OCR and transcription features)
  useEffect(() => {
    if (editor && entryId) {
      const storage = editor.storage as ExtensionStorage;
      if (storage.image) storage.image.entryId = entryId;
      if (storage.youtube) storage.youtube.entryId = entryId;
    }
  }, [editor, entryId]);

  // ---------------------------------------------------------------------------
  // Scroll containment — prevent ProseMirror from scrolling ancestor
  // containers (TasksContainer, page body) during normal editing operations.
  //
  // Two separate mechanisms can cause unwanted scroll in ancestor containers:
  //
  // 1. scrollToSelection(): ProseMirror calls this after transactions with
  //    scrollIntoView (e.g., deleting a large image/video node). It walks up
  //    the DOM and adjusts scrollTop on every scrollable ancestor, which can
  //    shift the entire page layout.
  //
  // 2. view.dom.focus(): When ProseMirror regains focus (e.g., user clicked
  //    the title input, then clicks back on the editor), it calls
  //    this.dom.focus() which triggers the browser's native scroll-into-view
  //    behavior. This happens BEFORE scrollToSelection and cannot be caught
  //    by patching scrollToSelection alone.
  //
  // We patch both methods to keep scroll effects contained within the editor.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    type ViewWithScrollToSelection = typeof editor.view & {
      scrollToSelection: () => void;
    };
    const view = editor.view as ViewWithScrollToSelection;

    // --- Patch 1: scrollToSelection ---
    const originalScroll = view.scrollToSelection.bind(view);

    view.scrollToSelection = function patchedScrollToSelection() {
      // Save scroll positions of all scrollable ancestors + window
      const savedScrolls: Array<{
        el: Element;
        top: number;
        left: number;
      }> = [];
      let ancestor: Element | null = view.dom.parentElement;
      while (ancestor) {
        if (ancestor.scrollHeight > ancestor.clientHeight) {
          savedScrolls.push({
            el: ancestor,
            top: ancestor.scrollTop,
            left: ancestor.scrollLeft,
          });
        }
        ancestor = ancestor.parentElement;
      }
      const pageX = window.scrollX;
      const pageY = window.scrollY;

      // Let ProseMirror scroll within the editor itself.
      // In jsdom-based tests, ProseMirror can throw when selection targets do
      // not implement getClientRects; skip only that known non-browser case.
      try {
        originalScroll();
      } catch (error) {
        if (
          error instanceof TypeError &&
          String(error.message).includes("getClientRects")
        ) {
          return;
        }
        throw error;
      }

      // Restore ancestor scroll positions to prevent layout shift
      for (const s of savedScrolls) {
        if (s.el.scrollTop !== s.top) s.el.scrollTop = s.top;
        if (s.el.scrollLeft !== s.left) s.el.scrollLeft = s.left;
      }
      if (window.scrollX !== pageX || window.scrollY !== pageY) {
        window.scrollTo(pageX, pageY);
      }
    };

    // --- Patch 2: dom.focus (prevent native browser focus-scroll) ---
    // HTMLElement.focus is defined on the prototype, so we need
    // Object.defineProperty to override it on the instance.
    const editorDom = view.dom;
    const originalFocus = editorDom.focus.bind(editorDom);

    Object.defineProperty(editorDom, "focus", {
      value: function patchedFocus(options?: FocusOptions) {
        originalFocus({ ...options, preventScroll: true });
      },
      writable: true,
      configurable: true,
    });

    return () => {
      // Restore original methods on cleanup
      if (!view.isDestroyed) {
        view.scrollToSelection = originalScroll;
      }
      // Remove the instance override so the prototype method is used again
      Reflect.deleteProperty(editorDom, "focus");
    };
  }, [editor]);

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
    [editor],
  );

  const insertCodeBlock = useCallback(
    (language: string | null = null) => {
      if (!editor) return;
      // Use null to trigger lowlight's highlightAuto (auto-detect language)
      const lang = language;

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
                const newBlock = state.schema.nodes.codeBlock.create({
                  language: lang,
                });
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
    [editor],
  );

  const insertYoutube = useCallback(
    (url: string) => {
      if (!editor) return;
      editor.commands.setYoutubeVideo({ src: url });
    },
    [editor],
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
    [editor],
  );

  const insertUploadingFileNode = useCallback(
    (attrs: {
      uploadId: string;
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
          attrs: { ...attrs, uploading: true, attachmentId: null },
        })
        .run();
    },
    [editor],
  );

  const finalizeFileNode = useCallback(
    (uploadId: string, attrs: { attachmentId: string }) => {
      if (!editor) return;
      const { tr } = editor.state;
      let updated = false;
      editor.state.doc.descendants((n, pos) => {
        if (
          !updated &&
          n.type.name === "fileAttachment" &&
          n.attrs.uploadId === uploadId
        ) {
          tr.setNodeMarkup(pos, undefined, {
            ...n.attrs,
            ...attrs,
            uploading: false,
            uploadId: null,
          });
          updated = true;
        }
      });
      if (updated) editor.view.dispatch(tr);
    },
    [editor],
  );

  const removeUploadingFileNode = useCallback(
    (uploadId: string) => {
      if (!editor) return;
      const { tr } = editor.state;
      let removed = false;
      editor.state.doc.descendants((n, pos) => {
        if (
          !removed &&
          n.type.name === "fileAttachment" &&
          n.attrs.uploadId === uploadId
        ) {
          tr.delete(pos, pos + n.nodeSize);
          removed = true;
        }
      });
      if (removed) editor.view.dispatch(tr);
    },
    [editor],
  );

  const syncYoutubeTranscriptions = useCallback(
    (transcriptions: Map<string, string>): Record<string, unknown> | null => {
      if (!editor || editor.isDestroyed || transcriptions.size === 0)
        return null;

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
    [editor],
  );

  const syncImageVisionResults = useCallback(
    (
      visionResults: Map<string, { text: string; mode: string }>,
    ): Record<string, unknown> | null => {
      if (!editor || editor.isDestroyed || visionResults.size === 0)
        return null;

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
    [editor],
  );

  useImperativeHandle(
    editorRef,
    () => ({
      editor,
      insertImage,
      insertCodeBlock,
      insertYoutube,
      insertFileNode,
      insertUploadingFileNode,
      finalizeFileNode,
      removeUploadingFileNode,
      syncYoutubeTranscriptions,
      syncImageVisionResults,
    }),
    [
      editor,
      insertImage,
      insertCodeBlock,
      insertYoutube,
      insertFileNode,
      insertUploadingFileNode,
      finalizeFileNode,
      removeUploadingFileNode,
      syncYoutubeTranscriptions,
      syncImageVisionResults,
    ],
  );

  return (
    <div
      data-testid="tiptap-editor"
      aria-label="Rich text editor"
      className={cn("tiptap-editor", isExpanded && "is-expanded")}
    >
      <EditorContent editor={editor} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if content is a valid TipTap JSON object. */
function isValidContent(content: Record<string, unknown>): boolean {
  return (
    content && typeof content === "object" && Object.keys(content).length > 0
  );
}
