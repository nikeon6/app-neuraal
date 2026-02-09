import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { ReminderDialog, type ReminderDialogProps } from "./ReminderDialog";

// ============================================================================
// Mocks
// ============================================================================

// Mock Framer Motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(
      (
        { children, ...props }: React.HTMLAttributes<HTMLDivElement>,
        ref: React.Ref<HTMLDivElement>
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ============================================================================
// Helpers
// ============================================================================

const defaultProps: ReminderDialogProps = {
  open: true,
  onClose: vi.fn(),
  onCreate: vi.fn(),
  onReschedule: vi.fn(),
  onCancel: vi.fn(),
  hasActiveReminder: false,
  isSaving: false,
};

function renderDialog(overrides: Partial<ReminderDialogProps> = {}) {
  return render(<ReminderDialog {...defaultProps} {...overrides} />);
}

// ============================================================================
// Tests
// ============================================================================

describe("ReminderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Rendering & Visibility
  // --------------------------------------------------------------------------

  describe("Rendering", () => {
    it("renders the dialog when open is true", () => {
      renderDialog();

      expect(
        screen.getByRole("dialog", { name: /schedule reminder/i })
      ).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      renderDialog({ open: false });

      expect(
        screen.queryByRole("dialog", { name: /schedule reminder/i })
      ).not.toBeInTheDocument();
    });

    it("shows 'Schedule Reminder' title when no active reminder", () => {
      renderDialog({ hasActiveReminder: false });

      expect(screen.getByText("Schedule Reminder")).toBeInTheDocument();
    });

    it("shows 'Manage Reminder' title when there is an active reminder", () => {
      renderDialog({ hasActiveReminder: true });

      expect(screen.getByText("Manage Reminder")).toBeInTheDocument();
    });

    it("renders via portal to document.body", () => {
      renderDialog();

      // The dialog should be a direct child of document.body (via portal)
      const dialog = screen.getByRole("dialog");
      expect(dialog.closest("body > *")).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // Close Behavior
  // --------------------------------------------------------------------------

  describe("Close behavior", () => {
    it("calls onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderDialog({ onClose });

      await user.click(screen.getByRole("button", { name: /close/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderDialog({ onClose });

      // Backdrop has the bg-black/50 class
      const backdrop = document.querySelector("[class*='bg-black']");
      expect(backdrop).toBeInTheDocument();
      await user.click(backdrop as HTMLElement);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Form Fields
  // --------------------------------------------------------------------------

  describe("Form fields", () => {
    it("renders a date/time picker section", () => {
      renderDialog();

      expect(screen.getByText("Date & Time")).toBeInTheDocument();
    });

    it("renders all channel options (no SMS)", () => {
      renderDialog();

      expect(screen.getByText("Push")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("WhatsApp")).toBeInTheDocument();
      expect(screen.queryByText("SMS")).not.toBeInTheDocument();
    });

    it("allows selecting a channel", async () => {
      const user = userEvent.setup();
      renderDialog();

      const emailBtn = screen.getByText("Email");
      await user.click(emailBtn);

      // Email should be visually selected (has the sky/selected style)
      expect(emailBtn.className).toContain("sky");
    });

    it("does not render the message field (hidden for MVP)", () => {
      renderDialog();

      expect(screen.queryByText("Message (optional)")).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Reminder message...")
      ).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Create Mode (no active reminder)
  // --------------------------------------------------------------------------

  describe("Create mode", () => {
    it("shows 'Schedule' button when there is no active reminder", () => {
      renderDialog({ hasActiveReminder: false });

      expect(
        screen.getByRole("button", { name: /schedule/i })
      ).toBeInTheDocument();
    });

    it("does not show Reschedule or Cancel buttons", () => {
      renderDialog({ hasActiveReminder: false });

      expect(
        screen.queryByRole("button", { name: /reschedule/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /cancel reminder/i })
      ).not.toBeInTheDocument();
    });

    it("calls onCreate with ISO UTC date and channel", async () => {
      const onCreate = vi.fn();
      const user = userEvent.setup();
      renderDialog({ hasActiveReminder: false, onCreate });

      // Click schedule
      await user.click(screen.getByRole("button", { name: /schedule/i }));

      expect(onCreate).toHaveBeenCalledTimes(1);
      const [isoDate, channel] = onCreate.mock.calls[0];
      // Should be a valid ISO string
      expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Default channel is "push"
      expect(channel).toBe("push");
    });

    it("shows 'Scheduling...' when isSaving is true", () => {
      renderDialog({ hasActiveReminder: false, isSaving: true });

      expect(screen.getByText("Scheduling...")).toBeInTheDocument();
    });

    it("disables the schedule button when isSaving", () => {
      renderDialog({ hasActiveReminder: false, isSaving: true });

      expect(
        screen.getByRole("button", { name: /scheduling/i })
      ).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Manage Mode (active reminder)
  // --------------------------------------------------------------------------

  describe("Manage mode (active reminder)", () => {
    it("shows Reschedule and Cancel buttons when there is an active reminder", () => {
      renderDialog({ hasActiveReminder: true });

      expect(
        screen.getByRole("button", { name: /reschedule/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel reminder/i })
      ).toBeInTheDocument();
    });

    it("does not show Schedule button when active reminder exists", () => {
      renderDialog({ hasActiveReminder: true });

      expect(
        screen.queryByRole("button", { name: /^schedule$/i })
      ).not.toBeInTheDocument();
    });

    it("calls onReschedule with ISO UTC date when reschedule is clicked", async () => {
      const onReschedule = vi.fn();
      const user = userEvent.setup();
      renderDialog({ hasActiveReminder: true, onReschedule });

      await user.click(screen.getByRole("button", { name: /reschedule/i }));

      expect(onReschedule).toHaveBeenCalledTimes(1);
      const [isoDate] = onReschedule.mock.calls[0];
      expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("calls onCancel when cancel reminder is clicked", async () => {
      const onCancel = vi.fn();
      const user = userEvent.setup();
      renderDialog({ hasActiveReminder: true, onCancel });

      await user.click(
        screen.getByRole("button", { name: /cancel reminder/i })
      );

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("shows 'Saving...' on reschedule button when isSaving", () => {
      renderDialog({ hasActiveReminder: true, isSaving: true });

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    it("disables reschedule and cancel buttons when isSaving", () => {
      renderDialog({ hasActiveReminder: true, isSaving: true });

      expect(
        screen.getByRole("button", { name: /saving/i })
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /cancel reminder/i })
      ).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("has role=dialog and aria-modal=true", () => {
      renderDialog();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("has an accessible label", () => {
      renderDialog();

      expect(
        screen.getByRole("dialog", { name: /schedule reminder/i })
      ).toBeInTheDocument();
    });
  });
});
