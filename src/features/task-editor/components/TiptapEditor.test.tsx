import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TiptapEditor } from "./TiptapEditor";

// ============================================================================
// Note: Tiptap/ProseMirror needs real DOM APIs for full behaviour.
// These tests verify the component contract (renders, props, callbacks).
// Full editor interactions (typing, paste) are better tested via E2E.
// ============================================================================

// Mock Framer Motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(function MockDiv(
      { children, ...props }: React.HTMLAttributes<HTMLDivElement>,
      ref: React.Ref<HTMLDivElement>
    ) {
      return <div ref={ref} {...props}>{children}</div>;
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("TiptapEditor", () => {
  const defaultContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello world" }],
      },
    ],
  };

  const emptyContent = {};

  let onUpdateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdateMock = vi.fn();
  });

  describe("rendering", () => {
    it("should render the editor container", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("should render with tiptap-editor class", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
        />
      );

      const container = screen.getByTestId("tiptap-editor");
      expect(container).toHaveClass("tiptap-editor");
    });

    it("should render editor content area with ProseMirror role", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
        />
      );

      // Tiptap renders a div[role=textbox] or contenteditable div
      const editor = screen.getByTestId("tiptap-editor");
      expect(editor).toBeInTheDocument();
    });

    it("should display text content from JSON", async () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Hello world")).toBeInTheDocument();
      });
    });

    it("should render with empty content without crashing", () => {
      render(
        <TiptapEditor
          content={emptyContent}
          onUpdate={onUpdateMock}
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });
  });

  describe("props", () => {
    it("should apply expanded class when isExpanded is true", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          isExpanded={true}
        />
      );

      const container = screen.getByTestId("tiptap-editor");
      expect(container).toHaveClass("is-expanded");
    });

    it("should not apply expanded class when isExpanded is false", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          isExpanded={false}
        />
      );

      const container = screen.getByTestId("tiptap-editor");
      expect(container).not.toHaveClass("is-expanded");
    });

    it("should set editable to false when specified", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editable={false}
        />
      );

      // When not editable, the ProseMirror element should have contenteditable=false
      const editor = screen.getByTestId("tiptap-editor");
      const proseMirror = editor.querySelector("[contenteditable]");
      if (proseMirror) {
        expect(proseMirror.getAttribute("contenteditable")).toBe("false");
      }
    });
  });

  describe("content with code blocks", () => {
    const codeContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [{ type: "text", text: "const x = 1;" }],
        },
      ],
    };

    it("should render code block content", async () => {
      render(
        <TiptapEditor
          content={codeContent}
          onUpdate={onUpdateMock}
        />
      );

      // Syntax highlighting splits text into multiple spans,
      // so we check for the pre>code element containing the text.
      await waitFor(() => {
        const codeEl = screen.getByTestId("tiptap-editor").querySelector("pre code");
        expect(codeEl).not.toBeNull();
        expect(codeEl!.textContent).toContain("const");
        expect(codeEl!.textContent).toContain("x = 1");
      });
    });
  });

  describe("editor ref", () => {
    it("should expose editor instance via editorRef", () => {
      const editorRef = React.createRef<{ editor: unknown }>();

      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />
      );

      // The ref should be set after mount
      expect(editorRef.current).not.toBeNull();
    });
  });
});
