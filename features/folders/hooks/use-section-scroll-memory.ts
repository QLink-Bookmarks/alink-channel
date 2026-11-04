import * as React from "react";

import {
  type FolderScrollSurface,
  type FolderSection,
  getFolderScrollOffset,
  setFolderScrollOffset,
} from "@/stores/folder-navigation";

import { resolveScrollRestore } from "../lib/folder-pages";

const RESTORE_TOLERANCE = 2;
const RESTORE_ECHO_WINDOW_MS = 200;

type PendingRestoreScroll = { from: number; to: number; at: number };

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

function hasArrivedAtSavedOffset({
  savedOffset,
  restoredOffset,
  lastOffset,
  isFetchingNextPage,
}: {
  savedOffset: number;
  restoredOffset: number;
  lastOffset: number;
  isFetchingNextPage: boolean;
}) {
  return (
    !isFetchingNextPage &&
    restoredOffset >= savedOffset &&
    Math.abs(lastOffset - savedOffset) <= RESTORE_TOLERANCE
  );
}

function isShortEcho(pending: PendingRestoreScroll | null, previousOffset: number, offset: number) {
  if (!pending || Date.now() - pending.at > RESTORE_ECHO_WINDOW_MS) {
    return false;
  }
  if (Math.abs(previousOffset - pending.from) > RESTORE_TOLERANCE) {
    return false;
  }
  const low = Math.min(pending.from, pending.to) - RESTORE_TOLERANCE;
  const high = Math.max(pending.from, pending.to) + RESTORE_TOLERANCE;
  return offset >= low && offset <= high;
}

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
  const lastOffsetRef = React.useRef(0);
  const pendingScrollRef = React.useRef<PendingRestoreScroll | null>(null);
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
    const arrival = {
      savedOffset: savedOffsetRef.current,
      lastOffset: lastOffsetRef.current,
      isFetchingNextPage,
    };
    if (hasArrivedAtSavedOffset({ ...arrival, restoredOffset: restoredOffsetRef.current })) {
      isRestoringRef.current = false;
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
      // 복원은 다음 배치를 불러오는 중이 아닐 때 저장 위치에 도착해야 끝난다. 행이 덜 그려졌거나, 잰 높이에 이미 사라진 "폴더를 더 불러오는 중" 행이 남아 브라우저가 실제 끝에서 멈추면 덜 옮긴 상태로 두고, 행이 더 그려질 때 다음 실행에서 이어서 옮긴다. 이미 그 위치에 있으면 스크롤 이벤트가 오지 않으므로 여기서 도착을 확인한다. 그 사이 사용자가 스크롤하면 recordScrollOffset이 복원을 끝낸다.
      restoredOffsetRef.current = decision.offset;
      if (Math.abs(lastOffsetRef.current - decision.offset) <= RESTORE_TOLERANCE) {
        if (hasArrivedAtSavedOffset({ ...arrival, restoredOffset: decision.offset })) {
          isRestoringRef.current = false;
        }
        return;
      }
      pendingScrollRef.current = {
        from: lastOffsetRef.current,
        to: decision.offset,
        at: Date.now(),
      };
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
    (offset: number, maxOffset: number) => {
      if (!isMountedRef.current) {
        return;
      }
      const previousOffset = lastOffsetRef.current;
      lastOffsetRef.current = offset;
      const pending = pendingScrollRef.current;
      pendingScrollRef.current = null;
      if (isRestoringRef.current) {
        const target = restoredOffsetRef.current;
        if (Math.abs(offset - target) <= RESTORE_TOLERANCE) {
          const hasArrived = hasArrivedAtSavedOffset({
            savedOffset: savedOffsetRef.current,
            restoredOffset: target,
            lastOffset: offset,
            isFetchingNextPage: isFetchingNextPageRef.current,
          });
          if (hasArrived) {
            isRestoringRef.current = false;
          }
          return;
        }
        const isHeldAtEnd = offset < target && Math.abs(offset - maxOffset) <= RESTORE_TOLERANCE;
        if (isHeldAtEnd || isShortEcho(pending, previousOffset, offset)) {
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
