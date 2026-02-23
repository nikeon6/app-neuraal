import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { YoutubeEmbedComponent } from "./YoutubeEmbedComponent";
import { requestTranscriptionAndInvalidate } from "@/shared/api/mutations";

vi.mock("@tiptap/react", () => ({
  NodeViewWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-view-wrapper">{children}</div>
  ),
}));

vi.mock("@/shared/api/mutations", () => ({
  requestTranscriptionAndInvalidate: vi.fn(),
}));

const mockRequestTranscription = vi.mocked(requestTranscriptionAndInvalidate);

function createEditor(entryId = "entry-1") {
  return {
    storage: {
      youtube: { entryId },
    },
  };
}

function renderComponent(opts?: {
  src?: string;
  transcription?: string;
  deleteNode?: () => void;
  editor?: ReturnType<typeof createEditor>;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const deleteNode = opts?.deleteNode ?? vi.fn();
  const editor = opts?.editor ?? createEditor();
  const node = {
    attrs: {
      src: opts?.src ?? "https://youtu.be/abc123",
      width: 640,
      height: 360,
      transcription: opts?.transcription ?? "",
    },
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <YoutubeEmbedComponent
        node={node as never}
        selected={false}
        deleteNode={deleteNode}
        editor={editor as never}
        getPos={vi.fn() as never}
        decorations={[] as never}
        extension={undefined as never}
        HTMLAttributes={{} as never}
        updateAttributes={vi.fn() as never}
      />
    </QueryClientProvider>,
  );
}

describe("YoutubeEmbedComponent", () => {
  beforeEach(() => {
    mockRequestTranscription.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders iframe with converted nocookie embed URL", () => {
    renderComponent({ src: "https://youtu.be/abc123" });
    const iframe = screen.getByTitle("YouTube video");
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });

  it("converts shorts URL to youtube-nocookie embed URL", () => {
    renderComponent({ src: "https://www.youtube.com/shorts/short123" });
    const iframe = screen.getByTitle("YouTube video");
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/short123",
    );
  });

  it("keeps raw src when URL is invalid", () => {
    renderComponent({ src: "not-a-valid-url" });
    const iframe = screen.getByTitle("YouTube video");
    expect(iframe).toHaveAttribute("src", "not-a-valid-url");
  });

  it("requests transcription and shows requested state on success", async () => {
    mockRequestTranscription.mockResolvedValue(undefined as never);
    renderComponent();

    fireEvent.mouseDown(screen.getByRole("button", { name: /transcribe/i }));

    await waitFor(() => {
      expect(mockRequestTranscription).toHaveBeenCalledWith(
        expect.anything(),
        "entry-1",
        "https://youtu.be/abc123",
      );
    });
    expect(screen.getByText(/transcription requested/i)).toBeInTheDocument();
  });

  it("shows error and allows retry when transcription request fails", async () => {
    mockRequestTranscription.mockRejectedValueOnce(new Error("service down"));
    mockRequestTranscription.mockResolvedValueOnce(undefined as never);
    renderComponent();

    fireEvent.mouseDown(screen.getByRole("button", { name: /transcribe/i }));

    await waitFor(() => {
      expect(screen.getByText(/transcription failed/i)).toBeInTheDocument();
      expect(screen.getByText("service down")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(mockRequestTranscription).toHaveBeenCalledTimes(2);
    });
  });

  it("renders transcription panel and copies text to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderComponent({ transcription: "Transcript content" });

    fireEvent.mouseDown(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Transcript content");
    });
    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });
  });

  it("uses execCommand fallback when clipboard API fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const execCommandMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommandMock,
    });

    renderComponent({ transcription: "Transcript fallback content" });
    fireEvent.mouseDown(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith("copy");
    });
    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });
  });

  it("toggles transcription expansion", () => {
    renderComponent({ transcription: "Transcript content" });
    const panel = document.querySelector(".summary-markdown");
    expect(panel).toHaveClass("max-h-40");

    fireEvent.mouseDown(screen.getByTitle("Expand"));
    expect(panel).toHaveClass("max-h-[500px]");
  });

  it("calls deleteNode when remove button is used", () => {
    const deleteNode = vi.fn();
    renderComponent({ deleteNode });
    fireEvent.mouseDown(screen.getByRole("button", { name: /remove/i }));
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it("does not request transcription when entryId is missing", () => {
    renderComponent({ editor: createEditor("") });
    fireEvent.mouseDown(screen.getByRole("button", { name: /transcribe/i }));
    expect(mockRequestTranscription).not.toHaveBeenCalled();
  });
});
