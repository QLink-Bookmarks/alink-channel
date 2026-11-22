import { useRef } from "react";
import type { ScrollView } from "react-native";

import type { LinkListBodyProps } from "@/features/home/components/link-list-body";
import { ReadOnlyLinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import type { LinkCardSize } from "@/features/links/lib/link-card-size";
import type { LinkSort } from "@/features/links/lib/link-sort";
import { useCursorPagination } from "@/lib/hooks/use-cursor-pagination";

import type { usePublicFolderLinksQuery } from "../public-queries";
import type { PublicFolder } from "../types";

function PublicFolderList({
  folder,
  links,
  sort,
  isWide,
  activeLinkId,
  linkCardSize,
  onSortChange,
  render,
}: {
  folder: PublicFolder;
  links: ReturnType<typeof usePublicFolderLinksQuery>;
  sort: LinkSort;
  isWide: boolean;
  activeLinkId?: number;
  linkCardSize: LinkCardSize;
  onSortChange: (sort: LinkSort) => void;
  render: (props: LinkListBodyProps) => React.ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const pagination = useCursorPagination(links, {
    scroll: { contentKey: `${sort.key}:${sort.direction}`, ref: scrollRef },
  });
  const rows = links.data?.pages.flatMap((page) => page.contents) ?? [];
  const isComplete = links.isSuccess && !links.hasNextPage;

  return render({
    title: folder.name,
    emoji: folder.emoji ?? undefined,
    scrollRef,
    scrollProps: pagination.scrollViewProps,
    meta: isComplete ? `${rows.length}개 링크` : null,
    filter: {
      coverLabel: "정렬",
      coverMode: isWide ? "content" : "fill",
      sort,
      onSortChange,
    },
    isLoadError: links.isError && !links.data,
    isEmpty: isComplete && rows.length === 0,
    isRetrying: links.isFetching,
    emptyTitle: "아직 공개한 링크가 없어요.",
    onRetry: () => void links.refetch(),
    pagination: {
      isLoading: links.isFetchingNextPage,
      isError: links.isFetchNextPageError,
      onRetry: pagination.retryNextPage,
    },
    children: (
      <ReadOnlyLinkCardGrid
        folderId={isWide ? folder.id : undefined}
        links={rows}
        size={linkCardSize}
        isLoading={links.isPending}
        activeLinkId={activeLinkId}
      />
    ),
  });
}

export { PublicFolderList };
