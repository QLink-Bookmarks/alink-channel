import type { LinkCardStatusVariant } from "@/features/links/components/link-card/link-card";
import type { LinkListItem, LinkStatus, LinkTodoCounts } from "@/features/links/types";

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Card-ready todo counts. `normal` excludes the due-soon and overdue todos, so the three
 * kinds never overlap. `allDone` is true when every linked todo is completed.
 * `label` is the tooltip text and the accessible name, e.g. "액션 1개, 임박 1개, 기한 지남 1개".
 */
type TodoCountSummary = {
  normal: number;
  dueSoon: number;
  overdue: number;
  allDone: boolean;
  label: string;
};

/** Returns null when the link has no todo at all, so the card shows nothing. */
function mapTodoCounts(counts: LinkTodoCounts | null | undefined): TodoCountSummary | null {
  if (!counts) {
    return null;
  }
  const open = Math.max(counts.open, 0);
  const completed = Math.max(counts.completed, 0);
  if (open + completed === 0) {
    return null;
  }
  if (open === 0) {
    return { normal: 0, dueSoon: 0, overdue: 0, allDone: true, label: "액션 모두 완료" };
  }
  const dueSoon = Math.min(Math.max(counts.dueSoon, 0), open);
  const overdue = Math.min(Math.max(counts.overdue, 0), open - dueSoon);
  const normal = open - dueSoon - overdue;
  const label = [
    [normal, "액션"],
    [dueSoon, "임박"],
    [overdue, "기한 지남"],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, name]) => `${name} ${count}개`)
    .join(", ");
  return { normal, dueSoon, overdue, allDone: false, label };
}

type MappedLink = {
  id: number;
  url: string;
  domain: string;
  title: string;
  tags: string[];
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  isVideo: boolean;
  todoCounts: TodoCountSummary | null;
  statusLabel: string | null;
  statusVariant: LinkCardStatusVariant;
};

/**
 * Returns the in-progress / failed status meta. A (success) is intentionally not surfaced here —
 * successful AI runs are shown via summaryModelLabel ("요약 모델 - {workModel}") on the detail.
 */
function formatLinkStatus(
  status: LinkStatus | null | undefined,
  workModel: string | null | undefined,
): { label: string | null; variant: LinkCardStatusVariant } {
  switch (status) {
    case "G":
      return { label: "AI 생성 중...", variant: "progress" };
    case "F":
      return {
        label: workModel ? `${workModel} 생성 실패` : "AI 생성 실패",
        variant: "error",
      };
    default:
      return { label: null, variant: null };
  }
}

function formatSummaryModelLabel(
  status: LinkStatus | null | undefined,
  workModel: string | null | undefined,
): string | null {
  if (status !== "A" || !workModel) {
    return null;
  }
  return `요약 모델 - ${workModel}`;
}

function mapLinkListItem(item: LinkListItem): MappedLink {
  const { label, variant } = formatLinkStatus(item.status, item.workModel);
  return {
    id: item.id,
    url: item.url,
    domain: getDomainFromUrl(item.url),
    title: item.title,
    tags: item.tags,
    thumbnailUrl: item.thumbnailUrl ?? null,
    faviconUrl: item.faviconUrl ?? null,
    isVideo: Boolean(item.isVideo),
    todoCounts: mapTodoCounts(item.todoCounts),
    statusLabel: label,
    statusVariant: variant,
  };
}

export {
  formatLinkStatus,
  formatSummaryModelLabel,
  getDomainFromUrl,
  mapLinkListItem,
  mapTodoCounts,
};
export type { MappedLink, TodoCountSummary };
