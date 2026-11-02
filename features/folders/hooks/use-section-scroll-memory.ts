import * as React from "react";

import {
  type FolderScrollSurface,
  type FolderSection,
  getFolderScrollOffset,
  setFolderScrollOffset,
} from "@/stores/folder-navigation";

import { resolveScrollRestore } from "../lib/folder-pages";

const RESTORE_TOLERANCE = 2;

type SectionScrollMemoryOptions = {
  surface?: FolderScrollSurface;
  section: FolderSection;
  contentHeight: number;
  viewportHeight: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  scrollTo: (offset: number) => void;
  onFetchMore: () => void;
};

function useSectionScrollMemory({
  surface,
  section,
  contentHeight,
  viewportHeight,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  scrollTo,
  onFetchMore,
}: SectionScrollMemoryOptions) {
  const savedOffsetRef = React.useRef(surface ? getFolderScrollOffset(surface, section) : 0);
  const isRestoringRef = React.useRef(savedOffsetRef.current > 0);
  const restoredOffsetRef = React.useRef(0);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!isRestoringRef.current) {
      return;
    }
    const decision = resolveScrollRestore({
      savedOffset: savedOffsetRef.current,
      contentHeight,
      viewportHeight,
      hasNextPage,
      isFetchingNextPage,
      isFetchNextPageError,
    });
    if (decision.type === "scroll") {
      isRestoringRef.current = false;
      restoredOffsetRef.current = decision.offset;
      scrollTo(decision.offset);
      return;
    }
    if (decision.type === "fetchMore") {
      onFetchMore();
      return;
    }
    if (decision.type === "none") {
      isRestoringRef.current = false;
    }
  }, [
    contentHeight,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    onFetchMore,
    scrollTo,
    viewportHeight,
  ]);

  const recordScrollOffset = React.useCallback(
    (offset: number) => {
      if (!isMountedRef.current) {
        return;
      }
      if (isRestoringRef.current) {
        if (Math.abs(offset - restoredOffsetRef.current) <= RESTORE_TOLERANCE) {
          return;
        }
        isRestoringRef.current = false;
      }
      if (surface) {
        setFolderScrollOffset(surface, section, offset);
      }
    },
    [section, surface],
  );

  const stopRestore = React.useCallback(() => {
    isRestoringRef.current = false;
  }, []);

  return { recordScrollOffset, stopRestore };
}

export { useSectionScrollMemory };
