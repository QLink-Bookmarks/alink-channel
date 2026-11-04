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
  const isFetchingNextPageRef = React.useRef(isFetchingNextPage);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    isFetchingNextPageRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

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
      // 복원은 저장 위치에 도착한 스크롤 이벤트로 끝난다. 행이 덜 그려졌거나, 잰 높이에 이미 사라진 "폴더를 더 불러오는 중" 행이 남아 브라우저가 실제 끝에서 멈추면 덜 옮긴 상태로 두고, 행이 더 그려질 때 다음 실행에서 이어서 옮긴다. 그 사이 사용자가 스크롤하면 recordScrollOffset이 복원을 끝낸다.
      if (decision.offset !== restoredOffsetRef.current) {
        restoredOffsetRef.current = decision.offset;
        scrollTo(decision.offset);
      }
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
    (offset: number, maxOffset: number) => {
      if (!isMountedRef.current) {
        return;
      }
      if (isRestoringRef.current) {
        const target = restoredOffsetRef.current;
        if (Math.abs(offset - target) <= RESTORE_TOLERANCE) {
          if (target >= savedOffsetRef.current && !isFetchingNextPageRef.current) {
            isRestoringRef.current = false;
          }
          return;
        }
        const isHeldAtEnd = offset < target && Math.abs(offset - maxOffset) <= RESTORE_TOLERANCE;
        if (isHeldAtEnd) {
          restoredOffsetRef.current = offset;
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
