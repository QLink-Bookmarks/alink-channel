import {
  formatImportTime,
  getImportFailureReasonLabel,
  getImportRowMeta,
  getImportStartedCopy,
  getImportStatusLabel,
  getImportStatusTone,
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

describe("getImportRowMeta", () => {
  const base = {
    createdAt: localIso(2026, 10, 28, 9, 12),
    linkCount: 133,
    folderCount: 39,
    failedCount: 0,
  };

  it("shows links and new folders", () => {
    expect(getImportRowMeta({ ...base, status: "COMPLETED" }, NOW)).toBe(
      "10월 28일 오전 9:12 · 링크 133개 · 새 폴더 39개",
    );
  });

  it("adds the failure count", () => {
    expect(getImportRowMeta({ ...base, status: "PARTIALLY_FAILED", failedCount: 3 }, NOW)).toBe(
      "10월 28일 오전 9:12 · 링크 133개 · 새 폴더 39개 · 실패 3개",
    );
  });

  it("says nothing was imported for a failed record", () => {
    expect(
      getImportRowMeta(
        { ...base, status: "FAILED", linkCount: 0, folderCount: 0, failedCount: 2 },
        NOW,
      ),
    ).toBe("10월 28일 오전 9:12 · 링크를 가져오지 못했어요 · 실패 2개");
  });
});

describe("getImportStartedCopy", () => {
  it("says when the import ran", () => {
    expect(getImportStartedCopy(localIso(2026, 10, 28, 9, 12), NOW)).toBe(
      "10월 28일 오전 9:12에 가져왔어요.",
    );
  });
});
