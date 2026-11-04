import * as React from "react";
import type { View } from "react-native";

function useSheetHostScrollLock(): React.RefCallback<View> {
  const contentRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const handleScroll = (event: Event) => {
      const content = contentRef.current;
      const target = event.target;
      if (!content || !(target instanceof HTMLElement) || target.scrollTop === 0) {
        return;
      }
      if (target.contains(content) && getComputedStyle(target).overflowY === "hidden") {
        target.scrollTop = 0;
      }
    };
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, []);

  return React.useCallback((node: View | null) => {
    contentRef.current = node as unknown as HTMLElement | null;
  }, []);
}

export { useSheetHostScrollLock };
