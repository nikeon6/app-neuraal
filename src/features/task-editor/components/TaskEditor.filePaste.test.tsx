import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskEditor } from "./TaskEditor";
import type { ApiEntry } from "@/shared/api/sdk";

const insertCodeBlockMock = vi.fn();
const insertFileNodeMock = vi.fn();
const insertUploadingFileNodeMock = vi.fn();
const finalizeFileNodeMock = vi.fn();
const removeUploadingFileNodeMock = vi.fn();
const insertYoutubeMock = vi.fn();
const uploadImagesMock = vi.fn();
const initUploadMock = vi.fn();
const completeUploadMock = vi.fn();
const updateEntryAndInvalidateMock = vi.fn();

function createEntry(overrides: Partial<ApiEntry> = {}): ApiEntry {
  return {
    id: "entry-test",
    userId: "user-123",
    date: "2024-01-15",
    type: "task",
    title: "Task",
    content: null,
    topicId: null,
    completed: false,
    summary: null,
    summaryUpdatedAt: null,
    version: 1,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    ...overrides,
  } as ApiEntry;
}

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(function MockDiv(
      props: React.HTMLAttributes<HTMLDivElement>,
      ref: React.Ref<HTMLDivElement>,
    ) {
      return <div ref={ref} {...props} />;
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      selectedDate: new Date("2024-01-15"),
      selectedDay: 15,
    }),
  ),
  selectDateKey: () => "2024-01-15",
}));

vi.mock("@/shared/api/queries", () => ({
  useTopicsQuery: () => ({ data: [], isPending: false }),
  useUserProfileQuery: () => ({ data: undefined }),
  useEntryAttachmentsQuery: () => ({ data: [], isLoading: false }),
  entriesQueryKey: (dateKey: string) => ["entries", dateKey],
  attachmentsQueryKey: (entryId: string) => ["attachments", entryId],
}));

vi.mock("@/shared/api/mutations", () => ({
  updateEntryAndInvalidate: (...args: unknown[]) =>
    updateEntryAndInvalidateMock(...args),
  deleteEntryAndInvalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/shared/api/sdk/entries", () => ({
  autoTopicEntry: vi.fn().mockResolvedValue({
    entryId: "entry-test",
    selectedTopicId: null,
    score: null,
  }),
}));

vi.mock("@/shared/api/sdk/attachments", () => ({
  initUpload: (...args: unknown[]) => initUploadMock(...args),
  completeUpload: (...args: unknown[]) => completeUploadMock(...args),
  getDownloadUrl: vi.fn(),
  listByEntry: vi.fn(),
  deleteAttachment: vi.fn(),
}));

vi.mock("../hooks/useImageUpload", () => ({
  useImageUpload: () => ({ uploadImages: uploadImagesMock }),
}));
vi.mock("../hooks/useResolveAttachmentUrls", () => ({
  useResolveAttachmentUrls: vi.fn(),
}));
vi.mock("../hooks/useTrackDeletedImages", () => ({
  useTrackDeletedImages: vi.fn(),
}));
vi.mock("../hooks/useServerDataSync", () => ({
  useServerDataSync: vi.fn(),
}));
vi.mock("../hooks/useReminderActions", () => ({
  useReminderActions: () => ({
    isReminderDialogOpen: false,
    setIsReminderDialogOpen: vi.fn(),
    activeReminderId: null,
    isReminderSaving: false,
    handleCreateReminder: vi.fn(),
    handleRescheduleReminder: vi.fn(),
    handleCancelReminder: vi.fn(),
  }),
}));
vi.mock("../hooks/useSummaryActions", () => ({
  useSummaryActions: () => ({
    isSummarizing: false,
    summarizeError: null,
    setSummarizeError: vi.fn(),
    handleSummarize: vi.fn(),
    handleClearSummary: vi.fn(),
  }),
}));
vi.mock("../hooks/useEditorCollapse", () => ({
  useEditorCollapse: vi.fn(),
  useContentMenuClose: vi.fn(),
}));

vi.mock("./ReminderDialog", () => ({
  ReminderDialog: () => null,
}));
vi.mock("./YoutubeUrlDialog", () => ({
  YoutubeUrlDialog: ({
    isOpen,
    onSubmit,
  }: {
    isOpen: boolean;
    onSubmit: (url: string) => void;
  }) =>
    isOpen ? (
      <button
        type="button"
        aria-label="Mock youtube submit"
        onClick={() => onSubmit("https://www.youtube.com/watch?v=mocked")}
      >
        Submit youtube
      </button>
    ) : null,
}));
vi.mock("./FormatMenu", () => ({
  FormatMenu: ({ onClose }: { onClose: () => void }) => (
    <button type="button" aria-label="Mock format close" onClick={onClose}>
      Close format
    </button>
  ),
}));
vi.mock("@/features/attachments", () => ({
  AttachmentPanel: () => null,
}));
vi.mock("@/shared/ui", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("./TiptapEditor", () => ({
  TiptapEditor: ({
    editorRef,
    onFilePaste,
  }: {
    editorRef?: React.MutableRefObject<unknown>;
    onFilePaste?: (files: File[]) => Promise<void>;
  }) => {
    if (editorRef && "current" in editorRef) {
      (editorRef as React.MutableRefObject<unknown>).current = {
        editor: {},
        insertImage: vi.fn(),
        insertCodeBlock: insertCodeBlockMock,
        insertYoutube: insertYoutubeMock,
        insertFileNode: insertFileNodeMock,
        insertUploadingFileNode: insertUploadingFileNodeMock,
        finalizeFileNode: finalizeFileNodeMock,
        removeUploadingFileNode: removeUploadingFileNodeMock,
        syncYoutubeTranscriptions: vi.fn(),
        syncImageVisionResults: vi.fn(),
      };
    }

    return (
      <div aria-label="Rich text editor">
        <button
          type="button"
          aria-label="Mock paste file"
          onClick={() =>
            onFilePaste?.([
              new File(["hello"], "from-paste.txt", { type: "text/plain" }),
            ])
          }
        >
          Paste
        </button>
      </div>
    );
  },
}));

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TaskEditor entry={createEntry()} />
    </QueryClientProvider>,
  );
}

describe("TaskEditor file paste coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEntryAndInvalidateMock.mockResolvedValue(createEntry({ version: 2 }));
    initUploadMock.mockResolvedValue({
      attachment: { id: "att-paste-1" },
      presignedPutUrl: "https://s3.example.com/put",
    });
    completeUploadMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs code snippet action from content menu", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("textbox", { name: /title/i }));
    await user.click(screen.getByRole("button", { name: /add content/i }));
    await user.click(screen.getByRole("menuitem", { name: /code snippet/i }));

    expect(insertCodeBlockMock).toHaveBeenCalledTimes(1);
  });

  it("uploads images when image menu action selects files", async () => {
    const user = userEvent.setup();
    renderEditor();

    const realCreateElement = document.createElement.bind(document);
    let createdInput: HTMLInputElement | null = null;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        const el = realCreateElement(tagName);
        if (tagName === "input") {
          createdInput = el as HTMLInputElement;
          vi.spyOn(createdInput, "click").mockImplementation(() => undefined);
        }
        return el;
      });

    await user.click(screen.getByRole("textbox", { name: /title/i }));
    await user.click(screen.getByRole("button", { name: /add content/i }));
    await user.click(screen.getByRole("menuitem", { name: /^image$/i }));

    expect(createdInput).not.toBeNull();
    const image = new File(["img"], "pic.png", { type: "image/png" });
    Object.defineProperty(createdInput as HTMLInputElement, "files", {
      value: [image],
      configurable: true,
    });
    (createdInput as HTMLInputElement).onchange?.(new Event("change"));

    await waitFor(() => {
      expect(uploadImagesMock).toHaveBeenCalledWith([image]);
    });
    createElementSpy.mockRestore();
  });

  it("inserts youtube via dialog submit callback", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("textbox", { name: /title/i }));
    await user.click(screen.getByRole("button", { name: /add content/i }));
    await user.click(screen.getByRole("menuitem", { name: /youtube|video/i }));
    await user.click(
      screen.getByRole("button", { name: /mock youtube submit/i }),
    );

    expect(insertYoutubeMock).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=mocked",
    );
  });

  it("closes format menu through onClose callback", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("textbox", { name: /title/i }));
    await user.click(screen.getByRole("button", { name: /text format/i }));
    expect(
      screen.getByRole("button", { name: /mock format close/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /mock format close/i }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /mock format close/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("uploads pasted file and inserts file node on success", async () => {
    const putFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", putFetch);
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /mock paste file/i }));

    await waitFor(() => {
      expect(insertUploadingFileNodeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: expect.any(String),
          filename: "from-paste.txt",
          mimeType: "text/plain",
        }),
      );
      expect(initUploadMock).toHaveBeenCalledTimes(1);
      expect(putFetch).toHaveBeenCalledTimes(1);
      expect(completeUploadMock).toHaveBeenCalledWith("att-paste-1");
      expect(finalizeFileNodeMock).toHaveBeenCalledWith(expect.any(String), {
        attachmentId: "att-paste-1",
      });
    });
  });

  it("logs error and removes placeholder when paste upload fails", async () => {
    const putFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", putFetch);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /mock paste file/i }));

    await waitFor(() => {
      expect(insertUploadingFileNodeMock).toHaveBeenCalledTimes(1);
      expect(initUploadMock).toHaveBeenCalledTimes(1);
      expect(putFetch).toHaveBeenCalledTimes(1);
    });
    expect(completeUploadMock).not.toHaveBeenCalled();
    expect(removeUploadingFileNodeMock).toHaveBeenCalledWith(
      expect.any(String),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[TaskEditor] File paste attachment failed:",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});
