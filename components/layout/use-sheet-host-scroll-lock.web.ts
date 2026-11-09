import * as React from "react";
import type { View } from "react-native";

function isEditable(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element.isContentEditable
  );
}

function isLockedHost(target: HTMLElement, content: HTMLElement) {
  return target.contains(content) && getComputedStyle(target).overflowY === "hidden";
}

function isInView(element: Element) {
  const rect = element.getBoundingClientRect();
  const height = window.visualViewport?.height ?? window.innerHeight;
  return rect.top >= 0 && rect.bottom <= height;
}

// Once the sheet has stopped moving, a host that the browser scrolled to show a field while
// the sheet was still sliding in goes back to 0, unless that would hide the focused field.
function settleHosts(content: HTMLElement) {
  const focused = document.activeElement;
  if (!isEditable(focused) || !content.contains(focused)) {
    return;
  }
  let node = content.parentElement;
  while (node && node !== document.body) {
    if (node.scrollTop !== 0 && getComputedStyle(node).overflowY === "hidden") {
      const previous = node.scrollTop;
      node.scrollTop = 0;
      if (!isInView(focused)) {
        node.scrollTop = previous;
      }
    }
    node = node.parentElement;
  }
}

function resetHosts(content: HTMLElement) {
  let node = content.parentElement;
  while (node && node !== document.body) {
    if (node.scrollTop !== 0 && getComputedStyle(node).overflowY === "hidden") {
      node.scrollTop = 0;
    }
    node = node.parentElement;
  }
}

type SheetHostScrollLock = {
  ref?: React.RefCallback<View>;
  /** Call when the sheet stops moving. */
  settle?: () => void;
};

function useSheetHostScrollLock(): SheetHostScrollLock {
  const contentRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    let isPointerDown = false;
    let isResetPending = false;
    const resetAfterPress = () => {
      const content = contentRef.current;
      if (content) {
        resetHosts(content);
      }
    };
    const handleScroll = (event: Event) => {
      const content = contentRef.current;
      const target = event.target;
      if (!content || !(target instanceof HTMLElement) || target.scrollTop === 0) {
        return;
      }
      if (!isLockedHost(target, content)) {
        return;
      }
      const focused = document.activeElement;
      if (isEditable(focused) && target.contains(focused)) {
        return;
      }
      if (isPointerDown) {
        isResetPending = true;
        return;
      }
      target.scrollTop = 0;
    };
    const handleFocusOut = (event: FocusEvent) => {
      const content = contentRef.current;
      const target = event.target as Element | null;
      if (!content || !isEditable(target) || !content.contains(target)) {
        return;
      }
      if (isEditable(event.relatedTarget as Element | null)) {
        return;
      }
      if (isPointerDown) {
        isResetPending = true;
        return;
      }
      resetAfterPress();
    };
    const handlePointerDown = () => {
      isPointerDown = true;
    };
    const handlePointerEnd = () => {
      isPointerDown = false;
      if (isResetPending) {
        isResetPending = false;
        setTimeout(resetAfterPress, 0);
      }
    };
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerEnd, true);
    document.addEventListener("pointercancel", handlePointerEnd, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerEnd, true);
      document.removeEventListener("pointercancel", handlePointerEnd, true);
    };
  }, []);

  const ref = React.useCallback((node: View | null) => {
    contentRef.current = node as unknown as HTMLElement | null;
  }, []);
  const settle = React.useCallback(() => {
    const content = contentRef.current;
    if (content) {
      settleHosts(content);
    }
  }, []);
  return React.useMemo(() => ({ ref, settle }), [ref, settle]);
}

export { useSheetHostScrollLock };
export type { SheetHostScrollLock };
