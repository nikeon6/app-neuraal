import type { RefObject } from "react";
import { useRef, useEffect, useCallback } from "react";

const DRAG_THRESHOLD = 5;

/**
 * Enables mouse-drag horizontal scrolling on a container.
 * Touch devices already support native swipe; this adds the same UX
 * for mouse users (e.g. desktop browser resized to mobile width).
 *
 * Clicks are suppressed after a drag exceeding {@link DRAG_THRESHOLD}px
 * so that child buttons don't fire on mouseup.
 */
export function useDragScroll<T extends HTMLElement>(
  externalRef: RefObject<T | null>,
) {
  const state = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    didDrag: false,
  });

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      const el = externalRef.current;
      if (!el) return;
      state.current = {
        isDown: true,
        startX: e.pageX - el.offsetLeft,
        scrollLeft: el.scrollLeft,
        didDrag: false,
      };
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    },
    [externalRef],
  );

  const onMouseUp = useCallback(() => {
    const el = externalRef.current;
    if (!el || !state.current.isDown) return;
    state.current.isDown = false;
    el.style.cursor = "";
    el.style.userSelect = "";
  }, [externalRef]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!state.current.isDown) return;
      const el = externalRef.current;
      if (!el) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = x - state.current.startX;
      if (Math.abs(walk) > DRAG_THRESHOLD) {
        state.current.didDrag = true;
      }
      el.scrollLeft = state.current.scrollLeft - walk;
    },
    [externalRef],
  );

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (state.current.didDrag) {
      e.stopPropagation();
      state.current.didDrag = false;
    }
  }, []);

  useEffect(() => {
    const el = externalRef.current;
    if (!el) return;

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("click", onClickCapture, true);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [externalRef, onMouseDown, onMouseUp, onMouseMove, onClickCapture]);
}
