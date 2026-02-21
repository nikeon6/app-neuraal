import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EntrySearchBar } from "./EntrySearchBar";
import type { ApiEntry } from "@/shared/api/sdk";

// ============================================================================
// Mock framer-motion (same pattern as DashboardHeader.test.tsx)
// ============================================================================

function stripMotionProps(props: Record<string, unknown>) {
  const {
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    whileHover: _wh,
    whileTap: _wt,
    layout: _l,
    layoutId: _li,
    ...domProps
  } = props;
  return domProps;
}

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div
        {...(stripMotionProps(props) as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    ),
    button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> &
      Record<string, unknown>) => (
      <button
        {...(stripMotionProps(
          props,
        ) as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ============================================================================
// Test data
// ============================================================================

function makeEntry(overrides: Partial<ApiEntry> = {}): ApiEntry {
  return {
    id: "entry-1",
    userId: "user-1",
    date: "2026-02-11",
    type: "task",
    title: "Buy groceries",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Milk, eggs and bread" }],
        },
      ],
    },
    version: 1,
    completed: false,
    createdAt: "2026-02-11T10:00:00Z",
    updatedAt: "2026-02-11T10:00:00Z",
    ...overrides,
  } as ApiEntry;
}

const entriesByDate: Record<string, ApiEntry[]> = {
  "2026-02-11": [
    makeEntry(),
    makeEntry({
      id: "entry-2",
      title: "Team meeting",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Discuss Q1 roadmap" }],
          },
        ],
      },
    }),
    makeEntry({
      id: "entry-3",
      type: "note",
      title: "",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Random thoughts about groceries" },
            ],
          },
        ],
      },
    }),
  ],
  "2026-02-12": [
    makeEntry({
      id: "entry-4",
      title: "Write tests",
      date: "2026-02-12",
      content: { type: "doc", content: [] },
    }),
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe("EntrySearchBar", () => {
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelect = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderSearchBar(
    props?: Partial<React.ComponentProps<typeof EntrySearchBar>>,
  ) {
    return render(
      <EntrySearchBar
        entriesByDate={entriesByDate}
        onSelect={onSelect}
        {...props}
      />,
    );
  }

  it("renders the search button initially", () => {
    renderSearchBar();
    expect(
      screen.getByRole("button", { name: /search entries/i }),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search entries/i)).toBeNull();
  });

  it("expands input when search button is clicked", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search entries/i),
      ).toBeInTheDocument();
    });
  });

  it("closes when close button is clicked", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search entries/i),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /close search/i }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search entries/i)).toBeNull();
    });
  });

  it("closes on Escape key", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search entries/i)).toBeNull();
    });
  });

  it("filters entries by title", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "groceries" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("Buy groceries")).toBeInTheDocument();
    });

    expect(screen.queryByText("Team meeting")).toBeNull();
  });

  it("filters entries by content", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "roadmap" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("Team meeting")).toBeInTheDocument();
    });
  });

  it("shows 'No entries found' when query has no matches", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "zzzzzzz" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText(/no entries found/i)).toBeInTheDocument();
    });
  });

  it("does not show dropdown when query is too short", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "a" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("calls onSelect when a result is clicked", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "groceries" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("Buy groceries")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Buy groceries"));

    expect(onSelect).toHaveBeenCalledWith("entry-1");
  });

  it("navigates results with keyboard arrows and Enter", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "groceries" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalled();
  });

  it("shows 'Untitled' for entries without title", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "random thoughts" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("Untitled")).toBeInTheDocument();
    });
  });

  it("closes and resets query after selecting a result", async () => {
    renderSearchBar();
    fireEvent.click(screen.getByRole("button", { name: /search entries/i }));

    const input = await screen.findByPlaceholderText(/search entries/i);
    fireEvent.change(input, { target: { value: "meeting" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("Team meeting")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Team meeting"));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search entries/i)).toBeNull();
    });
  });
});
