import type { ImportDetailFolder } from "../types";
import {
  formatImportTime,
  getImportFailureReasonLabel,
  getImportResultCopy,
  getImportRowMetaParts,
  getImportStartedCopy,
  getImportStatusBadgeLabel,
  getImportStatusLabel,
  getImportStatusTone,
  getImportedLinksFolderId,
  isFillingThumbnails,
  isJustImported,
} from "./import-status-copy";

const NOW = new Date(2026, 10, 3, 15, 0);

function localIso(year: number, month: number, day: number, hours: number, minutes: number) {
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

describe("getImportStatusLabel", () => {
  it.each([
    ["COMPLETED", "완료", "success"],
    ["PARTIALLY_FAILED", "일부 실패", "warning"],
    ["FAILED", "실패", "danger"],
    ["UNDONE", "되돌림", "muted"],
    ["PARTIALLY_UNDONE", "일부 되돌림", "muted"],
  ] as const)("labels %s as %s", (status, label, tone) => {
    expect(getImportStatusLabel(status)).toBe(label);
    expect(getImportStatusTone(status)).toBe(tone);
  });
});

describe("getImportFailureReasonLabel", () => {
  it("has a Korean sentence for every reason", () => {
    expect(getImportFailureReasonLabel("URL_INVALID")).toBe("주소 형식을 처리하지 못했어요");
    expect(getImportFailureReasonLabel("TITLE_INVALID")).toBe("제목을 처리하지 못했어요");
    expect(getImportFailureReasonLabel("UNKNOWN")).toBe("알 수 없는 이유로 저장하지 못했어요");
  });

  it("falls back to the unknown sentence for a reason the app does not know", () => {
    expect(getImportFailureReasonLabel("NEW_REASON" as never)).toBe(
      "알 수 없는 이유로 저장하지 못했어요",
    );
  });
});

describe("formatImportTime", () => {
  it("says 오늘 for the same day", () => {
    expect(formatImportTime(localIso(2026, 11, 3, 14, 41), NOW)).toBe("오늘 오후 2:41");
  });

  it("shows month and day for an earlier day this year", () => {
    expect(formatImportTime(localIso(2026, 11, 1, 22, 24), NOW)).toBe("11월 1일 오후 10:24");
    expect(formatImportTime(localIso(2026, 10, 28, 9, 12), NOW)).toBe("10월 28일 오전 9:12");
  });

  it("uses 12 for noon and midnight", () => {
    expect(formatImportTime(localIso(2026, 10, 1, 0, 5), NOW)).toBe("10월 1일 오전 12:05");
    expect(formatImportTime(localIso(2026, 10, 1, 12, 0), NOW)).toBe("10월 1일 오후 12:00");
  });

  it("adds the year for another year", () => {
    expect(formatImportTime(localIso(2025, 12, 31, 23, 59), NOW)).toBe(
      "2025년 12월 31일 오후 11:59",
    );
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatImportTime("not-a-date", NOW)).toBe("");
  });
});

describe("getImportRowMetaParts", () => {
  const base = {
    createdAt: localIso(2026, 10, 28, 9, 12),
    linkCount: 133,
    folderCount: 39,
    failedCount: 0,
  };

  it("keeps each number with its unit in one part", () => {
    expect(getImportRowMetaParts({ ...base, status: "COMPLETED" }, NOW)).toEqual([
      "10월 28일 오전 9:12",
      "링크 133개",
      "새 폴더 39개",
    ]);
  });

  it("adds the failure count", () => {
    expect(
      getImportRowMetaParts({ ...base, status: "PARTIALLY_FAILED", failedCount: 3 }, NOW),
    ).toEqual(["10월 28일 오전 9:12", "링크 133개", "새 폴더 39개", "실패 3개"]);
  });

  it("says nothing was imported for a failed record", () => {
    expect(
      getImportRowMetaParts(
        { ...base, status: "FAILED", linkCount: 0, folderCount: 0, failedCount: 2 },
        NOW,
      ),
    ).toEqual(["10월 28일 오전 9:12", "링크를 가져오지 못했어요", "실패 2개"]);
  });
});

describe("thumbnail state", () => {
  it("combines the status with the filling note while thumbnails fill", () => {
    expect(isFillingThumbnails({ status: "COMPLETED", progress: 0.4 })).toBe(true);
    expect(isFillingThumbnails({ status: "PARTIALLY_FAILED", progress: 0 })).toBe(true);
    expect(getImportStatusBadgeLabel("COMPLETED", true)).toBe("완료 · 썸네일 채우는 중");
    expect(getImportStatusBadgeLabel("PARTIALLY_FAILED", true)).toBe(
      "일부 실패 · 썸네일 채우는 중",
    );
  });

  it("shows only the status once filling is done or nothing is left to fill", () => {
    expect(isFillingThumbnails({ status: "COMPLETED", progress: 1 })).toBe(false);
    expect(isFillingThumbnails({ status: "FAILED", progress: 0 })).toBe(false);
    expect(isFillingThumbnails({ status: "UNDONE", progress: 0.5 })).toBe(false);
    expect(getImportStatusBadgeLabel("COMPLETED", false)).toBe("완료");
  });
});

describe("isJustImported", () => {
  const now = new Date(2026, 10, 3, 15, 0, 0);

  it("is true up to one minute after the import", () => {
    expect(isJustImported(new Date(now.getTime() - 60_000).toISOString(), now)).toBe(true);
    expect(isJustImported(new Date(now.getTime() - 61_000).toISOString(), now)).toBe(false);
  });

  it("treats a slightly future time from a skewed clock as just imported", () => {
    expect(isJustImported(new Date(now.getTime() + 5_000).toISOString(), now)).toBe(true);
  });

  it("is false for an invalid date", () => {
    expect(isJustImported("not-a-date", now)).toBe(false);
  });
});

describe("getImportResultCopy", () => {
  const base = { linkCount: 136, folderCount: 39, failedCount: 0, isReversible: true };

  it("sums up a completed import and offers its links", () => {
    expect(getImportResultCopy({ ...base, status: "COMPLETED" })).toEqual({
      tone: "success",
      title: "방금 가져왔어요",
      sentence: "링크 136개와 새 폴더 39개를 추가했어요.",
      canOpenLinks: true,
      canReverse: true,
    });
  });

  it("points to the detail for failures and drops the folder part when there is none", () => {
    expect(
      getImportResultCopy({ ...base, status: "PARTIALLY_FAILED", folderCount: 0, failedCount: 2 })
        .sentence,
    ).toBe("링크 136개를 추가했어요. 실패 2개는 상세에서 볼 수 있어요.");
  });

  it("offers only the detail for a failed import", () => {
    expect(
      getImportResultCopy({ ...base, status: "FAILED", linkCount: 0, folderCount: 0 }),
    ).toMatchObject({
      tone: "danger",
      title: "가져오지 못했어요",
      canOpenLinks: false,
      canReverse: false,
    });
  });

  it("offers only the detail once every link was reversed", () => {
    expect(getImportResultCopy({ ...base, status: "UNDONE", isReversible: false })).toEqual({
      tone: "muted",
      title: "방금 가져왔어요",
      sentence: "가져온 링크를 모두 되돌렸어요.",
      canOpenLinks: false,
      canReverse: false,
    });
  });
});

describe("getImportedLinksFolderId", () => {
  function folder(
    kind: ImportDetailFolder["kind"],
    folderId: number | null,
    linkCount: number,
  ): ImportDetailFolder {
    return {
      kind,
      folderId,
      name: kind === "UNFILED" ? null : `폴더 ${folderId}`,
      links: Array.from({ length: linkCount }, (_, index) => ({
        linkId: index + 1,
        title: "링크",
        url: "https://a.test",
      })),
    };
  }

  it("goes to the first new folder that received links", () => {
    expect(
      getImportedLinksFolderId({
        folders: [folder("UNFILED", null, 2), folder("NEW", 11, 0), folder("NEW", 12, 3)],
      }),
    ).toBe(12);
  });

  it("falls back to the first folder that received links", () => {
    expect(
      getImportedLinksFolderId({
        folders: [folder("EXISTING", 20, 2), folder("UNFILED", null, 1)],
      }),
    ).toBe(20);
    expect(
      getImportedLinksFolderId({
        folders: [folder("UNFILED", null, 1), folder("EXISTING", 20, 2)],
      }),
    ).toBe(0);
  });

  it("has no target when no folder received links", () => {
    expect(getImportedLinksFolderId({ folders: [folder("NEW", 11, 0)] })).toBeNull();
  });
});

describe("getImportStartedCopy", () => {
  it("says when the import ran", () => {
    expect(getImportStartedCopy(localIso(2026, 10, 28, 9, 12), NOW)).toBe(
      "10월 28일 오전 9:12에 가져왔어요.",
    );
  });
});
