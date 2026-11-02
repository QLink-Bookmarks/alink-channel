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
      // 저장 위치보다 덜 옮긴 부분 복원이면 복원 상태를 유지한다. iOS FlatList는 처음에 일부 행만 그려 콘텐츠가 짧으므로, 행이 더 그려져 높이가 늘면 다음 실행에서 저장 위치까지 이어서 옮긴다. 그 사이 사용자가 스크롤하면 recordScrollOffset이 복원을 끝낸다.
      if (decision.offset >= savedOffsetRef.current) {
        isRestoringRef.current = false;
      }
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
