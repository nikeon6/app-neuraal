import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ImageAttachmentComponent } from "./ImageAttachmentComponent";
import * as entriesSdk from "@/shared/api/sdk/entries";

let pendingValue = 0;
let pendingListener: ((pending: number) => void) | null = null;
const enqueueMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock("@tiptap/react", () => ({
  NodeViewWrapper: ({ children, ...rest }: { children: React.ReactNode }) => (
    <div data-testid="node-view-wrapper" {...rest}>
      {children}
    </div>
  ),
}));

vi.mock("@/shared/api/sdk/entries", () => ({
  analyzeImage: vi.fn(),
}));

vi.mock("@/shared/lib/visionQueue", () => ({
  visionQueue: {
    get pending() {
      return pendingValue;
    },
    enqueue: (...args: unknown[]) => enqueueMock(...args),
    onPendingChange: (cb: (pending: number) => void) => {
      pendingListener = cb;
      return unsubscribeMock;
    },
  },
}));

const analyzeImageMock = vi.mocked(entriesSdk.analyzeImage);

function createEditorMock(entryId = "entry-1") {
  const setNodeMarkup = vi.fn();
  const dispatch = vi.fn();
  const nodeAt = vi.fn().mockReturnValue({
    type: { name: "image" },
    attrs: { src: "https://example.com/image.png", attachmentId: "att-1" },
  });

  return {
    editor: {
      isDestroyed: false,
      storage: { imageAttachment: { entryId } },
      state: { doc: { nodeAt }, tr: { setNodeMarkup } },
      view: { dispatch },
    },
    spies: { setNodeMarkup, dispatch, nodeAt },
  };
}

function renderComponent(opts?: {
  uploading?: boolean;
  visionResult?: string;
  attachmentId?: string;
  deleteNode?: () => void;
  entryId?: string;
}) {
  const { editor, spies } = createEditorMock(opts?.entryId);
  const deleteNode = opts?.deleteNode ?? vi.fn();
  const node = {
    attrs: {
      src: "https://example.com/image.png",
      alt: "img",
      uploading: opts?.uploading ?? false,
      attachmentId: opts?.attachmentId ?? "att-1",
      visionResult: opts?.visionResult ?? "",
      visionMode: null,
    },
  };

  const view = render(
    <ImageAttachmentComponent
      node={node as never}
      deleteNode={deleteNode}
      selected={false}
      editor={editor as never}
      getPos={(() => 5) as never}
      decorations={[] as never}
      extension={undefined as never}
      HTMLAttributes={{} as never}
      updateAttributes={vi.fn() as never}
    />,
  );

  return { ...view, spies, deleteNode };
}

describe("ImageAttachmentComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingValue = 0;
    pendingListener = null;
    enqueueMock.mockImplementation(async (task: () => Promise<unknown>) =>
      task(),
    );
  });

  it("shows uploading overlay and hides vision action buttons", () => {
    renderComponent({ uploading: true });
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /scan/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /describe/i }),
    ).not.toBeInTheDocument();
  });

  it("runs scan analysis, renders result, and persists attrs to node", async () => {
    analyzeImageMock.mockResolvedValue({
      extractedText: "detected text",
    } as never);
    const { spies } = renderComponent();

    fireEvent.mouseDown(screen.getByRole("button", { name: /scan/i }));

    await waitFor(() => {
      expect(analyzeImageMock).toHaveBeenCalledWith("entry-1", "att-1", "scan");
      expect(screen.getByText(/neuraal vision/i)).toBeInTheDocument();
      expect(screen.getByText("detected text")).toBeInTheDocument();
    });
    expect(spies.nodeAt).toHaveBeenCalledWith(5);
    expect(spies.setNodeMarkup).toHaveBeenCalled();
    expect(spies.dispatch).toHaveBeenCalled();
  });

  it("shows queued overlay label when queue already has pending tasks", async () => {
    pendingValue = 2;
    enqueueMock.mockImplementation(
      () => new Promise(() => {}) as Promise<{ extractedText: string }>,
    );
    renderComponent();

    fireEvent.mouseDown(screen.getByRole("button", { name: /describe/i }));

    await waitFor(() => {
      expect(screen.getByText(/queued \(2 ahead\)\.\.\./i)).toBeInTheDocument();
    });

    if (pendingListener) {
      act(() => {
        pendingListener?.(3);
      });
    }
    await waitFor(() => {
      expect(screen.getByText(/queued \(2 ahead\)\.\.\./i)).toBeInTheDocument();
    });
  });

  it("shows error and retries vision request", async () => {
    analyzeImageMock
      .mockRejectedValueOnce(new Error("vision offline"))
      .mockResolvedValueOnce({ extractedText: "retry ok" } as never);
    renderComponent();

    fireEvent.mouseDown(screen.getByRole("button", { name: /scan/i }));

    await waitFor(() => {
      expect(screen.getByText(/neuraal vision — failed/i)).toBeInTheDocument();
      expect(screen.getByText("vision offline")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText("retry ok")).toBeInTheDocument();
      expect(analyzeImageMock).toHaveBeenCalledTimes(2);
    });
  });

  it("copies vision text to clipboard and deletes node", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const deleteNode = vi.fn();

    renderComponent({ visionResult: "from server", deleteNode });
    fireEvent.mouseDown(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("from server");
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTitle(/remove image/i));
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });
});
