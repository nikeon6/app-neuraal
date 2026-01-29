import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskEditor } from "./TaskEditor";

// Mock the store
vi.mock("@/shared/store", () => ({
  useStore: vi.fn(() => ({
    selectedDay: 15,
    selectedDate: new Date("2024-01-15"),
    addTask: vi.fn(),
    removeTask: vi.fn(),
  })),
}));

describe("TaskEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to expand the editor by clicking inside it
  const expandEditor = async (user: ReturnType<typeof userEvent.setup>) => {
    const editor = screen.getByTestId("task-editor");
    await user.click(editor);
  };

  describe("Rendering", () => {
    it("should render the component", () => {
      render(<TaskEditor />);
      expect(screen.getByTestId("task-editor")).toBeInTheDocument();
    });

    it("should render title input field", () => {
      render(<TaskEditor />);
      expect(screen.getByRole("textbox", { name: /title/i })).toBeInTheDocument();
    });

    it("should render content area", () => {
      render(<TaskEditor />);
      expect(screen.getByRole("textbox", { name: /content/i })).toBeInTheDocument();
    });

    it("should render topic selector", () => {
      render(<TaskEditor />);
      expect(screen.getByRole("button", { name: /topic/i })).toBeInTheDocument();
    });

    it("should render 'Auto' option in topic selector", () => {
      render(<TaskEditor />);
      const topicButton = screen.getByRole("button", { name: /topic/i });
      expect(topicButton).toHaveTextContent(/auto/i);
    });
  });

  describe("Bottom Left Buttons", () => {
    it("should render content button when expanded", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      expect(screen.getByRole("button", { name: /add content/i })).toBeInTheDocument();
    });

    it("should render format button when expanded", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      expect(screen.getByRole("button", { name: /format/i })).toBeInTheDocument();
    });

    it("should open content dropdown when content button is clicked", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      const contentButton = screen.getByRole("button", { name: /add content/i });
      await user.click(contentButton);
      
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("should show image option in content dropdown", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      const contentButton = screen.getByRole("button", { name: /add content/i });
      await user.click(contentButton);
      
      expect(screen.getByRole("menuitem", { name: /image/i })).toBeInTheDocument();
    });

    it("should show code snippet option in content dropdown", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      const contentButton = screen.getByRole("button", { name: /add content/i });
      await user.click(contentButton);
      
      expect(screen.getByRole("menuitem", { name: /code/i })).toBeInTheDocument();
    });

    it("should show YouTube video option in content dropdown", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      const contentButton = screen.getByRole("button", { name: /add content/i });
      await user.click(contentButton);
      
      expect(screen.getByRole("menuitem", { name: /youtube|video/i })).toBeInTheDocument();
    });

    it("should show file attachment option in content dropdown", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      const contentButton = screen.getByRole("button", { name: /add content/i });
      await user.click(contentButton);
      
      expect(screen.getByRole("menuitem", { name: /file|attach/i })).toBeInTheDocument();
    });
  });

  describe("Top Right Buttons", () => {
    it("should render subconscious button", () => {
      render(<TaskEditor />);
      expect(screen.getByRole("button", { name: /subconscious/i })).toBeInTheDocument();
    });

    it("should render brainstorming button", () => {
      render(<TaskEditor />);
      expect(screen.getByRole("button", { name: /brainstorming/i })).toBeInTheDocument();
    });
  });

  describe("Delete Button", () => {
    it("should render delete button when expanded", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("should call removeTask when delete button is clicked", async () => {
      const user = userEvent.setup();
      const mockRemoveTask = vi.fn();
      
      vi.mocked(await import("@/shared/store")).useStore.mockReturnValue({
        selectedDay: 15,
        selectedDate: new Date("2024-01-15"),
        addTask: vi.fn(),
        removeTask: mockRemoveTask,
      });
      
      render(<TaskEditor entryId="test-task-id" />);
      await expandEditor(user);
      
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      await user.click(deleteButton);
      
      expect(mockRemoveTask).toHaveBeenCalled();
    });
  });

  describe("Title Input", () => {
    it("should allow typing in title field", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      const titleInput = screen.getByRole("textbox", { name: /title/i });
      await user.type(titleInput, "My Task Title");
      
      expect(titleInput).toHaveValue("My Task Title");
    });

    it("should have placeholder text", () => {
      render(<TaskEditor />);
      const titleInput = screen.getByRole("textbox", { name: /title/i });
      expect(titleInput).toHaveAttribute("placeholder");
    });
  });

  describe("Content Area", () => {
    it("should allow typing in content area", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      const contentArea = screen.getByRole("textbox", { name: /content/i });
      await user.type(contentArea, "My task content here");
      
      expect(contentArea).toHaveValue("My task content here");
    });

    it("should be a large text area", () => {
      render(<TaskEditor />);
      const contentArea = screen.getByRole("textbox", { name: /content/i });
      // Content area should be a textarea (large area)
      expect(contentArea.tagName.toLowerCase()).toBe("textarea");
    });
  });

  describe("Topic Selector", () => {
    it("should display available topics when clicked", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      const topicButton = screen.getByRole("button", { name: /topic/i });
      await user.click(topicButton);
      
      // Should show listbox with options
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("should allow selecting a topic", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      const topicButton = screen.getByRole("button", { name: /topic/i });
      await user.click(topicButton);
      
      // Click on Trabajo (Work in Spanish) option
      const trabajoOption = screen.getByRole("option", { name: /trabajo/i });
      await user.click(trabajoOption);
      
      // Button should now show Trabajo
      expect(topicButton).toHaveTextContent(/trabajo/i);
    });

    it("should have auto option as first choice", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      const topicButton = screen.getByRole("button", { name: /topic/i });
      await user.click(topicButton);
      
      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveTextContent(/auto/i);
    });
  });

  describe("Auto-save", () => {
    it("should auto-save when title changes", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      const titleInput = screen.getByRole("textbox", { name: /title/i });
      await user.type(titleInput, "Auto-saved title");
      
      // Editor should be expanded after typing, showing the indicator
      await waitFor(() => {
        expect(screen.queryByTestId("auto-save-indicator")).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it("should auto-save when content changes", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      const contentArea = screen.getByRole("textbox", { name: /content/i });
      await user.type(contentArea, "Auto-saved content");
      
      // Editor should be expanded after typing, showing the indicator
      await waitFor(() => {
        expect(screen.queryByTestId("auto-save-indicator")).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it("should not have a save button (auto-save only)", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    });
  });

  describe("File Size Limit", () => {
    it("should display file size limit information", () => {
      render(<TaskEditor />);
      // Should show 20MB limit somewhere in the UI
      expect(screen.getByText(/20\s*mb/i)).toBeInTheDocument();
    });

    it("should show current usage of file storage", () => {
      render(<TaskEditor />);
      expect(screen.getByTestId("file-size-indicator")).toBeInTheDocument();
    });
  });

  describe("Expand/Collapse Behavior", () => {
    it("should expand when clicking inside the editor", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      // Bottom toolbar should not be visible initially
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
      
      await expandEditor(user);
      
      // Bottom toolbar should be visible after clicking
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("should show bottom toolbar when expanded", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      await expandEditor(user);
      
      expect(screen.getByRole("button", { name: /add content/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /format/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper labels for all inputs", () => {
      render(<TaskEditor />);
      
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /content/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /topic/i })).toBeInTheDocument();
    });

    it("should be navigable with keyboard", async () => {
      const user = userEvent.setup();
      render(<TaskEditor />);
      
      // Tab through interactive elements
      await user.tab(); // Complete button (first for tasks)
      expect(screen.getByRole("button", { name: /mark as complete/i })).toHaveFocus();
      
      await user.tab(); // Title input
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveFocus();
      
      await user.tab(); // Entry type toggle
      await user.tab(); // Topic button
      await user.tab(); // Subconscious button
      await user.tab(); // Brainstorming button
      await user.tab(); // Content textarea
      expect(screen.getByRole("textbox", { name: /content/i })).toHaveFocus();
    });
  });
});
