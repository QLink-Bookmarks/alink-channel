import {
  type ListSort,
  SORT_DIRECTION_WORDS,
  type SortCriterion,
  type SortDirection,
  isSameListSort,
} from "@/lib/list-sort";

import type { GetLinksParams, LinkOrderKey } from "../types";

type LinkSort = ListSort<LinkOrderKey>;

// A piece of the collapsed button's pill, in the order it shows: ★ first, then the sort.
type LinkPillPart = { id: "star" } | { id: "sort"; label: string; direction: SortDirection };

const LINK_SORT_CRITERIA: SortCriterion<LinkOrderKey>[] = [
  { key: "created_at", label: "저장일", firstDirection: "desc" },
  { key: "title", label: "제목", firstDirection: "asc" },
];

const DEFAULT_LINK_SORT: LinkSort = { key: "created_at", direction: "desc" };

const FAVORITE_ONLY_WORDS = "바로가기만";

function getLinkSortLabel(key: LinkOrderKey) {
  return LINK_SORT_CRITERIA.find((criterion) => criterion.key === key)?.label ?? "";
}

function isDefaultLinkFilter(sort: LinkSort, favoriteOnly: boolean) {
  return !favoriteOnly && isSameListSort(sort, DEFAULT_LINK_SORT);
}

function toLinkListParams(sort: LinkSort, favoriteOnly: boolean): GetLinksParams {
  return {
    orderKey: sort.key,
    order: sort.direction,
    ...(favoriteOnly ? { isFavorite: true } : {}),
  };
}

/** What the collapsed button shows; null at the default (icon only). */
function getLinkPill(sort: LinkSort, favoriteOnly: boolean): LinkPillPart[] | null {
  const parts: LinkPillPart[] = [];
  if (favoriteOnly) {
    parts.push({ id: "star" });
  }
  if (!isSameListSort(sort, DEFAULT_LINK_SORT)) {
    parts.push({ id: "sort", label: getLinkSortLabel(sort.key), direction: sort.direction });
  }
  return parts.length > 0 ? parts : null;
}

/** The applied values in words for the button's name, e.g. "제목 오름차순, 바로가기만". */
function getLinkAppliedLabel(sort: LinkSort, favoriteOnly: boolean) {
  const words: string[] = [];
  if (!isSameListSort(sort, DEFAULT_LINK_SORT)) {
    words.push(`${getLinkSortLabel(sort.key)} ${SORT_DIRECTION_WORDS[sort.direction]}`);
  }
  if (favoriteOnly) {
    words.push(FAVORITE_ONLY_WORDS);
  }
  return words.length > 0 ? words.join(", ") : null;
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}

/** A remembered sort, or the default when it is missing or not a link sort. */
function readLinkSort(stored: unknown): LinkSort {
  if (typeof stored !== "object" || stored === null) {
    return DEFAULT_LINK_SORT;
  }
  const { key, direction } = stored as { key?: unknown; direction?: unknown };
  const criterion = LINK_SORT_CRITERIA.find((item) => item.key === key);
  if (!criterion || !isSortDirection(direction)) {
    return DEFAULT_LINK_SORT;
  }
  return { key: criterion.key, direction };
}

export {
  DEFAULT_LINK_SORT,
  LINK_SORT_CRITERIA,
  getLinkAppliedLabel,
  getLinkPill,
  isDefaultLinkFilter,
  readLinkSort,
  toLinkListParams,
};
export type { LinkPillPart, LinkSort };
