import { useEffect, type RefObject } from "react";
import type { TaskEditorUIState } from "../types";

/**
 * Hook that collapses the editor when clicking outside.
 *
 * Ignores clicks on portal-rendered dialogs (ReminderDialog, ConfirmDialog, etc.)
 * since those are part of the editor's logical scope even if outside the DOM tree.
 *
 * Extracted from TaskEditor to reduce its Cognitive Complexity.
 */
export function useEditorCollapse(
  editorRef: RefObject<HTMLDivElement | null>,
  flushPendingSave: () => void,
  setUIState: React.Dispatch<React.SetStateAction<TaskEditorUIState>>,
): void {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't collapse if clicking inside the editor itself
      if (editorRef.current?.contains(target)) return;

      // Don't collapse if clicking inside a portal-rendered dialog
      const targetEl =
        target instanceof HTMLElement ? target : target.parentElement;
      if (
        targetEl?.closest(
          "[role='dialog'], [role='alertdialog'], [data-dialog-backdrop], [role='menu']",
        )
      )
        return;

      flushPendingSave();
      setUIState((prev) => ({
        ...prev,
        isExpanded: false,
        isContentMenuOpen: false,
        isTopicMenuOpen: false,
      }));
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editorRef, flushPendingSave, setUIState]);
}

/**
 * Hook that closes the content menu when clicking outside its container.
 *
 * Extracted from TaskEditor to reduce its Cognitive Complexity.
 */
export function useContentMenuClose(
  isContentMenuOpen: boolean,
  contentMenuRef: RefObject<HTMLDivElement | null>,
  setUIState: React.Dispatch<React.SetStateAction<TaskEditorUIState>>,
): void {
  useEffect(() => {
    if (!isContentMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (contentMenuRef.current?.contains(e.target as Node)) return;
      setUIState((prev) => ({ ...prev, isContentMenuOpen: false }));
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isContentMenuOpen, contentMenuRef, setUIState]);
}
