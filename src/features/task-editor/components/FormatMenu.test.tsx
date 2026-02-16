import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { FormatMenu } from "./FormatMenu";

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(function MockDiv(
      props: React.HTMLAttributes<HTMLDivElement>,
      ref: React.Ref<HTMLDivElement>,
    ) {
      return <div ref={ref} {...props} />;
    }),
  },
}));

type ActiveStateMap = Record<string, boolean>;

function createMockEditor(activeState: ActiveStateMap = {}) {
  const run = vi.fn();
  const focus = vi.fn(() => chain);
  const setParagraph = vi.fn(() => chain);
  const toggleHeading = vi.fn(() => chain);
  const toggleBold = vi.fn(() => chain);
  const toggleItalic = vi.fn(() => chain);
  const toggleUnderline = vi.fn(() => chain);
  const toggleStrike = vi.fn(() => chain);
  const on = vi.fn();
  const off = vi.fn();

  const chain = {
    focus,
    setParagraph,
    toggleHeading,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    run,
  };

  const isActive = vi.fn(
    (name: string, attrs?: { level?: number }) =>
      activeState[attrs?.level ? `${name}:${String(attrs.level)}` : name] ??
      false,
  );

  const editor = {
    chain: vi.fn(() => chain),
    isActive,
    on,
    off,
  };

  return {
    editor,
    chain,
    run,
    setParagraph,
    toggleHeading,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    on,
    off,
  };
}

describe("FormatMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders toolbar and formatting controls", () => {
    const { editor } = createMockEditor();
    render(<FormatMenu editor={editor as never} onClose={vi.fn()} />);

    expect(
      screen.getByRole("toolbar", { name: /text formatting/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /normal text/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /heading 1/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /bold/i })).toBeInTheDocument();
  });

  it("executes heading and mark commands on click", async () => {
    const user = userEvent.setup();
    const mock = createMockEditor();
    render(<FormatMenu editor={mock.editor as never} onClose={vi.fn()} />);

    await user.click(screen.getByRole("switch", { name: /normal text/i }));
    await user.click(screen.getByRole("switch", { name: /heading 1/i }));
    await user.click(screen.getByRole("switch", { name: /heading 2/i }));
    await user.click(screen.getByRole("switch", { name: /bold/i }));
    await user.click(screen.getByRole("switch", { name: /italic/i }));
    await user.click(screen.getByRole("switch", { name: /underline/i }));
    await user.click(screen.getByRole("switch", { name: /strikethrough/i }));

    expect(mock.setParagraph).toHaveBeenCalledTimes(1);
    expect(mock.toggleHeading).toHaveBeenCalledTimes(2);
    expect(mock.toggleHeading).toHaveBeenCalledWith({ level: 1 });
    expect(mock.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    expect(mock.toggleBold).toHaveBeenCalledTimes(1);
    expect(mock.toggleItalic).toHaveBeenCalledTimes(1);
    expect(mock.toggleUnderline).toHaveBeenCalledTimes(1);
    expect(mock.toggleStrike).toHaveBeenCalledTimes(1);
    expect(mock.run).toHaveBeenCalledTimes(7);
  });

  it("reflects active formatting state through aria-checked", () => {
    const { editor } = createMockEditor({
      "heading:1": true,
      bold: true,
      italic: false,
      underline: true,
      strike: false,
    });
    render(<FormatMenu editor={editor as never} onClose={vi.fn()} />);

    expect(screen.getByRole("switch", { name: /heading 1/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("switch", { name: /normal text/i }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /bold/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: /underline/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("closes on outside click but not on trigger click", () => {
    const onClose = vi.fn();
    const { editor } = createMockEditor();
    const triggerRef = React.createRef<HTMLButtonElement>();

    render(
      <div>
        <button ref={triggerRef} type="button">
          trigger
        </button>
        <FormatMenu
          editor={editor as never}
          onClose={onClose}
          triggerRef={triggerRef}
        />
      </div>,
    );

    fireEvent.mouseDown(triggerRef.current as Element);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    const { editor } = createMockEditor();
    render(<FormatMenu editor={editor as never} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on non-Escape keys", () => {
    const onClose = vi.fn();
    const { editor } = createMockEditor();
    render(<FormatMenu editor={editor as never} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("subscribes and unsubscribes to editor transaction events", () => {
    const { editor, on, off } = createMockEditor();
    const { unmount } = render(
      <FormatMenu editor={editor as never} onClose={vi.fn()} />,
    );

    expect(on).toHaveBeenCalledWith("transaction", expect.any(Function));
    const callback = on.mock.calls[0]?.[1];
    expect(typeof callback).toBe("function");

    unmount();
    expect(off).toHaveBeenCalledWith("transaction", callback);
  });
});
