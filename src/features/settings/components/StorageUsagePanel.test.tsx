import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StorageUsagePanel } from "./StorageUsagePanel";
import { useStorageUsageQuery } from "@/shared/api/queries";

vi.mock("@/shared/api/queries", () => ({
  useStorageUsageQuery: vi.fn(),
}));

const mockUseStorageUsageQuery = vi.mocked(useStorageUsageQuery);

describe("StorageUsagePanel", () => {
  beforeEach(() => {
    mockUseStorageUsageQuery.mockReset();
  });

  it("renders loading skeleton", () => {
    mockUseStorageUsageQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useStorageUsageQuery>);

    const { container } = render(<StorageUsagePanel />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders error state when request fails", () => {
    mockUseStorageUsageQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    } as ReturnType<typeof useStorageUsageQuery>);

    render(<StorageUsagePanel />);
    expect(
      screen.getByText(/failed to load storage data\. try again later\./i),
    ).toBeInTheDocument();
  });

  it("renders storage values and remaining bytes", () => {
    mockUseStorageUsageQuery.mockReturnValue({
      data: {
        usedBytes: 1536,
        maxUserStorageBytes: 3072,
        maxEntryAttachmentBytes: 1024,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsageQuery>);

    render(<StorageUsagePanel />);

    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("1.5 KB / 3.0 KB")).toBeInTheDocument();
    expect(screen.getByText("50% used")).toBeInTheDocument();
    expect(screen.getByText("1.5 KB")).toBeInTheDocument();
    expect(screen.getByText("1.0 KB")).toBeInTheDocument();
  });

  it("clamps remaining bytes to 0 when usage exceeds limit", () => {
    mockUseStorageUsageQuery.mockReturnValue({
      data: {
        usedBytes: 4096,
        maxUserStorageBytes: 2048,
        maxEntryAttachmentBytes: 1024,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsageQuery>);

    render(<StorageUsagePanel />);
    expect(screen.getByText("0 B")).toBeInTheDocument();
  });

  it("uses warning and critical colors for high usage", () => {
    mockUseStorageUsageQuery.mockReturnValue({
      data: {
        usedBytes: 850,
        maxUserStorageBytes: 1000,
        maxEntryAttachmentBytes: 200,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsageQuery>);
    const { rerender, container } = render(<StorageUsagePanel />);
    expect(container.querySelector(".bg-amber-500")).not.toBeNull();

    mockUseStorageUsageQuery.mockReturnValue({
      data: {
        usedBytes: 960,
        maxUserStorageBytes: 1000,
        maxEntryAttachmentBytes: 200,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsageQuery>);
    rerender(<StorageUsagePanel />);
    expect(container.querySelector(".bg-red-500")).not.toBeNull();
  });
});
