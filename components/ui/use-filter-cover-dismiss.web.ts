import * as React from "react";

import type { FilterCoverDismiss, FilterCoverDismissOptions } from "./use-filter-cover-dismiss";

// A press counts as a pointer press when the pointer went down on it this recently.
const POINTER_PRESS_WINDOW_MS = 1000;
const POINTER_TYPES = new Set(["mouse", "touch", "pen"]);

type InertElement = HTMLElement & { inert: boolean };

function asElement(node: unknown) {
  return node instanceof HTMLElement ? (node as InertElement) : null;
}

function isInside(container: HTMLElement | null, target: EventTarget | null) {
  return Boolean(container && target instanceof Node && container.contains(target));
}

/**
 * Web: closes the cover on a press outside it (the press still does its own thing, e.g. opens the
 * card), on Esc (focus back to the button), and when focus leaves the cover and button (focus stays
 * where it went). While open the covered 1st chips are inert; while closed the cover is. Opening with
 * the keyboard moves focus into the cover. Only presses made with a pointer arm the auto close, so
 * keyboard and assistive-technology clicks never close it.
 */
function useFilterCoverDismiss({
  isOpen,
  rowRef,
  primaryRef,
  coverRef,
  buttonRef,
  autoClose,
  onDismiss,
}: FilterCoverDismissOptions): FilterCoverDismiss {
  const stateRef = React.useRef({ isOpen, onDismiss });
  stateRef.current = { isOpen, onDismiss };
  const lastButtonPointerAtRef = React.useRef(0);
  const { arm, pause, resume } = autoClose;

  // Inert: the covered 1st chips while open, the hidden cover while closed.
  React.useEffect(() => {
    const primary = asElement(primaryRef.current);
    const cover = asElement(coverRef.current);
    if (primary) {
      primary.inert = isOpen;
    }
    if (cover) {
      cover.inert = !isOpen;
    }
  }, [coverRef, isOpen, primaryRef]);

  // Remember pointer presses on the button, so a keyboard open can be told apart.
  React.useEffect(() => {
    const button = asElement(buttonRef.current);
    if (!button) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (POINTER_TYPES.has(event.pointerType)) {
        lastButtonPointerAtRef.current = Date.now();
      }
    };
    button.addEventListener("pointerdown", handlePointerDown);
    return () => button.removeEventListener("pointerdown", handlePointerDown);
  }, [buttonRef]);

  // Opened from the keyboard: move focus to the first item of the cover.
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (Date.now() - lastButtonPointerAtRef.current < POINTER_PRESS_WINDOW_MS) {
      return;
    }
    const cover = asElement(coverRef.current);
    const first = cover?.querySelector<HTMLElement>('[tabindex="0"]');
    first?.focus();
  }, [coverRef, isOpen]);

  // Pointer presses inside the cover drive the auto close.
  React.useEffect(() => {
    const cover = asElement(coverRef.current);
    if (!cover) {
      return;
    }
    let isPointerDown = false;
    const handlePointerDown = (event: PointerEvent) => {
      if (!POINTER_TYPES.has(event.pointerType)) {
        return;
      }
      isPointerDown = true;
      pause();
    };
    const handlePointerUp = () => {
      if (!isPointerDown) {
        return;
      }
      isPointerDown = false;
      arm();
    };
    const handlePointerCancel = () => {
      isPointerDown = false;
      resume();
    };
    cover.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      cover.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [arm, coverRef, pause, resume]);

  // Outside press, Esc and focus leaving the cover, only while open.
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const row = asElement(rowRef.current);
    const cover = asElement(coverRef.current);
    const button = asElement(buttonRef.current);

    const isInCoverOrButton = (target: EventTarget | null) =>
      isInside(cover, target) || isInside(button, target);

    const handlePointerDown = (event: PointerEvent) => {
      if (!isInCoverOrButton(event.target)) {
        stateRef.current.onDismiss({ focusButton: false, immediate: false });
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const active = document.activeElement;
      if (active && active !== document.body && !isInside(row, active)) {
        return;
      }
      event.preventDefault();
      stateRef.current.onDismiss({ focusButton: true, immediate: false });
    };
    const handleFocusOut = (event: FocusEvent) => {
      // No next target: the window lost focus or a press landed on something unfocusable; the
      // outside press handler covers the latter.
      if (event.relatedTarget && !isInCoverOrButton(event.relatedTarget)) {
        stateRef.current.onDismiss({ focusButton: false, immediate: false });
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    row?.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      row?.removeEventListener("focusout", handleFocusOut);
    };
  }, [buttonRef, coverRef, isOpen, rowRef]);

  const coverProps = React.useMemo<FilterCoverDismiss["coverProps"]>(() => ({}), []);

  const coverScrollProps = React.useMemo<FilterCoverDismiss["coverScrollProps"]>(
    () => ({
      // Scrolling the cover restarts a running timer.
      onScroll: () => {
        resume();
      },
    }),
    [resume],
  );

  const keepFocusOutOfCover = React.useCallback(() => {
    const cover = asElement(coverRef.current);
    const button = asElement(buttonRef.current);
    if (cover && button && isInside(cover, document.activeElement)) {
      button.focus();
    }
  }, [buttonRef, coverRef]);

  return { coverProps, coverScrollProps, keepFocusOutOfCover };
}

export { useFilterCoverDismiss };
