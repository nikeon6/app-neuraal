import { useRef, useCallback, useEffect } from "react";

/**
 * Hook for auto-scrolling a container when dragging near edges.
 * Uses requestAnimationFrame for smooth 60fps scrolling without causing re-renders.
 *
 * WHY THIS IS BETTER:
 * - Uses RAF instead of setInterval (syncs with display refresh)
 * - Stores pointer position in ref (no setState on every move)
 * - Single RAF loop runs only while dragging
 * - Automatically cleans up on unmount or drag end
 */

interface UseAutoScrollOnDragOptions {
  /** Pixels from edge to start scrolling */
  edgeThreshold?: number;
  /** Max scroll speed in pixels per frame */
  maxScrollSpeed?: number;
}

interface UseAutoScrollOnDragReturn {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Call when drag starts */
  startAutoScroll: () => void;
  /** Call when drag ends */
  stopAutoScroll: () => void;
  /** Call on pointer/drag move to update position */
  updatePointerPosition: (clientY: number) => void;
}

export function useAutoScrollOnDrag(
  options: UseAutoScrollOnDragOptions = {},
): UseAutoScrollOnDragReturn {
  const { edgeThreshold = 60, maxScrollSpeed = 12 } = options;

  const containerRef = useRef<HTMLElement>(null);
  const pointerYRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // RAF loop for smooth scrolling
  const scrollLoop = useCallback(() => {
    if (!isDraggingRef.current || !containerRef.current) {
      rafIdRef.current = null;
      return;
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const pointerY = pointerYRef.current;

    const distanceFromTop = pointerY - rect.top;
    const distanceFromBottom = rect.bottom - pointerY;

    let scrollDelta = 0;

    if (distanceFromTop < edgeThreshold && distanceFromTop > 0) {
      // Scroll up - intensity increases as pointer gets closer to edge
      const intensity = 1 - distanceFromTop / edgeThreshold;
      scrollDelta = -maxScrollSpeed * intensity * intensity; // Quadratic for smoother feel
    } else if (distanceFromBottom < edgeThreshold && distanceFromBottom > 0) {
      // Scroll down
      const intensity = 1 - distanceFromBottom / edgeThreshold;
      scrollDelta = maxScrollSpeed * intensity * intensity;
    }

    if (scrollDelta !== 0) {
      container.scrollTop += scrollDelta;
    }

    // Continue loop
    rafIdRef.current = requestAnimationFrame(scrollLoop);
  }, [edgeThreshold, maxScrollSpeed]);

  const startAutoScroll = useCallback(() => {
    isDraggingRef.current = true;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(scrollLoop);
    }
  }, [scrollLoop]);

  const stopAutoScroll = useCallback(() => {
    isDraggingRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const updatePointerPosition = useCallback((clientY: number) => {
    pointerYRef.current = clientY;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    containerRef,
    startAutoScroll,
    stopAutoScroll,
    updatePointerPosition,
  };
}
