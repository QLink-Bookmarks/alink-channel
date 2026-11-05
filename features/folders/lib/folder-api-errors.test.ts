import {
  FOLDER_API_ERROR_CODES,
  FOLDER_REMOVAL_MESSAGES,
  classifyFolderRemovalError,
  getApiErrorCode,
  getApiErrorMessage,
} from "./folder-api-errors";

function apiError(code?: string, message?: string) {
  return {
    isAxiosError: true,
    response: { status: 400, data: { success: false, data: null, error: { code, message } } },
  };
}

const networkError = { isAxiosError: true, message: "Network Error" };

describe("getApiErrorCode / getApiErrorMessage", () => {
  it("reads error.code and a non-blank error.message", () => {
    expect(getApiErrorCode(apiError(FOLDER_API_ERROR_CODES.folderNotFound, "없음"))).toBe(
      FOLDER_API_ERROR_CODES.folderNotFound,
    );
    expect(getApiErrorMessage(apiError("X", "서버 메시지"))).toBe("서버 메시지");
    expect(getApiErrorMessage(apiError("X", "  "))).toBeUndefined();
  });

  it("returns nothing without a response body", () => {
    expect(getApiErrorCode(networkError)).toBeUndefined();
    expect(getApiErrorMessage(new Error("boom"))).toBeUndefined();
    expect(getApiErrorCode(null)).toBeUndefined();
  });
});

describe("classifyFolderRemovalError", () => {
  const codes = FOLDER_API_ERROR_CODES;

  it("treats a missing folder as done for delete and leave, ended for transfer", () => {
    expect(classifyFolderRemovalError("delete", apiError(codes.folderNotFound))).toEqual({
      kind: "done",
    });
    expect(classifyFolderRemovalError("leave", apiError(codes.folderNotFound))).toEqual({
      kind: "done",
    });
    expect(classifyFolderRemovalError("transfer", apiError(codes.transferFolderNotFound))).toEqual({
      kind: "ended",
    });
  });

  it("flags a permission change for delete and transfer", () => {
    expect(classifyFolderRemovalError("delete", apiError(codes.differentOwner))).toEqual({
      kind: "permission-changed",
    });
    expect(classifyFolderRemovalError("transfer", apiError(codes.differentOwner))).toEqual({
      kind: "permission-changed",
    });
  });

  it("maps the move target errors to their messages", () => {
    expect(classifyFolderRemovalError("delete", apiError(codes.deleteTargetNotFound, "x"))).toEqual(
      {
        kind: "target-unavailable",
        message: FOLDER_REMOVAL_MESSAGES.targetNotFound,
      },
    );
    expect(
      classifyFolderRemovalError("delete", apiError(codes.deleteTargetAccessDenied, "x")),
    ).toEqual({
      kind: "target-unavailable",
      message: FOLDER_REMOVAL_MESSAGES.targetAccessDenied,
    });
  });

  it("maps the transfer member and name errors", () => {
    expect(classifyFolderRemovalError("transfer", apiError(codes.transferMemberNotFound))).toEqual({
      kind: "member-gone",
      message: FOLDER_REMOVAL_MESSAGES.memberGone,
    });
    expect(classifyFolderRemovalError("transfer", apiError(codes.transferDuplicateName))).toEqual({
      kind: "duplicate-name",
      message: FOLDER_REMOVAL_MESSAGES.duplicateName,
    });
  });

  it("falls back to the server message, then the action's default", () => {
    expect(classifyFolderRemovalError("delete", apiError("COM_500_0001", "서버가 아파요"))).toEqual(
      {
        kind: "failed",
        message: "서버가 아파요",
      },
    );
    expect(classifyFolderRemovalError("delete", networkError)).toEqual({
      kind: "failed",
      message: FOLDER_REMOVAL_MESSAGES.deleteFailed,
    });
    expect(classifyFolderRemovalError("transfer", networkError)).toEqual({
      kind: "failed",
      message: FOLDER_REMOVAL_MESSAGES.transferFailed,
    });
    expect(classifyFolderRemovalError("leave", apiError(codes.ownerCannotLeave))).toEqual({
      kind: "failed",
      message: FOLDER_REMOVAL_MESSAGES.leaveFailed,
    });
  });

  it("does not apply one action's codes to another", () => {
    expect(classifyFolderRemovalError("transfer", apiError(codes.deleteTargetNotFound)).kind).toBe(
      "failed",
    );
    expect(classifyFolderRemovalError("delete", apiError(codes.transferDuplicateName)).kind).toBe(
      "failed",
    );
    expect(classifyFolderRemovalError("leave", apiError(codes.differentOwner)).kind).toBe("failed");
  });
});
