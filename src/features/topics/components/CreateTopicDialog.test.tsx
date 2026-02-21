import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateTopicDialog } from "./CreateTopicDialog";
import type { ApiTopic } from "@/shared/api/sdk";
import { createTopicAndInvalidate } from "@/shared/api/mutations";

vi.mock("@/shared/api/mutations", () => ({
  createTopicAndInvalidate: vi.fn(),
}));

const mockCreateTopicAndInvalidate = vi.mocked(createTopicAndInvalidate);

function makeTopic(partial: Partial<ApiTopic>): ApiTopic {
  return {
    id: partial.id ?? "topic-1",
    name: partial.name ?? "Work",
    color: partial.color ?? "#22c55e",
  } as ApiTopic;
}

function renderDialog(opts?: {
  isOpen?: boolean;
  existingTopics?: ApiTopic[];
  onClose?: () => void;
  triggerButton?: HTMLButtonElement;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = opts?.onClose ?? vi.fn();
  const triggerButton = opts?.triggerButton ?? document.createElement("button");
  document.body.appendChild(triggerButton);
  const triggerRef = { current: triggerButton };

  const view = render(
    <QueryClientProvider client={queryClient}>
      <CreateTopicDialog
        isOpen={opts?.isOpen ?? true}
        onClose={onClose}
        existingTopics={opts?.existingTopics ?? []}
        triggerRef={triggerRef}
      />
    </QueryClientProvider>,
  );

  return { ...view, onClose, triggerButton };
}

describe("CreateTopicDialog", () => {
  beforeEach(() => {
    mockCreateTopicAndInvalidate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not render when closed", () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows duplicate validation and keeps create disabled", async () => {
    const user = userEvent.setup();
    renderDialog({ existingTopics: [makeTopic({ name: "Work" })] });

    await user.type(screen.getByLabelText(/topic name/i), "work");
    expect(screen.getByText(/topic already exists/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
  });

  it("shows min-length validation and prevents submit for one-letter names", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/topic name/i), "a");
    await user.click(
      screen.getByRole("radio", { name: /select color #3b82f6/i }),
    );

    expect(
      screen.getByText(/topic name must be at least 2 characters/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
    expect(mockCreateTopicAndInvalidate).not.toHaveBeenCalled();
  });

  it("prevents selecting used color", async () => {
    const user = userEvent.setup();
    renderDialog({ existingTopics: [makeTopic({ color: "#22c55e" })] });

    const usedColor = screen.getByRole("radio", {
      name: /already in use/i,
    });
    expect(usedColor).toHaveAttribute("aria-disabled", "true");

    await user.type(screen.getByLabelText(/topic name/i), "New topic");
    await user.click(usedColor);
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
  });

  it("submits trimmed name with selected color", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateTopicAndInvalidate.mockResolvedValue(undefined as never);
    renderDialog({ onClose });

    await user.type(screen.getByLabelText(/topic name/i), "  Personal  ");
    await user.click(
      screen.getByRole("radio", { name: /select color #3b82f6/i }),
    );
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateTopicAndInvalidate).toHaveBeenCalledWith(
        expect.anything(),
        {
          name: "Personal",
          color: "#3b82f6",
        },
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on cancel and returns focus to trigger", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const triggerButton = document.createElement("button");
    document.body.appendChild(triggerButton);
    renderDialog({ onClose, triggerButton });

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(triggerButton);
  });

  it("closes when backdrop is clicked", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the custom color picker button", () => {
    renderDialog();
    expect(
      screen.getByRole("button", { name: /pick a custom color/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("custom-color-input")).toBeInTheDocument();
  });

  it("submits with a custom color from the native picker", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockCreateTopicAndInvalidate.mockResolvedValue(undefined as never);
    renderDialog({ onClose });

    await user.type(screen.getByLabelText(/topic name/i), "Custom topic");

    fireEvent.change(screen.getByTestId("custom-color-input"), {
      target: { value: "#aabbcc" },
    });

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateTopicAndInvalidate).toHaveBeenCalledWith(
        expect.anything(),
        { name: "Custom topic", color: "#aabbcc" },
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prevents submit when custom color is already used by another topic", async () => {
    const user = userEvent.setup();
    renderDialog({
      existingTopics: [makeTopic({ color: "#aabbcc" })],
    });

    await user.type(screen.getByLabelText(/topic name/i), "My topic");

    fireEvent.change(screen.getByTestId("custom-color-input"), {
      target: { value: "#aabbcc" },
    });

    expect(
      screen.getByText(/this color is already used by another topic/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
    expect(mockCreateTopicAndInvalidate).not.toHaveBeenCalled();
  });
});
