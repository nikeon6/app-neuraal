import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AttachmentPanel } from "./AttachmentPanel";

// ============================================================================
// Mock Data
// ============================================================================

const mockAttachmentReady = {
  id: "att-1",
  userId: "user-123",
  entryId: "entry-abc",
  storageKey: "att/entry-abc/file.pdf",
  filename: "report.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1048576, // 1 MB
  kind: "file",
  status: "ready",
  createdAt: "2026-01-29T10:00:00Z",
  updatedAt: "2026-01-29T10:01:00Z",
};

const mockAttachmentPending = {
  id: "att-2",
  userId: "user-123",
  entryId: "entry-abc",
  storageKey: "att/entry-abc/image.png",
  filename: "screenshot.png",
  mimeType: "image/png",
  sizeBytes: 524288, // 512 KB
  kind: "file",
  status: "pending",
  createdAt: "2026-01-29T10:02:00Z",
  updatedAt: "2026-01-29T10:02:00Z",
};

const mockUsage = {
  entryBytesUsed: 1572864, // 1.5 MB
  entryLimitBytes: 20971520, // 20 MB
  userBytesUsed: 5242880, // 5 MB
  userLimitBytes: 1073741824, // 1 GB
};

// ============================================================================
// Mocks
// ============================================================================

const mockAttachmentsQuery = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useEntryAttachmentsQuery: (...args: unknown[]) =>
    mockAttachmentsQuery(...args),
  attachmentsQueryKey: (entryId: string) => ["attachments", entryId],
}));

const mockDeleteAttachmentAndInvalidate = vi.fn();

vi.mock("@/shared/api/mutations", () => ({
  deleteAttachmentAndInvalidate: (...args: unknown[]) =>
    mockDeleteAttachmentAndInvalidate(...args),
}));

const mockGetDownloadUrl = vi.fn();

vi.mock("@/shared/api/sdk/attachments", () => ({
  getDownloadUrl: (...args: unknown[]) => mockGetDownloadUrl(...args),
  listByEntry: vi.fn(),
  deleteAttachment: vi.fn(),
}));

// Mock Framer Motion
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

// ============================================================================
// Helpers
// ============================================================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPanel(entryId = "entry-abc", dateKey = "2026-01-29") {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AttachmentPanel entryId={entryId} dateKey={dateKey} />
    </QueryClientProvider>,
  );
}

/** Click the collapsible header to expand the panel. */
async function expandPanel(user: ReturnType<typeof userEvent.setup>) {
  const toggleBtn = screen.getByRole("button", { name: /attachments/i });
  await user.click(toggleBtn);
}

// ============================================================================
// Tests
// ============================================================================

describe("AttachmentPanel (collapsible, read-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("should not render when there are no attachments", () => {
      mockAttachmentsQuery.mockReturnValue({
        data: { attachments: [], usage: mockUsage },
        isLoading: false,
      });
      const { container } = renderPanel();
      expect(container.innerHTML).toBe("");
    });

    it("should render the collapsible header when there are attachments", () => {
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      expect(screen.getByText("Attachments")).toBeInTheDocument();
    });

    it("should render nothing while loading (prevents flash)", () => {
      mockAttachmentsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      const { container } = renderPanel();
      // The component explicitly returns null during loading to prevent
      // a brief flash of the panel header on entries with no attachments.
      expect(container.innerHTML).toBe("");
    });

    it("should display attachment count in header", () => {
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady, mockAttachmentPending],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      expect(screen.getByText("(2)")).toBeInTheDocument();
    });

    it("should not have an Add file button (read-only panel)", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(screen.queryByLabelText("Add attachment")).not.toBeInTheDocument();
    });

    it("should be collapsed by default (no attachment list visible)", () => {
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      // Attachment filenames should not be visible in collapsed state
      expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
    });

    it("should expand when header is clicked", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Attachment List (expanded)
  // --------------------------------------------------------------------------

  describe("attachment list", () => {
    it("should display attachment filenames when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });

    it("should display human-readable size when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    });

    it("should show pending status label when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentPending],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(screen.getByText("(processing)")).toBeInTheDocument();
    });

    it("should show download button for ready attachments when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(
        screen.getByLabelText(`Download ${mockAttachmentReady.filename}`),
      ).toBeInTheDocument();
    });

    it("should show delete button for each attachment when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(
        screen.getByLabelText(`Delete ${mockAttachmentReady.filename}`),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Quota Display (expanded)
  // --------------------------------------------------------------------------

  describe("quota display", () => {
    it("should display entry usage when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(
        screen.getByText(/Entry: 1\.5 MB \/ 20\.0 MB/),
      ).toBeInTheDocument();
    });

    it("should display account usage when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);
      expect(
        screen.getByText(/Account: 5\.0 MB \/ 1\.0 GB/),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Download (expanded)
  // --------------------------------------------------------------------------

  describe("download", () => {
    it("should request presigned URL and open in new tab", async () => {
      const user = userEvent.setup();
      const mockUrl =
        "https://s3.example.com/download/report.pdf?signature=abc";
      mockGetDownloadUrl.mockResolvedValueOnce({ presignedGetUrl: mockUrl });

      const openSpy = vi
        .spyOn(globalThis, "open")
        .mockImplementation(() => null);

      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);

      await user.click(
        screen.getByLabelText(`Download ${mockAttachmentReady.filename}`),
      );

      await waitFor(() => {
        expect(mockGetDownloadUrl).toHaveBeenCalledWith(mockAttachmentReady.id);
      });

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(mockUrl, "_blank", "noopener");
      });

      openSpy.mockRestore();
    });

    it("should disable download for pending attachments when expanded", async () => {
      const user = userEvent.setup();
      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentPending],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);

      const downloadBtn = screen.getByLabelText(
        `Download ${mockAttachmentPending.filename}`,
      );
      expect(downloadBtn).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Delete (expanded)
  // --------------------------------------------------------------------------

  describe("delete", () => {
    it("should call deleteAttachmentAndInvalidate when delete is clicked", async () => {
      const user = userEvent.setup();
      mockDeleteAttachmentAndInvalidate.mockResolvedValueOnce(undefined);

      mockAttachmentsQuery.mockReturnValue({
        data: {
          attachments: [mockAttachmentReady],
          usage: mockUsage,
        },
        isLoading: false,
      });
      renderPanel();
      await expandPanel(user);

      await user.click(
        screen.getByLabelText(`Delete ${mockAttachmentReady.filename}`),
      );

      await waitFor(() => {
        expect(mockDeleteAttachmentAndInvalidate).toHaveBeenCalledWith(
          expect.anything(), // queryClient
          mockAttachmentReady.id,
          "entry-abc",
        );
      });
    });
  });
});
