import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
        ref: React.Ref<HTMLDivElement>,
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      ),
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
    Element.prototype.scrollIntoView = vi.fn();
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
        screen.getByRole("dialog", { name: /schedule reminder/i }),
      ).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      renderDialog({ open: false });

      expect(
        screen.queryByRole("dialog", { name: /schedule reminder/i }),
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

      const backdrop = screen.getByLabelText(/close reminder dialog/i);
      await user.click(backdrop);

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
        screen.queryByPlaceholderText("Reminder message..."),
      ).not.toBeInTheDocument();
    });

    it("disables WhatsApp when no phone number is configured", () => {
      renderDialog({ userPhoneNumber: null });

      const whatsappBtn = screen.getByText("WhatsApp");
      expect(whatsappBtn).toBeDisabled();
    });

    it("shows a warning about phone number when none is configured", () => {
      renderDialog({ userPhoneNumber: null });

      expect(
        screen.getByText(/WhatsApp requires a phone number/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
    });

    it("enables WhatsApp when a phone number is configured", async () => {
      const user = userEvent.setup();
      renderDialog({ userPhoneNumber: "+34612345678" });

      const whatsappBtn = screen.getByText("WhatsApp");
      expect(whatsappBtn).not.toBeDisabled();

      await user.click(whatsappBtn);
      expect(whatsappBtn.className).toContain("sky");
    });

    it("does not show the phone warning when phone is configured", () => {
      renderDialog({ userPhoneNumber: "+34612345678" });

      expect(
        screen.queryByText(/WhatsApp requires a phone number/i),
      ).not.toBeInTheDocument();
    });

    it("prevents selecting WhatsApp by clicking when disabled", async () => {
      const user = userEvent.setup();
      renderDialog({ userPhoneNumber: null });

      const whatsappBtn = screen.getByText("WhatsApp");
      await user.click(whatsappBtn);

      // Push should still be selected (not WhatsApp)
      const pushBtn = screen.getByText("Push");
      expect(pushBtn.className).toContain("sky");
      expect(whatsappBtn.className).not.toContain("sky");
    });
  });

  // --------------------------------------------------------------------------
  // Create Mode (no active reminder)
  // --------------------------------------------------------------------------

  describe("Create mode", () => {
    it("shows 'Schedule' button when there is no active reminder", () => {
      renderDialog({ hasActiveReminder: false });

      expect(
        screen.getByRole("button", { name: /schedule/i }),
      ).toBeInTheDocument();
    });

    it("does not show Reschedule or Cancel buttons", () => {
      renderDialog({ hasActiveReminder: false });

      expect(
        screen.queryByRole("button", { name: /reschedule/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /cancel reminder/i }),
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
        screen.getByRole("button", { name: /scheduling/i }),
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
        screen.getByRole("button", { name: /reschedule/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel reminder/i }),
      ).toBeInTheDocument();
    });

    it("does not show Schedule button when active reminder exists", () => {
      renderDialog({ hasActiveReminder: true });

      expect(
        screen.queryByRole("button", { name: /^schedule$/i }),
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
        screen.getByRole("button", { name: /cancel reminder/i }),
      );

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("shows 'Saving...' on reschedule button when isSaving", () => {
      renderDialog({ hasActiveReminder: true, isSaving: true });

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    it("disables reschedule and cancel buttons when isSaving", () => {
      renderDialog({ hasActiveReminder: true, isSaving: true });

      expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /cancel reminder/i }),
      ).toBeDisabled();
    });

    it("shows validation error and blocks reschedule when selected time is in the past", async () => {
      vi.spyOn(Date, "now").mockReturnValue(
        new Date("2099-01-01T00:00:00.000Z").getTime(),
      );
      const onReschedule = vi.fn();
      const user = userEvent.setup();
      renderDialog({ hasActiveReminder: true, onReschedule });

      await user.click(screen.getByRole("button", { name: /reschedule/i }));

      expect(
        screen.getByText(/the selected date and time is in the past/i),
      ).toBeInTheDocument();
      expect(onReschedule).not.toHaveBeenCalled();
    });

    it("clears validation error after changing date or time fields", async () => {
      vi.spyOn(Date, "now").mockReturnValue(
        new Date("2099-01-01T00:00:00.000Z").getTime(),
      );
      const user = userEvent.setup();
      renderDialog({ hasActiveReminder: true });

      await user.click(screen.getByRole("button", { name: /reschedule/i }));
      expect(
        screen.getByText(/the selected date and time is in the past/i),
      ).toBeInTheDocument();

      // Date change clears error
      await user.click(screen.getByRole("button", { name: /next month/i }));
      await user.click(screen.getByRole("button", { name: "1" }));
      await waitFor(() => {
        expect(
          screen.queryByText(/the selected date and time is in the past/i),
        ).not.toBeInTheDocument();
      });

      // Re-trigger error, then hour change clears it
      await user.click(screen.getByRole("button", { name: /reschedule/i }));
      expect(
        screen.getByText(/the selected date and time is in the past/i),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /hour/i }));
      const hourOption = screen.getAllByRole("button", { name: "10" }).at(-1);
      expect(hourOption).toBeDefined();
      await user.click(hourOption as HTMLButtonElement);
      await waitFor(() => {
        expect(
          screen.queryByText(/the selected date and time is in the past/i),
        ).not.toBeInTheDocument();
      });

      // Re-trigger error, then minute change clears it
      await user.click(screen.getByRole("button", { name: /reschedule/i }));
      expect(
        screen.getByText(/the selected date and time is in the past/i),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /minute/i }));
      const minuteOption = screen.getAllByRole("button", { name: "05" }).at(-1);
      expect(minuteOption).toBeDefined();
      await user.click(minuteOption as HTMLButtonElement);
      await waitFor(() => {
        expect(
          screen.queryByText(/the selected date and time is in the past/i),
        ).not.toBeInTheDocument();
      });
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
        screen.getByRole("dialog", { name: /schedule reminder/i }),
      ).toBeInTheDocument();
    });
  });
});
