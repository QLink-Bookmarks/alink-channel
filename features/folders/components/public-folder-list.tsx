import { useRef } from "react";
import type { ScrollView } from "react-native";

import type { LinkListBodyProps } from "@/features/home/components/link-list-body";
import { ReadOnlyLinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import type { LinkCardSize } from "@/features/links/lib/link-card-size";
import { LINK_SORT_CRITERIA } from "@/features/links/lib/link-sort";
import { useCursorPagination } from "@/lib/hooks/use-cursor-pagination";
import type { SortDirection } from "@/lib/list-sort";

import type { usePublicFolderLinksQuery } from "../public-queries";
import type { PublicFolder } from "../types";

const PUBLIC_SORT_CRITERIA = LINK_SORT_CRITERIA.filter(({ key }) => key === "created_at");

function PublicFolderList({
  folder,
  links,
  order,
  isWide,
  activeLinkId,
  linkCardSize,
  onOrderChange,
  render,
}: {
  folder: PublicFolder;
  links: ReturnType<typeof usePublicFolderLinksQuery>;
  order: SortDirection;
  isWide: boolean;
  activeLinkId?: number;
  linkCardSize: LinkCardSize;
  onOrderChange: (order: SortDirection) => void;
  render: (props: LinkListBodyProps) => React.ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const pagination = useCursorPagination(links, {
    scroll: { contentKey: order, ref: scrollRef },
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
      criteria: PUBLIC_SORT_CRITERIA,
      sort: { key: "created_at", direction: order },
      onSortChange: ({ direction }) => onOrderChange(direction),
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
