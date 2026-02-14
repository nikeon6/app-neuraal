import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FloatingTopics } from "./FloatingTopics";
import type { ApiEntry } from "@/shared/api/sdk";

// ============================================================================
// Mock Browser APIs (not available in jsdom)
// ============================================================================
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    setTimeout(() => {
      this.callback([], this);
    }, 0);
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

class MockMutationObserver {
  callback: MutationCallback;
  constructor(callback: MutationCallback) {
    this.callback = callback;
  }
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
  takeRecords() {
    return [];
  }
}

vi.stubGlobal("ResizeObserver", MockResizeObserver);
vi.stubGlobal("MutationObserver", MockMutationObserver);

// ============================================================================
// Mock Data (ApiEntry + ApiTopic shapes)
// ============================================================================
function createMockEntry(
  id: string,
  topicId: string | null,
  date: string = "2024-01-15",
): ApiEntry {
  return {
    id,
    userId: "user-123",
    date,
    type: "task",
    title: `Entry ${id}`,
    content: null,
    topicId,
    completed: false,
    summary: null,
    summaryUpdatedAt: null,
    version: 1,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  } as ApiEntry;
}

const mockEntriesByDate: Record<string, ApiEntry[]> = {
  "2024-01-15": [
    createMockEntry("entry-1", "topic-work"),
    createMockEntry("entry-2", "topic-work"),
    createMockEntry("entry-3", "topic-health"),
  ],
  "2024-01-16": [createMockEntry("entry-4", "topic-learning", "2024-01-16")],
};

const emptyEntriesByDate: Record<string, ApiEntry[]> = {};
const multiDaySameTopicEntries: Record<string, ApiEntry[]> = {
  "2024-01-15": [createMockEntry("entry-a", "topic-work")],
  "2024-01-16": [createMockEntry("entry-b", "topic-work", "2024-01-16")],
};

const mockTopics = [
  { id: "topic-work", userId: "user-123", name: "Trabajo", color: "#3b82f6" },
  { id: "topic-health", userId: "user-123", name: "Salud", color: "#22c55e" },
  {
    id: "topic-learning",
    userId: "user-123",
    name: "Learning",
    color: "#f59e0b",
  },
  { id: "topic-family", userId: "user-123", name: "Familia", color: "#ef4444" },
];

// ============================================================================
// Mocks
// ============================================================================
const mockTopicsQuery = vi.fn();
const mockSetTopicPosition = vi.fn();
const mockSetHighlightedTopic = vi.fn();
const mockToggleTopicSelection = vi.fn();
const mockClearSelection = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useTopicsQuery: (...args: unknown[]) => mockTopicsQuery(...args),
  topicsQueryKey: ["topics"],
}));

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      topicPositions: {},
      setTopicPosition: mockSetTopicPosition,
      highlightedTopic: null,
      setHighlightedTopic: mockSetHighlightedTopic,
      selectedTopicIds: [] as string[],
      toggleTopicSelection: mockToggleTopicSelection,
      clearSelection: mockClearSelection,
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

// Mock pointer capture API
const mockPointerCapture = () => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => true);
};

// ============================================================================
// Mock Container Ref Setup
// ============================================================================
const createMockContainerRef = () => {
  const container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  container.style.position = "relative";
  document.body.appendChild(container);

  const aside = document.createElement("aside");
  aside.style.width = "400px";
  aside.style.height = "800px";
  aside.style.position = "absolute";
  aside.style.right = "0";
  container.appendChild(aside);

  container.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 1200,
    bottom: 800,
    width: 1200,
    height: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  aside.getBoundingClientRect = () => ({
    left: 800,
    top: 0,
    right: 1200,
    bottom: 800,
    width: 400,
    height: 800,
    x: 800,
    y: 0,
    toJSON: () => ({}),
  });

  return { current: container };
};

const createMockContainerRefStack = () => {
  const container = document.createElement("div");
  container.style.width = "900px";
  container.style.height = "900px";
  container.style.position = "relative";
  document.body.appendChild(container);

  const aside = document.createElement("aside");
  container.appendChild(aside);

  const lane = document.createElement("div");
  container.appendChild(lane);

  container.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 900,
    bottom: 900,
    width: 900,
    height: 900,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  // Simulate mobile stack: lane above, aside below.
  aside.getBoundingClientRect = () => ({
    left: 0,
    top: 420,
    right: 900,
    bottom: 900,
    width: 900,
    height: 480,
    x: 0,
    y: 420,
    toJSON: () => ({}),
  });

  lane.getBoundingClientRect = () => ({
    left: 40,
    top: 120,
    right: 860,
    bottom: 220,
    width: 820,
    height: 100,
    x: 40,
    y: 120,
    toJSON: () => ({}),
  });

  return {
    containerRef: {
      current: container,
    } as React.RefObject<HTMLDivElement | null>,
    laneRef: { current: lane } as React.RefObject<HTMLDivElement | null>,
  };
};

// ============================================================================
// Helpers
// ============================================================================
function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderFloatingTopics(
  containerRef: React.RefObject<HTMLDivElement | null>,
  entriesByDate: Record<string, ApiEntry[]> = mockEntriesByDate,
  laneRef?: React.RefObject<HTMLDivElement | null>,
) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <FloatingTopics
        containerRef={containerRef}
        laneRef={laneRef}
        entriesByDate={entriesByDate}
      />
    </QueryClientProvider>,
  );
}

function addDayAnchor(
  containerRef: React.RefObject<HTMLDivElement | null>,
  dateKey: string,
  dayNumber: string,
  rect: { left: number; top: number; width: number; height: number },
) {
  const aside = containerRef.current?.querySelector("aside");
  if (!aside) return;
  const dayAnchor = document.createElement("div");
  dayAnchor.dataset.dayAnchor = "true";
  dayAnchor.dataset.dateKey = dateKey;
  dayAnchor.dataset.dayNumber = dayNumber;
  dayAnchor.getBoundingClientRect = () => ({
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  });
  aside.appendChild(dayAnchor);
}

// ============================================================================
// Tests
// ============================================================================
import * as storeModule from "@/shared/store";

function mockStoreState(overrides: Partial<Record<string, unknown>> = {}) {
  vi.mocked(storeModule.useStore).mockImplementation((selector) => {
    const state = {
      topicPositions: {},
      setTopicPosition: mockSetTopicPosition,
      highlightedTopic: null,
      setHighlightedTopic: mockSetHighlightedTopic,
      selectedTopicIds: [],
      toggleTopicSelection: mockToggleTopicSelection,
      clearSelection: mockClearSelection,
      ...overrides,
    };
    return typeof selector === "function"
      ? selector(state as Record<string, unknown>)
      : state;
  });
}

describe("FloatingTopics", () => {
  let containerRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPointerCapture();
    containerRef = createMockContainerRef();
    mockTopicsQuery.mockReturnValue({ data: mockTopics, isPending: false });

    mockStoreState();
  });

  afterEach(() => {
    if (containerRef.current) {
      containerRef.current.remove();
    }
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("should render without crashing", () => {
      renderFloatingTopics(containerRef);
      expect(
        screen.getByLabelText(/topics floating layer/i),
      ).toBeInTheDocument();
    });

    it("should render SVG container for wires", () => {
      renderFloatingTopics(containerRef);
      expect(
        screen.getByLabelText(/topics connection map/i),
      ).toBeInTheDocument();
    });

    it("should render topic nodes for active topics", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.queryByTitle(/trabajo.*2 entries/i);
        expect(workNode).toBeInTheDocument();
      });
    });

    it("should not render topic nodes for topics without entries", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const familyNode = screen.queryByTitle(/familia/i);
        expect(familyNode).not.toBeInTheDocument();
      });
    });

    it("should display entry count in topic node", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Topic Node Properties
  // --------------------------------------------------------------------------
  describe("Topic Node Properties", () => {
    it("should have correct aria-label for accessibility", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        expect(workNode).toBeInTheDocument();
      });
    });

    it("should have touch-action none for proper drag handling", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        expect(workNode.style.touchAction).toBe("none");
      });
    });

    it("should be positioned with absolute positioning", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        expect(workNode).toHaveClass("absolute");
      });
    });
  });

  // --------------------------------------------------------------------------
  // Hover Interactions
  // --------------------------------------------------------------------------
  describe("Hover Interactions", () => {
    it("should call setHighlightedTopic on mouse enter", async () => {
      const user = userEvent.setup();
      renderFloatingTopics(containerRef);

      await waitFor(async () => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        await user.hover(workNode);
        expect(mockSetHighlightedTopic).toHaveBeenCalledWith("topic-work");
      });
    });

    it("should call setHighlightedTopic with null on mouse leave", async () => {
      const user = userEvent.setup();
      renderFloatingTopics(containerRef);

      await waitFor(async () => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        await user.hover(workNode);
        await user.unhover(workNode);
        expect(mockSetHighlightedTopic).toHaveBeenCalledWith(null);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Drag and Drop
  // --------------------------------------------------------------------------
  describe("Drag and Drop", () => {
    it("should handle pointer down event", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);

        fireEvent.pointerDown(workNode, {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true,
        });

        expect(workNode).toBeInTheDocument();
      });
    });

    it("should persist position to store on pointer up", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);

        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        fireEvent.pointerDown(workNode, {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        });
        fireEvent.pointerMove(workNode, {
          pointerId: 1,
          clientX: 200,
          clientY: 200,
        });
        fireEvent.pointerUp(workNode, {
          pointerId: 1,
          clientX: 200,
          clientY: 200,
        });

        expect(mockSetTopicPosition).toHaveBeenCalled();
      });
    });

    it("should handle pointer cancel event gracefully", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);

        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        fireEvent.pointerDown(workNode, {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        });
        fireEvent.pointerCancel(workNode, { pointerId: 1 });

        expect(workNode).toBeInTheDocument();
      });
    });

    it("should toggle topic selection on click without drag", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        fireEvent.pointerDown(workNode, {
          pointerId: 8,
          clientX: 120,
          clientY: 120,
          pointerType: "mouse",
        });
        fireEvent.pointerUp(workNode, {
          pointerId: 8,
          clientX: 121,
          clientY: 121,
          pointerType: "mouse",
        });

        expect(mockToggleTopicSelection).toHaveBeenCalledWith("topic-work");
      });
    });

    it("should clear highlighted topic on touch pointer up", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        fireEvent.pointerDown(workNode, {
          pointerId: 9,
          clientX: 130,
          clientY: 130,
          pointerType: "touch",
        });
        fireEvent.pointerUp(workNode, {
          pointerId: 9,
          clientX: 130,
          clientY: 130,
          pointerType: "touch",
        });

        expect(mockSetHighlightedTopic).toHaveBeenCalledWith(null);
      });
    });

    it("should handle fallback junction update path without lane", async () => {
      renderFloatingTopics(containerRef, multiDaySameTopicEntries);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        fireEvent.pointerDown(workNode, {
          pointerId: 12,
          clientX: 160,
          clientY: 160,
          pointerType: "mouse",
        });
        fireEvent.pointerMove(workNode, {
          pointerId: 12,
          clientX: 240,
          clientY: 210,
          pointerType: "mouse",
        });
        fireEvent.pointerUp(workNode, {
          pointerId: 12,
          clientX: 240,
          clientY: 210,
          pointerType: "mouse",
        });

        expect(mockSetTopicPosition).toHaveBeenCalledWith(
          "topic-work",
          expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
          }),
        );
      });
    });

    it("should handle stack-layout drag path when lane is available", async () => {
      const stackRefs = createMockContainerRefStack();
      renderFloatingTopics(
        stackRefs.containerRef,
        multiDaySameTopicEntries,
        stackRefs.laneRef,
      );

      await waitFor(() => {
        const workNode = screen.getByLabelText(/topic trabajo/i);
        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        fireEvent.pointerDown(workNode, {
          pointerId: 13,
          clientX: 180,
          clientY: 180,
          pointerType: "touch",
        });
        fireEvent.pointerMove(workNode, {
          pointerId: 13,
          clientX: 220,
          clientY: 210,
          pointerType: "touch",
        });
        fireEvent.pointerUp(workNode, {
          pointerId: 13,
          clientX: 220,
          clientY: 210,
          pointerType: "touch",
        });

        expect(mockSetTopicPosition).toHaveBeenCalledWith(
          "topic-work",
          expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
          }),
        );
      });

      stackRefs.containerRef.current?.remove();
    });
  });

  // --------------------------------------------------------------------------
  // SVG Wires
  // --------------------------------------------------------------------------
  describe("SVG Wires", () => {
    it("should render SVG container", () => {
      renderFloatingTopics(containerRef);
      const svg = screen.getByLabelText(/topics connection map/i);
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass("absolute", "inset-0");
    });

    it("should have SVG with correct attributes", () => {
      renderFloatingTopics(containerRef);
      const svg = screen.getByLabelText(/topics connection map/i);
      expect(svg).toHaveAttribute("width", "100%");
      expect(svg).toHaveAttribute("height", "100%");
    });

    it("should allow SVG overflow for wires extending outside bounds", () => {
      renderFloatingTopics(containerRef);
      const svg = screen.getByLabelText(/topics connection map/i);
      expect(svg).toHaveStyle({ overflow: "visible" });
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("should handle empty entriesByDate gracefully", () => {
      renderFloatingTopics(containerRef, emptyEntriesByDate);

      expect(
        screen.getByLabelText(/topics floating layer/i),
      ).toBeInTheDocument();
      const nodes = screen.queryAllByRole("button");
      expect(nodes.length).toBe(0);
    });

    it("should handle null containerRef gracefully", () => {
      const nullRef = { current: null };
      renderFloatingTopics(nullRef);
      expect(
        screen.getByLabelText(/topics floating layer/i),
      ).toBeInTheDocument();
    });

    it("should handle rapid consecutive drag operations", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        expect(screen.getByLabelText(/topic trabajo/i)).toBeInTheDocument();
      });

      const workNode = screen.getByLabelText(/topic trabajo/i);

      for (let i = 0; i < 5; i++) {
        fireEvent.pointerDown(workNode, {
          pointerId: 1,
          clientX: 100 + i * 10,
          clientY: 100,
        });
        fireEvent.pointerUp(workNode, {
          pointerId: 1,
          clientX: 100 + i * 10,
          clientY: 100,
        });
      }

      expect(workNode).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Performance Optimizations
  // --------------------------------------------------------------------------
  describe("Performance Optimizations", () => {
    it("should use pointer-events-none on container for passthrough", () => {
      renderFloatingTopics(containerRef);
      expect(screen.getByLabelText(/topics floating layer/i)).toHaveClass(
        "pointer-events-none",
      );
    });

    it("should use pointer-events-auto only on interactive elements", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        expect(screen.getByLabelText(/topic trabajo/i)).toBeInTheDocument();
      });

      const workNode = screen.getByLabelText(/topic trabajo/i);
      expect(workNode).toHaveClass("pointer-events-auto");
    });

    it("should not trigger store updates during pointer move", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        expect(screen.getByLabelText(/topic trabajo/i)).toBeInTheDocument();
      });

      const workNode = screen.getByLabelText(/topic trabajo/i);

      fireEvent.pointerDown(workNode, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
      mockSetTopicPosition.mockClear();

      for (let i = 0; i < 10; i++) {
        fireEvent.pointerMove(workNode, {
          pointerId: 1,
          clientX: 100 + i * 10,
          clientY: 100,
        });
      }

      expect(mockSetTopicPosition).not.toHaveBeenCalled();
    });

    it("should dim non-selected wires when there is a selection", async () => {
      addDayAnchor(containerRef, "2024-01-15", "15", {
        left: 900,
        top: 220,
        width: 40,
        height: 20,
      });
      addDayAnchor(containerRef, "2024-01-16", "16", {
        left: 920,
        top: 280,
        width: 40,
        height: 20,
      });
      mockStoreState({ selectedTopicIds: ["topic-work"] });
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const greenWire = document.querySelector('path[stroke="#22c55e"]');
        const blueWire = document.querySelector('path[stroke="#3b82f6"]');
        expect(greenWire).toHaveAttribute("stroke-opacity", "0.04");
        expect(blueWire).toHaveAttribute("stroke-opacity", "0.3");
      });
    });

    it("should dim non-highlighted wires when no selection exists", async () => {
      addDayAnchor(containerRef, "2024-01-15", "15", {
        left: 900,
        top: 220,
        width: 40,
        height: 20,
      });
      addDayAnchor(containerRef, "2024-01-16", "16", {
        left: 920,
        top: 280,
        width: 40,
        height: 20,
      });
      mockStoreState({ highlightedTopic: "topic-work" });
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        const greenWire = document.querySelector('path[stroke="#22c55e"]');
        const blueWire = document.querySelector('path[stroke="#3b82f6"]');
        expect(greenWire).toHaveAttribute("stroke-opacity", "0.04");
        expect(blueWire).toHaveAttribute("stroke-opacity", "0.3");
      });
    });
  });

  // --------------------------------------------------------------------------
  // Topic Radius Scaling
  // --------------------------------------------------------------------------
  describe("Topic Radius Scaling", () => {
    it("should scale topic node size based on entry count", async () => {
      renderFloatingTopics(containerRef);

      await waitFor(() => {
        expect(screen.getByLabelText(/topic trabajo/i)).toBeInTheDocument();
      });

      const workNode = screen.getByLabelText(/topic trabajo/i);
      const healthNode = screen.getByLabelText(/topic salud/i);

      const workWidth = Number.parseInt(workNode.style.width, 10);
      const healthWidth = Number.parseInt(healthNode.style.width, 10);

      expect(workWidth).toBeGreaterThan(healthWidth);
    });
  });
});
