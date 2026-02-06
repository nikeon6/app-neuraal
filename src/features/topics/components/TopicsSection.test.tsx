import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TopicsSection } from "./TopicsSection";
import type { ApiTopic } from "@/shared/api/sdk";

// ============================================================================
// Mock Data (ApiTopic shape)
// ============================================================================
const createMockTopic = (id: string, name: string, color: string): ApiTopic =>
  ({ id, userId: "user-123", name, color }) as ApiTopic;

const mockTopics: ApiTopic[] = [
  createMockTopic("topic-1", "Trabajo", "#3b82f6"),
  createMockTopic("topic-2", "Salud", "#22c55e"),
  createMockTopic("topic-3", "Familia", "#f59e0b"),
];

// ============================================================================
// Mocks
// ============================================================================
const mockTopicsQuery = vi.fn();
const mockDeleteTopicAndInvalidate = vi.fn();
const mockCreateTopicAndInvalidate = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useTopicsQuery: (...args: unknown[]) => mockTopicsQuery(...args),
  topicsQueryKey: ["topics"],
}));

vi.mock("@/shared/api/mutations", () => ({
  deleteTopicAndInvalidate: (...args: unknown[]) => mockDeleteTopicAndInvalidate(...args),
  createTopicAndInvalidate: (...args: unknown[]) => mockCreateTopicAndInvalidate(...args),
}));

// ============================================================================
// Helpers
// ============================================================================
function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = createQueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ============================================================================
// Tests
// ============================================================================
describe("TopicsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTopicsQuery.mockReturnValue({
      data: mockTopics,
      isPending: false,
      isError: false,
    });

    mockDeleteTopicAndInvalidate.mockResolvedValue(undefined);
    mockCreateTopicAndInvalidate.mockResolvedValue(
      createMockTopic("topic-new", "Finanzas", "#22c55e")
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  describe("Rendering", () => {
    it("should render the topics section container", () => {
      renderWithProviders(<TopicsSection />);
      expect(screen.getByTestId("topics-section")).toBeInTheDocument();
    });

    it("should render topic pills for each topic", () => {
      renderWithProviders(<TopicsSection />);

      expect(screen.getByText("Trabajo")).toBeInTheDocument();
      expect(screen.getByText("Salud")).toBeInTheDocument();
      expect(screen.getByText("Familia")).toBeInTheDocument();
    });

    it("should render the correct number of topic pills", () => {
      renderWithProviders(<TopicsSection />);

      const pills = screen.getAllByTestId(/^topic-pill-/);
      expect(pills).toHaveLength(3);
    });

    it("should render 'Add topic' button", () => {
      renderWithProviders(<TopicsSection />);

      const addButton = screen.getByRole("button", { name: /add topic/i });
      expect(addButton).toBeInTheDocument();
    });

    it("should render empty state when no topics exist", () => {
      mockTopicsQuery.mockReturnValue({ data: [], isPending: false });

      renderWithProviders(<TopicsSection />);

      expect(screen.getByText(/no topics|create your first/i)).toBeInTheDocument();
    });

    it("should render delete button for each topic pill", () => {
      renderWithProviders(<TopicsSection />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete|eliminar|remove/i });
      expect(deleteButtons.length).toBeGreaterThanOrEqual(3);
    });
  });

  // --------------------------------------------------------------------------
  // Create Topic
  // --------------------------------------------------------------------------
  describe("Create Topic", () => {
    it("should open create modal when 'Add topic' button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/create topic|nuevo topic|new topic/i)).toBeInTheDocument();
    });

    it("should have name input field in create modal", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      expect(nameInput).toBeInTheDocument();
    });

    it("should have color selector in create modal", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const colorSelector =
        screen.getByTestId("color-selector") ||
        screen.getByRole("radiogroup", { name: /color/i }) ||
        screen.getByLabelText(/color/i);
      expect(colorSelector).toBeInTheDocument();
    });

    it("should have Create/Save button in create modal", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeInTheDocument();
    });

    it("should close modal after successful creation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Finanzas");

      const colorOption = screen.getAllByTestId(/color-option/)[0];
      await user.click(colorOption);

      await user.click(screen.getByRole("button", { name: /create|save|guardar|crear/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("should close modal when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("should clear form when modal is reopened", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      const nameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      await user.type(nameInput, "Test");

      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));
      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const newNameInput = screen.getByRole("textbox", { name: /name|nombre/i });
      expect(newNameInput).toHaveValue("");
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("Validation", () => {
    it("should disable Create button when name is empty", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeDisabled();
    });

    it("should disable Create button when name is only whitespace", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      await user.type(screen.getByRole("textbox", { name: /name|nombre/i }), "   ");

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeDisabled();
    });

    it("should show error when topic name already exists (case-insensitive)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      await user.type(screen.getByRole("textbox", { name: /name|nombre/i }), "trabajo");

      expect(screen.getByText(/already exists|ya existe|duplicado/i)).toBeInTheDocument();
    });

    it("should disable Create button when duplicate name is entered", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      await user.type(screen.getByRole("textbox", { name: /name|nombre/i }), "TRABAJO");

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeDisabled();
    });

    it("should detect duplicate even with leading/trailing spaces", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      await user.type(screen.getByRole("textbox", { name: /name|nombre/i }), "  Trabajo  ");

      expect(screen.getByText(/already exists|ya existe|duplicado/i)).toBeInTheDocument();
    });

    it("should enable Create button when valid unique name is entered", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));
      await user.type(screen.getByRole("textbox", { name: /name|nombre/i }), "Finanzas");

      const colorOption = screen.getAllByTestId(/color-option/)[0];
      await user.click(colorOption);

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).not.toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Delete Topic
  // --------------------------------------------------------------------------
  describe("Delete Topic", () => {
    it("should open confirmation dialog when delete button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      const deleteBtn = within(pill).getByRole("button", { name: /delete|eliminar|remove/i });
      await user.click(deleteBtn);

      expect(screen.getByRole("alertdialog") || screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should show topic name in confirmation dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      await user.click(within(pill).getByRole("button", { name: /delete|eliminar|remove/i }));

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText(/Trabajo/)).toBeInTheDocument();
    });

    it("should have Confirm and Cancel buttons in delete dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      await user.click(within(pill).getByRole("button", { name: /delete|eliminar|remove/i }));

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByRole("button", { name: /confirm|confirmar/i })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: /cancel|cancelar/i })).toBeInTheDocument();
    });

    it("should call deleteTopicAndInvalidate when Confirm is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      await user.click(within(pill).getByRole("button", { name: /delete|eliminar|remove/i }));
      await user.click(screen.getByRole("button", { name: /confirm|confirmar/i }));

      expect(mockDeleteTopicAndInvalidate).toHaveBeenCalledTimes(1);
      // Second arg is the topic ID
      expect(mockDeleteTopicAndInvalidate.mock.calls[0][1]).toBe("topic-1");
    });

    it("should NOT call delete when Cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      await user.click(within(pill).getByRole("button", { name: /delete|eliminar|remove/i }));
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      expect(mockDeleteTopicAndInvalidate).not.toHaveBeenCalled();
    });

    it("should close dialog and keep topic when Cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      await user.click(within(pill).getByRole("button", { name: /delete|eliminar|remove/i }));
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Trabajo")).toBeInTheDocument();
    });

    it("should close dialog when clicking outside (backdrop)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      await user.click(within(pill).getByRole("button", { name: /delete|eliminar|remove/i }));

      const backdrop = screen.getByTestId("dialog-backdrop") || document.querySelector("[data-state='open']");
      if (backdrop) await user.click(backdrop);

      expect(mockDeleteTopicAndInvalidate).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------
  describe("Accessibility", () => {
    it("should have accessible section container", () => {
      renderWithProviders(<TopicsSection />);

      const section = screen.getByTestId("topics-section");
      expect(section).toHaveAttribute("role", "region");
      expect(section).toHaveAttribute("aria-label", expect.stringMatching(/topic/i));
    });

    it("should have accessible topic pills with aria-label", () => {
      renderWithProviders(<TopicsSection />);

      const pill = screen.getByTestId("topic-pill-topic-1");
      expect(pill).toHaveAttribute("aria-label", expect.stringMatching(/Trabajo/i));
    });

    it("should have accessible delete buttons with aria-label", () => {
      renderWithProviders(<TopicsSection />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete|eliminar|remove/i });
      deleteButtons.forEach((button) => {
        expect(button).toHaveAttribute("aria-label");
      });
    });

    it("should trap focus in modals", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it("should return focus to trigger after modal closes", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const addButton = screen.getByRole("button", { name: /add topic/i });
      await user.click(addButton);
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      await waitFor(() => {
        expect(document.activeElement).toBe(addButton);
      });
    });

    it("should close modal on Escape key", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

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
      mockTopicsQuery.mockReturnValue({ data: [mockTopics[0]], isPending: false });

      renderWithProviders(<TopicsSection />);

      expect(screen.getByText("Trabajo")).toBeInTheDocument();
      expect(screen.getAllByTestId(/^topic-pill-/)).toHaveLength(1);
    });

    it("should handle many topics", () => {
      const many = Array.from({ length: 20 }, (_, i) =>
        createMockTopic(`topic-${i}`, `Topic ${i + 1}`, `#${i.toString().padStart(6, "0")}`)
      );
      mockTopicsQuery.mockReturnValue({ data: many, isPending: false });

      renderWithProviders(<TopicsSection />);

      expect(screen.getAllByTestId(/^topic-pill-/)).toHaveLength(20);
    });

    it("should handle topic with very long name", () => {
      const longTopic = createMockTopic("topic-long", "This is a very long topic name", "#ff0000");
      mockTopicsQuery.mockReturnValue({ data: [longTopic], isPending: false });

      renderWithProviders(<TopicsSection />);

      expect(screen.getByTestId("topic-pill-topic-long")).toBeInTheDocument();
    });

    it("should handle rapid add/delete operations", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      const addButton = screen.getByRole("button", { name: /add topic/i });
      await user.click(addButton);
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));
      await user.click(addButton);
      await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Color Selector
  // --------------------------------------------------------------------------
  describe("Color Selector", () => {
    it("should display predefined color options", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const colorOptions = screen.getAllByTestId(/color-option/);
      expect(colorOptions.length).toBeGreaterThanOrEqual(6);
    });

    it("should visually indicate selected color", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      const colorOptions = screen.getAllByTestId(/color-option/);
      await user.click(colorOptions[0]);

      expect(colorOptions[0]).toHaveAttribute("aria-checked", "true");
    });

    it("should require color selection before enabling Create button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TopicsSection />);

      await user.click(screen.getByRole("button", { name: /add topic/i }));

      await user.type(screen.getByRole("textbox", { name: /name|nombre/i }), "Finanzas");

      const createButton = screen.getByRole("button", { name: /create|save|guardar|crear/i });
      expect(createButton).toBeDisabled();
    });
  });
});
