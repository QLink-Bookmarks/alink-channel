import type { ImportFailureReason, ImportStatus, ImportSummary } from "../types";

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

function getImportRowMeta(
  summary: Pick<
    ImportSummary,
    "createdAt" | "status" | "linkCount" | "folderCount" | "failedCount"
  >,
  now: Date = new Date(),
) {
  const time = formatImportTime(summary.createdAt, now);
  const parts = [time];
  if (summary.status === "FAILED") {
    parts.push("링크를 가져오지 못했어요");
  } else {
    parts.push(`링크 ${summary.linkCount}개`, `새 폴더 ${summary.folderCount}개`);
  }
  if (summary.failedCount > 0) {
    parts.push(`실패 ${summary.failedCount}개`);
  }
  return parts.filter(Boolean).join(" · ");
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
  getImportRowMeta,
  getImportStartedCopy,
  getImportStatusLabel,
  getImportStatusTone,
};
export type { ImportStatusTone };
