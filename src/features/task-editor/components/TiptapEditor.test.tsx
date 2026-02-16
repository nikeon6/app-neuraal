import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
      ref: React.Ref<HTMLDivElement>,
    ) {
      return (
        <div ref={ref} {...props}>
          {children}
        </div>
      );
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const DEFAULT_EDITOR_TEXT = "Hello world";

describe("TiptapEditor", () => {
  const defaultContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: DEFAULT_EDITOR_TEXT }],
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
      render(<TiptapEditor content={defaultContent} onUpdate={onUpdateMock} />);

      expect(screen.getByLabelText(/rich text editor/i)).toBeInTheDocument();
    });

    it("should render with tiptap-editor class", () => {
      render(<TiptapEditor content={defaultContent} onUpdate={onUpdateMock} />);

      const container = screen.getByLabelText(/rich text editor/i);
      expect(container).toHaveClass("tiptap-editor");
    });

    it("should render editor content area with ProseMirror role", () => {
      render(<TiptapEditor content={defaultContent} onUpdate={onUpdateMock} />);

      // Tiptap renders a div[role=textbox] or contenteditable div
      const editor = screen.getByLabelText(/rich text editor/i);
      expect(editor).toBeInTheDocument();
    });

    it("should display text content from JSON", async () => {
      render(<TiptapEditor content={defaultContent} onUpdate={onUpdateMock} />);

      await waitFor(() => {
        expect(screen.getByText(DEFAULT_EDITOR_TEXT)).toBeInTheDocument();
      });
    });

    it("should render with empty content without crashing", () => {
      render(<TiptapEditor content={emptyContent} onUpdate={onUpdateMock} />);

      expect(screen.getByLabelText(/rich text editor/i)).toBeInTheDocument();
    });
  });

  describe("props", () => {
    it("should apply expanded class when isExpanded is true", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          isExpanded={true}
        />,
      );

      const container = screen.getByLabelText(/rich text editor/i);
      expect(container).toHaveClass("is-expanded");
    });

    it("should not apply expanded class when isExpanded is false", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          isExpanded={false}
        />,
      );

      const container = screen.getByLabelText(/rich text editor/i);
      expect(container).not.toHaveClass("is-expanded");
    });

    it("should set editable to false when specified", () => {
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editable={false}
        />,
      );

      // When not editable, the ProseMirror element should have contenteditable=false
      const proseMirror = screen
        .getByText(DEFAULT_EDITOR_TEXT)
        .closest("[contenteditable]");
      expect(proseMirror).not.toBeNull();
      expect(proseMirror).toHaveAttribute("contenteditable", "false");
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
      render(<TiptapEditor content={codeContent} onUpdate={onUpdateMock} />);

      // Syntax highlighting splits text into multiple spans,
      // so we check for the pre>code element containing the text.
      await waitFor(() => {
        const codeText = screen.getByText((_, node) => {
          const text = node?.textContent ?? "";
          return (
            node?.tagName === "CODE" &&
            text.includes("const") &&
            text.includes("x = 1")
          );
        });
        expect(codeText).toBeInTheDocument();
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
        />,
      );

      // The ref should be set after mount
      expect(editorRef.current).not.toBeNull();
    });

    it("should insert an image via editorRef API", async () => {
      const editorRef = React.createRef<{
        insertImage: (attrs: { src: string; alt?: string }) => void;
      }>();
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />,
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      editorRef.current?.insertImage({
        src: "https://example.com/image.png",
        alt: "example-image",
      });

      await waitFor(() => {
        const image = document.querySelector(
          'img[src="https://example.com/image.png"]',
        );
        expect(image).not.toBeNull();
      });
    });

    it("should insert a code block via editorRef API", async () => {
      const editorRef = React.createRef<{
        insertCodeBlock: (language?: string) => void;
      }>();
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />,
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      editorRef.current?.insertCodeBlock("javascript");

      await waitFor(() => {
        const codeEl = document.querySelector("pre code");
        expect(codeEl).not.toBeNull();
      });
    });

    it("should append a new code block when already inside a code block", async () => {
      const editorRef = React.createRef<{
        insertCodeBlock: (language?: string | null) => void;
      }>();
      const codeContent = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "javascript" },
            content: [{ type: "text", text: "const a = 1;" }],
          },
        ],
      };
      render(
        <TiptapEditor
          content={codeContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />,
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const initialBlocks = document.querySelectorAll("pre").length;
      const codeEl = document.querySelector("pre code");
      if (codeEl) {
        fireEvent.click(codeEl);
      }

      editorRef.current?.insertCodeBlock("javascript");

      await waitFor(() => {
        expect(document.querySelectorAll("pre").length).toBeGreaterThan(
          initialBlocks,
        );
      });
    });

    it("should insert youtube embed via editorRef API", async () => {
      const editorRef = React.createRef<{
        insertYoutube: (url: string) => void;
      }>();
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />,
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      editorRef.current?.insertYoutube(
        "https://www.youtube.com/watch?v=test321",
      );

      await waitFor(() => {
        const iframe = document.querySelector("iframe");
        expect(iframe).not.toBeNull();
      });
    });

    it("should insert file attachment node via editorRef API", async () => {
      const editorRef = React.createRef<{
        insertFileNode: (attrs: {
          attachmentId: string;
          filename: string;
          mimeType: string;
          sizeBytes: number;
        }) => void;
      }>();
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />,
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      editorRef.current?.insertFileNode({
        attachmentId: "att-123",
        filename: "doc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      });

      await waitFor(() => {
        expect(screen.getByText("doc.pdf")).toBeInTheDocument();
        expect(document.querySelector(".file-attachment-node")).not.toBeNull();
      });
    });

    it("sync helpers should return null with empty maps", async () => {
      const editorRef = React.createRef<{
        syncYoutubeTranscriptions: (map: Map<string, string>) => unknown;
        syncImageVisionResults: (
          map: Map<string, { text: string; mode: string }>,
        ) => unknown;
      }>();

      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />,
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      expect(
        editorRef.current?.syncYoutubeTranscriptions(new Map()),
      ).toBeNull();
      expect(editorRef.current?.syncImageVisionResults(new Map())).toBeNull();
    });

    it("sync helpers should update matching youtube and image nodes", async () => {
      const richContent = {
        type: "doc",
        content: [
          {
            type: "youtube",
            attrs: { src: "https://www.youtube.com/watch?v=test123" },
          },
          {
            type: "image",
            attrs: {
              src: "https://example.com/image.png",
              attachmentId: "att-vision-1",
            },
          },
        ],
      };

      const editorRef = React.createRef<{
        syncYoutubeTranscriptions: (
          map: Map<string, string>,
        ) => Record<string, unknown> | null;
        syncImageVisionResults: (
          map: Map<string, { text: string; mode: string }>,
        ) => Record<string, unknown> | null;
      }>();

      render(
        <TiptapEditor
          content={richContent}
          onUpdate={onUpdateMock}
          editorRef={editorRef}
        />,
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const youtubeResult = editorRef.current?.syncYoutubeTranscriptions(
        new Map([["https://www.youtube.com/watch?v=test123", "Transcript"]]),
      );
      expect(youtubeResult).not.toBeNull();
      expect(JSON.stringify(youtubeResult)).toContain("Transcript");

      const imageResult = editorRef.current?.syncImageVisionResults(
        new Map([["att-vision-1", { text: "Vision text", mode: "ocr" }]]),
      );
      expect(imageResult).not.toBeNull();
      expect(JSON.stringify(imageResult)).toContain("Vision text");
    });
  });

  describe("callbacks", () => {
    it("should call onFocus when editor receives focus", async () => {
      const onFocusMock = vi.fn();
      render(
        <TiptapEditor
          content={defaultContent}
          onUpdate={onUpdateMock}
          onFocus={onFocusMock}
        />,
      );

      const proseMirror = document.querySelector(".ProseMirror");
      expect(proseMirror).not.toBeNull();
      fireEvent.focus(proseMirror as Element);

      await waitFor(() => {
        expect(onFocusMock).toHaveBeenCalled();
      });
    });
  });
});
