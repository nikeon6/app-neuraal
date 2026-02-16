import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MinimalTiptapEditor } from "./MinimalTiptapEditor";

type UseEditorOptions = {
  content?: Record<string, unknown>;
  editable?: boolean;
  onUpdate?: (ctx: {
    editor: { getJSON: () => Record<string, unknown> };
  }) => void;
  onFocus?: () => void;
};

const mockSetEditable = vi.fn();
const mockSetContent = vi.fn();
const mockGetJSON = vi.fn(() => ({ type: "doc", content: [] }));

let currentUseEditorOptions: UseEditorOptions | null = null;
let isFocusedState = false;
let isDestroyedState = false;
let useNullEditorState = false;

vi.mock("@tiptap/react", () => ({
  useEditor: (options: UseEditorOptions) => {
    currentUseEditorOptions = options;
    if (useNullEditorState) {
      return null;
    }
    return {
      isDestroyed: isDestroyedState,
      isFocused: isFocusedState,
      setEditable: mockSetEditable,
      getJSON: mockGetJSON,
      commands: {
        setContent: mockSetContent,
      },
    };
  },
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content">{editor ? "ready" : "empty"}</div>
  ),
}));

describe("MinimalTiptapEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUseEditorOptions = null;
    isFocusedState = false;
    isDestroyedState = false;
    useNullEditorState = false;
  });

  it("renders editor container", () => {
    render(<MinimalTiptapEditor content={{}} onUpdate={vi.fn()} />);
    expect(screen.getByTestId("minimal-tiptap-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-content")).toHaveTextContent("ready");
  });

  it("renders empty editor content when useEditor returns null", () => {
    useNullEditorState = true;
    render(<MinimalTiptapEditor content={{}} onUpdate={vi.fn()} />);
    expect(screen.getByTestId("editor-content")).toHaveTextContent("empty");
    expect(mockSetEditable).not.toHaveBeenCalled();
  });

  it("applies expanded class when isExpanded is true", () => {
    render(
      <MinimalTiptapEditor content={{}} onUpdate={vi.fn()} isExpanded={true} />,
    );
    expect(screen.getByTestId("minimal-tiptap-editor")).toHaveClass(
      "is-expanded",
    );
  });

  it("passes undefined content to useEditor when content is empty object", () => {
    render(<MinimalTiptapEditor content={{}} onUpdate={vi.fn()} />);
    expect(currentUseEditorOptions?.content).toBeUndefined();
  });

  it("passes content to useEditor when content is valid", () => {
    const content = { type: "doc", content: [{ type: "paragraph" }] };
    render(<MinimalTiptapEditor content={content} onUpdate={vi.fn()} />);
    expect(currentUseEditorOptions?.content).toEqual(content);
  });

  it("calls setEditable when editable prop changes", () => {
    const { rerender } = render(
      <MinimalTiptapEditor content={{}} onUpdate={vi.fn()} editable={true} />,
    );
    expect(mockSetEditable).toHaveBeenCalledWith(true);

    rerender(
      <MinimalTiptapEditor content={{}} onUpdate={vi.fn()} editable={false} />,
    );
    expect(mockSetEditable).toHaveBeenCalledWith(false);
  });

  it("syncs content via commands.setContent when not focused", () => {
    const { rerender } = render(
      <MinimalTiptapEditor content={{}} onUpdate={vi.fn()} />,
    );
    const newContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    };

    rerender(<MinimalTiptapEditor content={newContent} onUpdate={vi.fn()} />);
    expect(mockSetContent).toHaveBeenCalledWith(newContent);
  });

  it("does not sync content when editor is focused", () => {
    const { rerender } = render(
      <MinimalTiptapEditor content={{}} onUpdate={vi.fn()} />,
    );
    isFocusedState = true;
    const newContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    };
    rerender(<MinimalTiptapEditor content={newContent} onUpdate={vi.fn()} />);

    expect(mockSetContent).not.toHaveBeenCalled();
  });

  it("does not sync content when editor is destroyed", () => {
    const { rerender } = render(
      <MinimalTiptapEditor content={{}} onUpdate={vi.fn()} />,
    );
    isDestroyedState = true;
    const newContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    };
    rerender(<MinimalTiptapEditor content={newContent} onUpdate={vi.fn()} />);

    expect(mockSetContent).not.toHaveBeenCalled();
  });

  it("forwards onFocus callback from editor options", () => {
    const onFocus = vi.fn();
    render(
      <MinimalTiptapEditor content={{}} onUpdate={vi.fn()} onFocus={onFocus} />,
    );
    currentUseEditorOptions?.onFocus?.();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("forwards onUpdate callback with editor JSON", () => {
    const onUpdate = vi.fn();
    render(<MinimalTiptapEditor content={{}} onUpdate={onUpdate} />);
    currentUseEditorOptions?.onUpdate?.({
      editor: {
        getJSON: () => ({ type: "doc", content: [{ type: "paragraph" }] }),
      },
    });
    expect(onUpdate).toHaveBeenCalledWith({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("skips bubbling onUpdate while syncing external content", () => {
    const onUpdate = vi.fn();
    mockSetContent.mockImplementationOnce(() => {
      currentUseEditorOptions?.onUpdate?.({
        editor: {
          getJSON: () => ({ type: "doc", content: [{ type: "paragraph" }] }),
        },
      });
    });

    const { rerender } = render(
      <MinimalTiptapEditor content={{}} onUpdate={onUpdate} />,
    );
    const newContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    };
    rerender(<MinimalTiptapEditor content={newContent} onUpdate={onUpdate} />);

    expect(mockSetContent).toHaveBeenCalledWith(newContent);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
