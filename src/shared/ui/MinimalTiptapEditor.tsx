"use client";

import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { cn } from "@/shared/lib";
import "./minimal-tiptap.css";

const lowlight = createLowlight(common);

export interface MinimalTiptapEditorHandle {
  editor: ReturnType<typeof useEditor> | null;
}

export interface MinimalTiptapEditorProps {
  readonly content: Record<string, unknown>;
  readonly onUpdate: (json: Record<string, unknown>) => void;
  readonly isExpanded?: boolean;
  readonly editable?: boolean;
  readonly placeholder?: string;
  readonly onFocus?: () => void;
  readonly editorRef?: React.Ref<MinimalTiptapEditorHandle>;
}

function isValidContent(content: Record<string, unknown>): boolean {
  return (
    content && typeof content === "object" && Object.keys(content).length > 0
  );
}

/**
 * Minimal Tiptap editor: text + code blocks only (no images, files, YouTube).
 * Used by StickyEditor to avoid cross-feature imports from task-editor.
 *
 * Wrapped in React.memo to prevent unnecessary re-renders during Framer
 * Motion drag-reorder, which can trigger TipTap's flushSync conflict.
 */
export const MinimalTiptapEditor = React.memo(function MinimalTiptapEditor({
  content,
  onUpdate,
  isExpanded = false,
  editable = true,
  placeholder = "Start writing...",
  onFocus,
  editorRef,
}: MinimalTiptapEditorProps) {
  const skipUpdateRef = useRef(false);
  const contentHashRef = useRef<string>("");

  const extensions = useMemo(
    () => [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: null,
        HTMLAttributes: { class: "minimal-tiptap-code" },
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: isValidContent(content) ? content : undefined,
    editable,
    editorProps: {
      attributes: {
        class: cn("tiptap minimal-tiptap", isExpanded && "is-expanded"),
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (skipUpdateRef.current) {
        skipUpdateRef.current = false;
        return;
      }
      onUpdate(ed.getJSON() as Record<string, unknown>);
    },
    onFocus: () => onFocus?.(),
  });

  useImperativeHandle(editorRef, () => ({ editor }), [editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const newHash = JSON.stringify(content);
    if (newHash === contentHashRef.current) return;
    contentHashRef.current = newHash;
    if (editor.isFocused) return;
    if (isValidContent(content)) {
      skipUpdateRef.current = true;
      editor.commands.setContent(content);
      skipUpdateRef.current = false;
    }
  }, [editor, content]);

  return (
    <div
      data-testid="minimal-tiptap-editor"
      className={cn("minimal-tiptap-editor", isExpanded && "is-expanded")}
    >
      <EditorContent editor={editor} />
    </div>
  );
});
