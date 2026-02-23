import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

interface ContentMenuPosition {
  top: number;
  left: number;
  opensUp: boolean;
}

/**
 * Calculates fixed positioning for the content menu portal.
 * Opens above the button when there is enough space, otherwise below.
 * Recalculates on scroll/resize while the menu is open.
 */
export function useContentMenuPosition(
  isOpen: boolean,
  buttonRef: RefObject<HTMLButtonElement | null>,
) {
  const [pos, setPos] = useState<ContentMenuPosition>({
    top: 0,
    left: 0,
    opensUp: false,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  const update = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const PANEL_H = 300;
    const GAP = 8;
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;

    if (spaceAbove >= PANEL_H + GAP) {
      setPos({ top: rect.top - GAP, left: rect.left, opensUp: true });
    } else if (spaceBelow >= PANEL_H + GAP) {
      setPos({ top: rect.bottom + GAP, left: rect.left, opensUp: false });
    } else {
      setPos({ top: rect.top - GAP, left: rect.left, opensUp: true });
    }
  }, [buttonRef]);

  useEffect(() => {
    if (!isOpen) return;
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, update]);

  return { pos, panelRef };
}
