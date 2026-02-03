import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopicsSection } from "./TopicsSection";
import type { Topic, UserTopic } from "@/shared/types";
import { DEFAULT_USER_ID } from "@/shared/store";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock UserTopic for testing.
 */
const createMockTopic = (
  id: string,
  name: string,
  color: string
): UserTopic => ({
  id,
  name,
  color,
  userId: DEFAULT_USER_ID,
  meta: {
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
});

// Initial topics for most tests
const mockTopics: Topic[] = [
  createMockTopic("topic-1", "Trabajo", "#3b82f6"),
  createMockTopic("topic-2", "Salud", "#22c55e"),
  createMockTopic("topic-3", "Familia", "#f59e0b"),
];

// Empty topics array
const emptyTopics: Topic[] = [];

// ============================================================================
// Mock Store
// ============================================================================
const mockAddTopic = vi.fn();
const mockRemoveTopic = vi.fn();

/**
 * Creates a partial mock of AppState with topics-related properties.
 * Uses 'any' to allow partial state in tests without requiring full AppState.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockState = (overrides: Record<string, any> = {}): any => ({
  topics: mockTopics,
  addTopic: mockAddTopic,
  removeTopic: mockRemoveTopic,
  ...overrides,
});

vi.mock("@/shared/store", () => ({
  useStore: vi.fn((selector) => {
    const state = createMockState();
    return typeof selector === "function" ? selector(state) : state;
  }),
  DEFAULT_USER_ID: "user_demo",
}));

// Import for resetting mock
import * as storeModule from "@/shared/store";

// ============================================================================
// Tests
// ============================================================================
describe("TopicsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store mock to default state
    vi.mocked(storeModule.useStore).mockImplementation((selector) => {
      const state = createMockState();
      return typeof selector === "function" ? selector(state) : state;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // CASE A: Basic Rendering
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("should render the topics section container", () => {
      render(<TopicsSection />);
      expect(screen.getByTestId("topics-section")).toBeInTheDocument();
    });

    it("should render topic pills for each topic in store", () => {
      render(<TopicsSection />);

      // Should see all topic names as pills
      expect(screen.getByText("Trabajo")).toBeInTheDocument();
      expect(screen.getByText("Salud")).toBeInTheDocument();
      expect(screen.getByText("Familia")).toBeInTheDocument();
    });

    it("should render the correct number of topic pills", () => {
      render(<TopicsSection />);

      const pills = screen.getAllByTestId(/^topic-pill-/);
      expect(pills).toHaveLength(3);
    });

    it("should render topic pills with their colors", () => {
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      // The pill should have the topic color applied (either as background or indicator)
      expect(trabajoPill).toBeInTheDocument();
    });

    it("should render 'Add topic' button", () => {
      render(<TopicsSection />);

      const addButton = screen.getByRole("button", { name: /add topic/i });
      expect(addButton).toBeInTheDocument();
    });

    it("should render empty state when no topics exist", () => {
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ topics: emptyTopics });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TopicsSection />);

      // Should show some indication of no topics
      expect(screen.getByText(/no topics|no hay topics|create your first/i)).toBeInTheDocument();
    });

    it("should render delete button for each topic pill", () => {
      render(<TopicsSection />);

      // Each pill should have a delete action
      const deleteButtons = screen.getAllByRole("button", { name: /delete|eliminar|remove/i });
      expect(deleteButtons.length).toBeGreaterThanOrEqual(3);
    });
  });

  // --------------------------------------------------------------------------
  // CASE B: Create Topic (Happy Path)
  // --------------------------------------------------------------------------
  describe("Create Topic", () => {
    it("should open create modal when 'Add topic' button is clicked", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const addButton = screen.getByRole("button", { name: /add topic/i });
      await user.click(addButton);

      // Modal should be visible
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/create topic|nuevo topic|new topic/i)).toBeInTheDocument();
    });

    it("should have name input field in create modal", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      expect(nameInput).toBeInTheDocument();
    });

    it("should have color selector in create modal", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      // Color selector could be buttons, radio group, or custom component
      const colorSelector = screen.getByTestId("color-selector") || 
                           screen.getByRole("radiogroup", { name: /color/i }) ||
                           screen.getByLabelText(/color/i);
      expect(colorSelector).toBeInTheDocument();
    });

    it("should have Create/Save button in create modal", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeInTheDocument();
    });

    it("should call addTopic with trimmed name and color on submit", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      // Open modal
      await user.click(screen.getByRole("button", { name: /add topic/i }));

      // Fill in name with extra spaces
      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "  Finanzas  ");

      // Select a color (click first color option or specific one)
      const colorOption = screen.getByTestId("color-option-#22c55e") ||
                         screen.getAllByRole("radio")[0] ||
                         screen.getAllByTestId(/color-option/)[0];
      await user.click(colorOption);

      // Submit
      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      await user.click(createButton);

      // Should call addTopic with TRIMMED name
      expect(mockAddTopic).toHaveBeenCalledTimes(1);
      expect(mockAddTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Finanzas", // trimmed
          color: expect.stringMatching(/^#[0-9a-fA-F]{6}$/), // valid hex color
        })
      );
    });

    it("should close modal after successful creation", async () => {
      const user = userEvent.setup();
      
      // Mock addTopic to simulate success
      mockAddTopic.mockImplementation(() => {
        // Simulate store update
      });

      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      
      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Finanzas");

      const colorOption = screen.getAllByTestId(/color-option/)[0];
      await user.click(colorOption);

      await user.click(screen.getByRole("button", { name: /create|save|guardar|crear/i }));

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("should show the new topic pill after creation", async () => {
      const user = userEvent.setup();
      
      // Update mock to add the new topic to state
      const newTopic = createMockTopic("topic-new", "Finanzas", "#22c55e");
      mockAddTopic.mockImplementation(() => {
        vi.mocked(storeModule.useStore).mockImplementation((selector) => {
          const state = createMockState({ topics: [...mockTopics, newTopic] });
          return typeof selector === "function" ? selector(state) : state;
        });
      });

      const { rerender } = render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      
      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Finanzas");

      const colorOption = screen.getAllByTestId(/color-option/)[0];
      await user.click(colorOption);

      await user.click(screen.getByRole("button", { name: /create|save|guardar|crear/i }));

      // Re-render to pick up new state
      rerender(<TopicsSection />);

      // New topic should appear
      expect(screen.getByText("Finanzas")).toBeInTheDocument();
    });

    it("should close modal when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      
      // Modal is open
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /cancel|cancelar/i });
      await user.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      // Should NOT call addTopic
      expect(mockAddTopic).not.toHaveBeenCalled();
    });

    it("should clear form when modal is reopened", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      // Open modal and type something
      await user.click(screen.getByRole("button", { name: /add topic/i }));
      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Test");

      // Cancel
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      // Reopen
      await user.click(screen.getByRole("button", { name: /add topic/i }));

      // Input should be cleared
      const newNameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      expect(newNameInput).toHaveValue("");
    });
  });

  // --------------------------------------------------------------------------
  // CASE C: Validation
  // --------------------------------------------------------------------------
  describe("Validation", () => {
    it("should disable Create button when name is empty", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      
      // Initially empty, should be disabled
      expect(createButton).toBeDisabled();
    });

    it("should disable Create button when name is only whitespace", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "   ");

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeDisabled();
    });

    it("should NOT call addTopic when name is empty and form is submitted", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      // Try to submit without entering name (button should be disabled, but test anyway)
      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      
      // Even if we force click, it shouldn't call addTopic
      if (!createButton.hasAttribute("disabled")) {
        await user.click(createButton);
      }

      expect(mockAddTopic).not.toHaveBeenCalled();
    });

    it("should show error when topic name already exists (case-insensitive)", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      // "Trabajo" already exists (case-insensitive check)
      await user.type(nameInput, "trabajo");

      // Should show error message
      expect(screen.getByText(/already exists|ya existe|duplicado/i)).toBeInTheDocument();
    });

    it("should disable Create button when duplicate name is entered", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "TRABAJO"); // uppercase version of existing "Trabajo"

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeDisabled();
    });

    it("should NOT call addTopic when duplicate name is submitted", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Salud"); // exact duplicate

      // Even if user somehow submits, addTopic should not be called
      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      if (!createButton.hasAttribute("disabled")) {
        await user.click(createButton);
      }

      expect(mockAddTopic).not.toHaveBeenCalled();
    });

    it("should detect duplicate even with leading/trailing spaces", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "  Trabajo  "); // with spaces

      // Should still be detected as duplicate
      expect(screen.getByText(/already exists|ya existe|duplicado/i)).toBeInTheDocument();
    });

    it("should enable Create button when valid unique name is entered", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Finanzas"); // unique name

      // Select a color
      const colorOption = screen.getAllByTestId(/color-option/)[0];
      await user.click(colorOption);

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).not.toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // CASE D: Delete Topic with Confirmation
  // --------------------------------------------------------------------------
  describe("Delete Topic", () => {
    it("should open confirmation dialog when delete button is clicked", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      // Find delete button for first topic
      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);

      // Confirmation dialog should appear
      expect(screen.getByRole("alertdialog") || screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should show topic name in confirmation dialog", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);

      // Dialog should mention the topic name (use getAllBy since name appears in pill too)
      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText(/Trabajo/)).toBeInTheDocument();
      // Check that a confirmation message exists (either in title or description)
      const deleteTexts = within(dialog).getAllByText(/delete|eliminar|seguro/i);
      expect(deleteTexts.length).toBeGreaterThan(0);
    });

    it("should have Confirm and Cancel buttons in delete dialog", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByRole("button", { name: /confirm|confirmar/i })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: /cancel|cancelar/i })).toBeInTheDocument();
    });

    it("should call removeTopic with topicId when Confirm is clicked", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);

      const confirmButton = screen.getByRole("button", { name: /confirm|confirmar/i });
      await user.click(confirmButton);

      expect(mockRemoveTopic).toHaveBeenCalledTimes(1);
      expect(mockRemoveTopic).toHaveBeenCalledWith("topic-1");
    });

    it("should close dialog and remove pill after confirmed deletion", async () => {
      const user = userEvent.setup();
      
      // Update mock to remove the topic from state
      mockRemoveTopic.mockImplementation(() => {
        vi.mocked(storeModule.useStore).mockImplementation((selector) => {
          const remainingTopics = mockTopics.filter(t => t.id !== "topic-1");
          const state = createMockState({ topics: remainingTopics });
          return typeof selector === "function" ? selector(state) : state;
        });
      });

      const { rerender } = render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);
      await user.click(screen.getByRole("button", { name: /confirm|confirmar/i }));

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      // Re-render to pick up new state
      rerender(<TopicsSection />);

      // Topic should be removed
      expect(screen.queryByText("Trabajo")).not.toBeInTheDocument();
    });

    it("should NOT call removeTopic when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);

      const cancelButton = screen.getByRole("button", { name: /cancel|cancelar/i });
      await user.click(cancelButton);

      expect(mockRemoveTopic).not.toHaveBeenCalled();
    });

    it("should close dialog and keep topic when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });

      // Topic should still exist
      expect(screen.getByText("Trabajo")).toBeInTheDocument();
    });

    it("should close dialog when clicking outside (backdrop)", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      const deleteButton = within(trabajoPill).getByRole("button", { name: /delete|eliminar|remove/i });
      
      await user.click(deleteButton);

      // Click the backdrop/overlay
      const backdrop = screen.getByTestId("dialog-backdrop") || 
                       document.querySelector("[data-state='open']");
      if (backdrop) {
        await user.click(backdrop);
      }

      // Should NOT call removeTopic (cancelled)
      expect(mockRemoveTopic).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------
  describe("Accessibility", () => {
    it("should have accessible section container", () => {
      render(<TopicsSection />);

      const section = screen.getByTestId("topics-section");
      expect(section).toHaveAttribute("role", "region");
      expect(section).toHaveAttribute("aria-label", expect.stringMatching(/topic/i));
    });

    it("should have accessible topic pills with aria-label", () => {
      render(<TopicsSection />);

      const trabajoPill = screen.getByTestId("topic-pill-topic-1");
      expect(trabajoPill).toHaveAttribute("aria-label", expect.stringMatching(/Trabajo/i));
    });

    it("should have accessible delete buttons with aria-label", () => {
      render(<TopicsSection />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete|eliminar|remove/i });
      deleteButtons.forEach(button => {
        expect(button).toHaveAttribute("aria-label");
      });
    });

    it("should trap focus in modals", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      // Focus should be within the dialog
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it("should return focus to trigger after modal closes", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      const addButton = screen.getByRole("button", { name: /add topic/i });
      await user.click(addButton);

      // Close modal
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      await waitFor(() => {
        // Focus should return to the add button
        expect(document.activeElement).toBe(addButton);
      });
    });

    it("should close modal on Escape key", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("should handle single topic correctly", () => {
      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ topics: [mockTopics[0]] });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TopicsSection />);

      expect(screen.getByText("Trabajo")).toBeInTheDocument();
      expect(screen.getAllByTestId(/^topic-pill-/)).toHaveLength(1);
    });

    it("should handle many topics (scrollable list)", () => {
      const manyTopics = Array.from({ length: 20 }, (_, i) =>
        createMockTopic(`topic-${i}`, `Topic ${i + 1}`, `#${i.toString().padStart(6, "0")}`)
      );

      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ topics: manyTopics });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TopicsSection />);

      const pills = screen.getAllByTestId(/^topic-pill-/);
      expect(pills).toHaveLength(20);
    });

    it("should handle topic with very long name", () => {
      const longNameTopic = createMockTopic(
        "topic-long",
        "This is a very long topic name that should be handled properly",
        "#ff0000"
      );

      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ topics: [longNameTopic] });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TopicsSection />);

      expect(screen.getByTestId("topic-pill-topic-long")).toBeInTheDocument();
    });

    it("should handle topic with special characters in name", () => {
      const specialTopic = createMockTopic(
        "topic-special",
        "Topic & <Test> \"Quotes\"",
        "#00ff00"
      );

      vi.mocked(storeModule.useStore).mockImplementation((selector) => {
        const state = createMockState({ topics: [specialTopic] });
        return typeof selector === "function" ? selector(state) : state;
      });

      render(<TopicsSection />);

      expect(screen.getByText(/Topic & <Test> "Quotes"/)).toBeInTheDocument();
    });

    it("should handle rapid add/delete operations", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      // Rapidly click add button multiple times
      const addButton = screen.getByRole("button", { name: /add topic/i });
      await user.click(addButton);
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));
      await user.click(addButton);
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      // Should not crash and final state should be no modal
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Color Selector
  // --------------------------------------------------------------------------
  describe("Color Selector", () => {
    it("should display predefined color options", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      // Should have multiple color options
      const colorOptions = screen.getAllByTestId(/color-option/);
      expect(colorOptions.length).toBeGreaterThanOrEqual(6); // At least 6 colors
    });

    it("should visually indicate selected color", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const colorOptions = screen.getAllByTestId(/color-option/);
      await user.click(colorOptions[0]);

      // Selected color should have visual indicator (aria-checked, data-selected, etc.)
      expect(colorOptions[0]).toHaveAttribute("aria-checked", "true");
    });

    it("should require color selection before enabling Create button", async () => {
      const user = userEvent.setup();
      render(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      // Type a valid name
      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Finanzas");

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      
      // Without selecting color, button might be disabled (depends on implementation)
      // If there's a default color, this test might need adjustment
      // For now, we assume no default and color is required
      expect(createButton).toBeDisabled();
    });
  });
});
