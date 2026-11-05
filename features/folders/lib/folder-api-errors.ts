// Folder API error codes from the API contract (QLink-Bookmarks/alink-backend#165, section 2).
// The wire codes change only through a contract update; when they do, change them here only.
// Jest and Playwright mocks import these constants too. Keep this file free of app imports.
const FOLDER_API_ERROR_CODES = {
  differentOwner: "FOLDER_403_0001",
  deleteTargetAccessDenied: "FOLDER_403_0002",
  folderNotFound: "FOLDER_404_0002",
  transferFolderNotFound: "FOLDER_404_0004",
  transferMemberNotFound: "FOLDER_404_0005",
  deleteTargetNotFound: "FOLDER_404_0006",
  transferDuplicateName: "FOLDER_409_0002",
  ownerCannotLeave: "FOLDER_422_0004",
} as const;

type FolderRemovalAction = "delete" | "transfer" | "leave";

/**
 * What the flow does with a delete, transfer or leave result.
 * - `done`: finish with the action's toast.
 * - `ended`: finish without a toast (the folder is already gone for me).
 * - `permission-changed`: refetch the folder list, then end or stay with the permission notice.
 * - `target-unavailable`: the move target is gone or no longer writable; stay, CTA off.
 * - `duplicate-name`: the new owner already owns a folder with this name; stay, CTA off.
 * - `member-gone`: the chosen new owner left; refetch members and go back to the picker.
 * - `failed`: stay with the server message or the default message; the CTA retries.
 */
type FolderRemovalOutcome =
  | { kind: "done" }
  | { kind: "ended" }
  | { kind: "permission-changed" }
  | { kind: "target-unavailable"; message: string }
  | { kind: "duplicate-name"; message: string }
  | { kind: "member-gone"; message: string }
  | { kind: "failed"; message: string };

const FOLDER_REMOVAL_MESSAGES = {
  deleteFailed: "폴더를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.",
  transferFailed: "위임하지 못했어요. 잠시 후 다시 시도해주세요.",
  leaveFailed: "공유 폴더에서 나가지 못했어요. 잠시 후 다시 시도해주세요.",
  targetNotFound: "옮길 폴더를 찾을 수 없어요. 다른 폴더를 골라주세요.",
  targetAccessDenied: "이 폴더로는 옮길 수 없어요. 다른 폴더를 골라주세요.",
  memberGone: "선택한 멤버가 폴더에 없어요. 다른 멤버를 골라주세요.",
  duplicateName: "지금 이 폴더 이름으로는 위임할 수 없어요. 폴더 이름을 바꾼 뒤 다시 시도해주세요.",
  permissionChanged: "폴더 권한이 바뀌었어요. 다시 확인해주세요.",
} as const;

const DEFAULT_FAILURE_MESSAGES: Record<FolderRemovalAction, string> = {
  delete: FOLDER_REMOVAL_MESSAGES.deleteFailed,
  transfer: FOLDER_REMOVAL_MESSAGES.transferFailed,
  leave: FOLDER_REMOVAL_MESSAGES.leaveFailed,
};

function getApiErrorDetail(error: unknown): { code?: unknown; message?: unknown } | undefined {
  const data = (error as { response?: { data?: unknown } } | null | undefined)?.response?.data;
  if (!data || typeof data !== "object" || !("error" in data)) {
    return undefined;
  }
  const detail = (data as { error?: unknown }).error;
  return detail && typeof detail === "object" ? (detail as { code?: unknown }) : undefined;
}

/** The response's `error.code`, compared as a string (as `connect-with-token.ts`). */
function getApiErrorCode(error: unknown): string | undefined {
  const code = getApiErrorDetail(error)?.code;
  return typeof code === "string" ? code : undefined;
}

/** The response's non-blank `error.message`. */
function getApiErrorMessage(error: unknown): string | undefined {
  const message = getApiErrorDetail(error)?.message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

function classifyFolderRemovalError(
  action: FolderRemovalAction,
  error: unknown,
): FolderRemovalOutcome {
  const code = getApiErrorCode(error);

  if (code === FOLDER_API_ERROR_CODES.folderNotFound && action !== "transfer") {
    return { kind: "done" };
  }
  if (code === FOLDER_API_ERROR_CODES.differentOwner && action !== "leave") {
    return { kind: "permission-changed" };
  }
  if (action === "delete") {
    if (code === FOLDER_API_ERROR_CODES.deleteTargetNotFound) {
      return { kind: "target-unavailable", message: FOLDER_REMOVAL_MESSAGES.targetNotFound };
    }
    if (code === FOLDER_API_ERROR_CODES.deleteTargetAccessDenied) {
      return { kind: "target-unavailable", message: FOLDER_REMOVAL_MESSAGES.targetAccessDenied };
    }
  }
  if (action === "transfer") {
    if (code === FOLDER_API_ERROR_CODES.transferFolderNotFound) {
      return { kind: "ended" };
    }
    if (code === FOLDER_API_ERROR_CODES.transferMemberNotFound) {
      return { kind: "member-gone", message: FOLDER_REMOVAL_MESSAGES.memberGone };
    }
    if (code === FOLDER_API_ERROR_CODES.transferDuplicateName) {
      return { kind: "duplicate-name", message: FOLDER_REMOVAL_MESSAGES.duplicateName };
    }
  }

  return {
    kind: "failed",
    message: getApiErrorMessage(error) ?? DEFAULT_FAILURE_MESSAGES[action],
  };
}

export {
  FOLDER_API_ERROR_CODES,
  FOLDER_REMOVAL_MESSAGES,
  classifyFolderRemovalError,
  getApiErrorCode,
  getApiErrorMessage,
};
export type { FolderRemovalAction, FolderRemovalOutcome };
