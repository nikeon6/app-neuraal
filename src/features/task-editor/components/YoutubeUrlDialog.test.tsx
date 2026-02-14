import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { YoutubeUrlDialog } from "./YoutubeUrlDialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof YoutubeUrlDialog>> = {},
) {
  const onClose = vi.fn();
  const onSubmit = vi.fn();

  render(
    <YoutubeUrlDialog
      isOpen={true}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

  return { onClose, onSubmit };
}

describe("YoutubeUrlDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(
      <YoutubeUrlDialog isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(
      screen.queryByRole("dialog", { name: /embed youtube video/i }),
    ).not.toBeInTheDocument();
  });

  it("shows validation error and keeps embed disabled for invalid url", async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.getByLabelText(/youtube url/i);
    await user.type(input, "https://example.com/not-youtube");

    expect(screen.getByText(/enter a valid youtube url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /embed/i })).toBeDisabled();
  });

  it("enables embed for valid youtube url and submits", async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderDialog();

    const input = screen.getByLabelText(/youtube url/i);
    await user.type(input, "https://www.youtube.com/watch?v=abc123");

    const embedBtn = screen.getByRole("button", { name: /embed/i });
    expect(embedBtn).toBeEnabled();

    await user.click(embedBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=abc123",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with cancel button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    // Backdrop is the first absolute overlay div.
    const backdrop = document.querySelector(".absolute.inset-0");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape key", async () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(document.querySelector(".fixed.inset-0") as Element, {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the input shortly after opening", async () => {
    renderDialog();
    const input = screen.getByLabelText(/youtube url/i);

    await new Promise((resolve) => setTimeout(resolve, 70));
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });
});
