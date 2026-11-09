import { UNCATEGORIZED_FOLDER_ID } from "@/features/folders/lib/folder-pages";

import type { ImportDetail, ImportFailureReason, ImportStatus, ImportSummary } from "../types";

type ImportStatusTone = "success" | "warning" | "danger" | "muted";

const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  COMPLETED: "완료",
  PARTIALLY_FAILED: "일부 실패",
  FAILED: "실패",
  UNDONE: "되돌림",
  PARTIALLY_UNDONE: "일부 되돌림",
};

const IMPORT_STATUS_TONES: Record<ImportStatus, ImportStatusTone> = {
  COMPLETED: "success",
  PARTIALLY_FAILED: "warning",
  FAILED: "danger",
  UNDONE: "muted",
  PARTIALLY_UNDONE: "muted",
};

const IMPORT_FAILURE_REASON_LABELS: Record<ImportFailureReason, string> = {
  URL_INVALID: "주소 형식을 처리하지 못했어요",
  TITLE_INVALID: "제목을 처리하지 못했어요",
  UNKNOWN: "알 수 없는 이유로 저장하지 못했어요",
};

const UNFILED_FOLDER_LABEL = "미분류";
const UNFILED_FOLDER_EMOJI = "🗂️";

function getImportStatusLabel(status: ImportStatus) {
  return IMPORT_STATUS_LABELS[status] ?? status;
}

function getImportStatusTone(status: ImportStatus): ImportStatusTone {
  return IMPORT_STATUS_TONES[status] ?? "muted";
}

function getImportFailureReasonLabel(reason: ImportFailureReason) {
  return IMPORT_FAILURE_REASON_LABELS[reason] ?? IMPORT_FAILURE_REASON_LABELS.UNKNOWN;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatClock(date: Date) {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${hour12}:${minutes}`;
}

function formatImportTime(createdAt: string, now: Date = new Date()) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const clock = formatClock(date);
  if (isSameDay(date, now)) {
    return `오늘 ${clock}`;
  }
  const day = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}년 ${day} ${clock}`;
  }
  return `${day} ${clock}`;
}

function getImportRowMetaParts(
  summary: Pick<
    ImportSummary,
    "createdAt" | "status" | "linkCount" | "folderCount" | "failedCount"
  >,
  now: Date = new Date(),
) {
  const parts = [formatImportTime(summary.createdAt, now)];
  if (summary.status === "FAILED") {
    parts.push("링크를 가져오지 못했어요");
  } else {
    parts.push(`링크 ${summary.linkCount}개`, `새 폴더 ${summary.folderCount}개`);
  }
  if (summary.failedCount > 0) {
    parts.push(`실패 ${summary.failedCount}개`);
  }
  return parts.filter(Boolean);
}

const THUMBNAIL_FILLING_STATUSES: ReadonlySet<ImportStatus> = new Set([
  "COMPLETED",
  "PARTIALLY_FAILED",
  "PARTIALLY_UNDONE",
]);

function isFillingThumbnails(summary: Pick<ImportSummary, "status" | "progress">) {
  return summary.progress < 1 && THUMBNAIL_FILLING_STATUSES.has(summary.status);
}

function getImportStatusBadgeLabel(status: ImportStatus, isFilling: boolean) {
  const label = getImportStatusLabel(status);
  return isFilling ? `${label} · 썸네일 채우는 중` : label;
}

const JUST_IMPORTED_WINDOW_MS = 60_000;

function isJustImported(createdAt: string, now: Date = new Date()) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return false;
  }
  return now.getTime() - created <= JUST_IMPORTED_WINDOW_MS;
}

type ImportResultCopy = {
  tone: "success" | "danger" | "muted";
  title: string;
  sentence: string;
  canOpenLinks: boolean;
  canReverse: boolean;
};

function canOpenImportedLinks(summary: Pick<ImportSummary, "status" | "linkCount">) {
  return summary.status !== "FAILED" && summary.status !== "UNDONE" && summary.linkCount > 0;
}

function getImportResultCopy(
  summary: Pick<
    ImportSummary,
    "status" | "linkCount" | "folderCount" | "failedCount" | "isReversible"
  >,
): ImportResultCopy {
  if (summary.status === "FAILED") {
    return {
      tone: "danger",
      title: "가져오지 못했어요",
      sentence: "링크를 하나도 저장하지 못했어요. 이유는 상세에서 볼 수 있어요.",
      canOpenLinks: false,
      canReverse: false,
    };
  }
  if (!canOpenImportedLinks(summary)) {
    return {
      tone: "muted",
      title: "방금 가져왔어요",
      sentence: "가져온 링크를 모두 되돌렸어요.",
      canOpenLinks: false,
      canReverse: false,
    };
  }
  const added =
    summary.folderCount > 0
      ? `링크 ${summary.linkCount}개와 새 폴더 ${summary.folderCount}개를 추가했어요.`
      : `링크 ${summary.linkCount}개를 추가했어요.`;
  const failed =
    summary.failedCount > 0 ? ` 실패 ${summary.failedCount}개는 상세에서 볼 수 있어요.` : "";
  return {
    tone: "success",
    title: "방금 가져왔어요",
    sentence: `${added}${failed}`,
    canOpenLinks: true,
    canReverse: summary.isReversible,
  };
}

function getImportedLinksFolderId(detail: Pick<ImportDetail, "folders">): number | null {
  const withLinks = detail.folders.filter((folder) => folder.links.length > 0);
  const target = withLinks.find((folder) => folder.kind === "NEW") ?? withLinks[0];
  if (!target) {
    return null;
  }
  if (target.kind === "UNFILED") {
    return UNCATEGORIZED_FOLDER_ID;
  }
  return target.folderId ?? null;
}

function getImportStartedCopy(createdAt: string, now: Date = new Date()) {
  const time = formatImportTime(createdAt, now);
  return time ? `${time}에 가져왔어요.` : "";
}

export {
  UNFILED_FOLDER_EMOJI,
  UNFILED_FOLDER_LABEL,
  formatImportTime,
  getImportFailureReasonLabel,
  canOpenImportedLinks,
  getImportResultCopy,
  getImportRowMetaParts,
  getImportStartedCopy,
  getImportStatusBadgeLabel,
  getImportStatusLabel,
  getImportStatusTone,
  getImportedLinksFolderId,
  isFillingThumbnails,
  isJustImported,
};
export type { ImportResultCopy, ImportStatusTone };
