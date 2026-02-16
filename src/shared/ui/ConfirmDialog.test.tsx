import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  render(
    <ConfirmDialog
      open={true}
      title="Delete entry"
      message="This action cannot be undone."
      confirmText="Delete"
      cancelText="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        message="message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renders title and message when open", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete entry")).toBeInTheDocument();
    expect(
      screen.getByText("This action cannot be undone."),
    ).toBeInTheDocument();
  });

  it("uses aria-label fallback when title is not provided", () => {
    renderDialog({ title: undefined, ariaLabel: "Confirm custom action" });
    expect(
      screen.getByRole("alertdialog", { name: /confirm custom action/i }),
    ).toBeInTheDocument();
  });

  it("focuses cancel button by default", async () => {
    const user = userEvent.setup();
    renderDialog();
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await waitFor(() => expect(cancelButton).toHaveFocus());
    await user.click(cancelButton);
  });

  it("focuses confirm button when initialFocus is confirm", async () => {
    renderDialog({ initialFocus: "confirm" });
    const confirmButton = screen.getByRole("button", { name: /delete/i });
    await waitFor(() => expect(confirmButton).toHaveFocus());
  });

  it("calls onCancel when backdrop is clicked if closeOnBackdrop is true", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog({ closeOnBackdrop: true });

    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel on backdrop click when closeOnBackdrop is false", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog({ closeOnBackdrop: false });

    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel on Escape when not loading", () => {
    const { onCancel } = renderDialog({ loading: false });
    fireEvent.keyDown(
      screen.getByRole("alertdialog").parentElement as Element,
      {
        key: "Escape",
      },
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel on Escape when loading", () => {
    const { onCancel } = renderDialog({ loading: true });
    fireEvent.keyDown(
      screen.getByRole("alertdialog").parentElement as Element,
      {
        key: "Escape",
      },
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onConfirm when confirm is clicked and enabled", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm when disableConfirm is true", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ disableConfirm: true });
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows loading spinner and disables action buttons when loading", () => {
    renderDialog({ loading: true });
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    const confirmButton = screen.getByRole("button", { name: /delete/i });
    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });

  it("applies non-destructive confirm styling when destructive is false", () => {
    renderDialog({ destructive: false, confirmText: "Confirm" });
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton.className).toContain("bg-sky-500/80");
  });
});
