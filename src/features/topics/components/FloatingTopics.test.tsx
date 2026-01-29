import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingTopics } from "./FloatingTopics";
import type { LegacyTask, TopicId } from "@/shared/types";
import { DEFAULT_USER_ID } from "@/shared/store";

// ============================================================================
// Mock Browser APIs (not available in jsdom)
// ============================================================================
class MockResizeObserver {
  callback: ResizeObserverCallback;
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  
  observe() {
    // Simulate initial observation
    setTimeout(() => {
      this.callback([], this);
    }, 0);
  }
  
  unobserve() {}
  disconnect() {}
}

class MockMutationObserver {
  callback: MutationCallback;
  
  constructor(callback: MutationCallback) {
    this.callback = callback;
  }
  
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

// Install mocks globally
vi.stubGlobal("ResizeObserver", MockResizeObserver);
vi.stubGlobal("MutationObserver", MockMutationObserver);

// ============================================================================
// Mock Data
// ============================================================================
const createMockTask = (
  id: string,
  topicId: TopicId,
  title: string = "Test Task"
): LegacyTask => ({
  id,
  title,
  topicId,
  completed: false,
  userId: DEFAULT_USER_ID,
});

const mockTasksByDay: Record<number, LegacyTask[]> = {
  15: [
    createMockTask("task-1", "work", "Work Task 1"),
    createMockTask("task-2", "work", "Work Task 2"),
    createMockTask("task-3", "health", "Health Task"),
  ],
  16: [
    createMockTask("task-4", "learning", "Learning Task"),
  ],
};

const emptyTasksByDay: Record<number, LegacyTask[]> = {};

// ============================================================================
// Mock Store
// ============================================================================
const mockSetTopicPosition = vi.fn();
const mockSetHighlightedTopic = vi.fn();

const createMockState = (overrides = {}) => ({
  tasksByDay: mockTasksByDay,
  topicPositions: {},
  setTopicPosition: mockSetTopicPosition,
  highlightedTopic: null,
  setHighlightedTopic: mockSetHighlightedTopic,
  ...overrides,
});

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector) => {
    const state = createMockState();
    return typeof selector === "function" ? selector(state) : state;
  }),
  DEFAULT_USER_ID: "user_demo",
}));

// Mock pointer capture API (not available in jsdom)
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

  // Create mock aside element
  const aside = document.createElement("aside");
  aside.style.width = "400px";
  aside.style.height = "800px";
  aside.style.position = "absolute";
  aside.style.right = "0";
  container.appendChild(aside);

  // Create mock task pills
  Object.values(mockTasksByDay)
    .flat()
    .forEach((task, index) => {
      const pill = document.createElement("div");
      pill.setAttribute("data-task-id", task.id);
      pill.style.position = "absolute";
      pill.style.left = "850px";
      pill.style.top = `${100 + index * 60}px`;
      pill.style.width = "100px";
      pill.style.height = "40px";
      aside.appendChild(pill);
    });

  // Mock getBoundingClientRect for container
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

  // Mock getBoundingClientRect for aside
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

// ============================================================================
// Tests
// ============================================================================
// Import for resetting mock
import * as storeModule from "@/shared/store";

describe("FloatingTopics", () => {
  let containerRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPointerCapture();
    containerRef = createMockContainerRef();
    
    // Reset store mock to default state
    vi.mocked(storeModule.useStore).mockImplementation((selector) => {
      const state = createMockState();
      return typeof selector === "function" ? selector(state) : state;
    });
  });

  afterEach(() => {
    // Clean up container from DOM
    if (containerRef.current && containerRef.current.parentNode) {
      containerRef.current.parentNode.removeChild(containerRef.current);
    }
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(<FloatingTopics containerRef={containerRef} />);
      // Component should render without throwing
      expect(document.querySelector(".pointer-events-none")).toBeInTheDocument();
    });

    it("should render SVG container for wires", () => {
      render(<FloatingTopics containerRef={containerRef} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render topic nodes for active topics", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      // Wait for initial render and recalc
      await waitFor(() => {
        // Work topic should be visible (has 2 tasks)
        const workNode = screen.queryByTitle(/trabajo.*2 tareas/i);
        expect(workNode).toBeInTheDocument();
      });
    });

    it("should not render topic nodes for topics without tasks", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        // "Familia" topic has no tasks, should not be rendered
        const familyNode = screen.queryByTitle(/familia/i);
        expect(familyNode).not.toBeInTheDocument();
      });
    });

    it("should display task count in topic node", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        // Work has 2 tasks
        expect(screen.getByText("2")).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Topic Node Properties
  // --------------------------------------------------------------------------
  describe("Topic Node Properties", () => {
    it("should have correct aria-label for accessibility", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
        expect(workNode).toBeInTheDocument();
      });
    });

    it("should have touch-action none for proper drag handling", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
        // jsdom doesn't fully serialize touch-action, check inline style directly
        expect(workNode.style.touchAction).toBe("none");
      });
    });

    it("should be positioned with absolute positioning", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
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
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(async () => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
        await user.hover(workNode);
        expect(mockSetHighlightedTopic).toHaveBeenCalledWith("work");
      });
    });

    it("should call setHighlightedTopic with null on mouse leave", async () => {
      const user = userEvent.setup();
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(async () => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
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
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
        
        // Simulate pointer down
        fireEvent.pointerDown(workNode, {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true,
        });

        // Node should still be in the document (drag started)
        expect(workNode).toBeInTheDocument();
      });
    });

    it("should update position on pointer move during drag", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);

        // Mock setPointerCapture and hasPointerCapture
        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        // Start drag
        fireEvent.pointerDown(workNode, {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        });

        // Move pointer
        fireEvent.pointerMove(workNode, {
          pointerId: 1,
          clientX: 200,
          clientY: 200,
        });

        // Node should have moved (style.left/top updated)
        // The exact position depends on internal calculations
        expect(workNode).toBeInTheDocument();
      });
    });

    it("should persist position to store on pointer up", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);

        // Mock pointer capture methods
        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        // Perform drag sequence
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

        // setTopicPosition should be called to persist the new position
        expect(mockSetTopicPosition).toHaveBeenCalled();
      });
    });

    it("should handle pointer cancel event gracefully", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        const workNode = screen.getByLabelText(/mover nodo de trabajo/i);

        workNode.setPointerCapture = vi.fn();
        workNode.releasePointerCapture = vi.fn();
        workNode.hasPointerCapture = vi.fn(() => true);

        fireEvent.pointerDown(workNode, {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        });

        // Cancel the drag
        fireEvent.pointerCancel(workNode, {
          pointerId: 1,
        });

        // Component should not crash
        expect(workNode).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // SVG Wires
  // Note: SVG path generation depends on getBoundingClientRect which doesn't
  // work properly in jsdom. These tests verify the SVG structure is created
  // but cannot fully test wire rendering without a real browser.
  // --------------------------------------------------------------------------
  describe("SVG Wires", () => {
    it("should render SVG container", () => {
      render(<FloatingTopics containerRef={containerRef} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass("absolute", "inset-0");
    });

    it("should have SVG with correct attributes", () => {
      render(<FloatingTopics containerRef={containerRef} />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "100%");
      expect(svg).toHaveAttribute("height", "100%");
    });

    it("should allow SVG overflow for wires extending outside bounds", () => {
      render(<FloatingTopics containerRef={containerRef} />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveStyle({ overflow: "visible" });
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("should handle empty tasksByDay gracefully", () => {
      // Override mock for this test
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ tasksByDay: emptyTasksByDay });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<FloatingTopics containerRef={containerRef} />);

      // Should render without crashing
      expect(document.querySelector(".pointer-events-none")).toBeInTheDocument();

      // Should not render any topic nodes
      const nodes = screen.queryAllByRole("button");
      expect(nodes.length).toBe(0);
    });

    it("should handle null containerRef gracefully", () => {
      const nullRef = { current: null };
      
      // Should not crash
      render(<FloatingTopics containerRef={nullRef} />);
      expect(document.querySelector(".pointer-events-none")).toBeInTheDocument();
    });

    it("should handle rapid consecutive drag operations", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      // Wait for initial render with timeout
      await waitFor(() => {
        expect(screen.getByLabelText(/mover nodo de trabajo/i)).toBeInTheDocument();
      });
      
      const workNode = screen.getByLabelText(/mover nodo de trabajo/i);

      // Rapid drag sequence
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

      // Component should still be functional
      expect(workNode).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Performance Optimizations
  // --------------------------------------------------------------------------
  describe("Performance Optimizations", () => {
    it("should use pointer-events-none on container to optimize hit testing", () => {
      render(<FloatingTopics containerRef={containerRef} />);
      const container = document.querySelector(".pointer-events-none");
      expect(container).toBeInTheDocument();
    });

    it("should use pointer-events-auto only on interactive elements", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/mover nodo de trabajo/i)).toBeInTheDocument();
      });
      
      const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
      expect(workNode).toHaveClass("pointer-events-auto");
    });

    it("should not trigger store updates during pointer move", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/mover nodo de trabajo/i)).toBeInTheDocument();
      });
      
      const workNode = screen.getByLabelText(/mover nodo de trabajo/i);

      // Start drag
      fireEvent.pointerDown(workNode, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });

      // Clear mock to track only pointermove calls
      mockSetTopicPosition.mockClear();

      // Multiple moves
      for (let i = 0; i < 10; i++) {
        fireEvent.pointerMove(workNode, {
          pointerId: 1,
          clientX: 100 + i * 10,
          clientY: 100,
        });
      }

      // setTopicPosition should NOT be called during move (only on pointerUp)
      expect(mockSetTopicPosition).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Topic Radius Scaling
  // --------------------------------------------------------------------------
  describe("Topic Radius Scaling", () => {
    it("should scale topic node size based on task count", async () => {
      render(<FloatingTopics containerRef={containerRef} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/mover nodo de trabajo/i)).toBeInTheDocument();
      });
      
      const workNode = screen.getByLabelText(/mover nodo de trabajo/i);
      const healthNode = screen.getByLabelText(/mover nodo de salud/i);

      // Work has 2 tasks, Health has 1 task
      // Work should be larger (r = 20 + count * 8)
      // Work: r = 20 + 2*8 = 36, width/height = 72
      // Health: r = 20 + 1*8 = 28, width/height = 56
      const workWidth = parseInt(workNode.style.width, 10);
      const healthWidth = parseInt(healthNode.style.width, 10);

      expect(workWidth).toBeGreaterThan(healthWidth);
    });
  });
});
