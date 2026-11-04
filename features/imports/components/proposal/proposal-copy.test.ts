import {
  getAddCaption,
  getChangeMessage,
  getConflictNote,
  getImportButtonLabel,
  getStatusMessage,
  withEul,
  withRo,
  withWa,
} from "./proposal-copy";

describe("Korean particles", () => {
  it("picks 을/를, 로/으로 and 와/과 by the last syllable", () => {
    expect(withEul("미분류")).toBe("‘미분류’를");
    expect(withEul("주식")).toBe("‘주식’을");
    expect(withRo("미분류")).toBe("‘미분류’로");
    expect(withRo("자바")).toBe("‘자바’로");
    expect(withRo("서울")).toBe("‘서울’로");
    expect(withRo("주식")).toBe("‘주식’으로");
    expect(withWa("취업")).toBe("‘취업’과");
    expect(withWa("aws")).toBe("‘aws’와");
  });
});

describe("getChangeMessage", () => {
  it("describes a move that leaves a new folder empty", () => {
    expect(
      getChangeMessage({
        type: "move",
        linkTitle: "미국 중간 선거와 시장",
        toName: "미분류",
        excludedFolder: "주식",
      }),
    ).toEqual({
      message:
        "‘미국 중간 선거와 시장’을 ‘미분류’로 옮겼어요. 새 폴더 ‘주식’을 가져오기에서 제외해요.",
      undoLabel: "옮기기 취소",
    });
  });

  it("describes a removal and a merge", () => {
    expect(
      getChangeMessage({ type: "remove", linkTitle: "VPC", excludedFolder: null }).undoLabel,
    ).toBe("다시 넣기");
    expect(
      getChangeMessage({
        type: "merge",
        fromName: "자바",
        count: 8,
        toKind: "existing",
        toName: "aws",
      }).message,
    ).toBe("‘자바’의 링크 8개를 기존 폴더 ‘aws’로 합쳤어요.");
    expect(
      getStatusMessage({ kind: "notice", notice: { type: "rename-blocked", name: "자바" } }),
    ).toEqual({
      message: "공유 폴더와 같은 이름은 쓸 수 없어서 ‘자바’로 그대로 뒀어요.",
      undoLabel: null,
    });
  });

  it("describes removing and putting back a whole folder", () => {
    expect(
      getChangeMessage({
        type: "remove-all",
        folderName: "자바",
        count: 3,
        excludedFolder: "자바",
      }),
    ).toEqual({
      message: "‘자바’의 링크 3개를 가져오지 않아요. 새 폴더 ‘자바’를 가져오기에서 제외해요.",
      undoLabel: "모두 빼기 취소",
    });
    expect(
      getChangeMessage({ type: "remove-all", folderName: "미분류", count: 2, excludedFolder: null })
        .message,
    ).toBe("‘미분류’의 링크 2개를 가져오지 않아요.");
    expect(
      getChangeMessage({
        type: "restore-all",
        folderName: "자바",
        count: 3,
        includedFolder: "자바",
      }),
    ).toEqual({
      message: "‘자바’에 링크 3개를 다시 넣었어요. 새 폴더 ‘자바’를 다시 가져와요.",
      undoLabel: "넣기 취소",
    });
    expect(
      getChangeMessage({
        type: "restore",
        linkTitle: "팀 캘린더",
        toName: "미분류",
        includedFolder: null,
      }),
    ).toEqual({ message: "‘팀 캘린더’를 ‘미분류’에 다시 넣었어요.", undoLabel: "넣기 취소" });
  });

  it("prefixes the previous change after an undo", () => {
    expect(
      getStatusMessage({
        kind: "change",
        change: { type: "remove", linkTitle: "팀 캘린더", excludedFolder: null },
        isAfterUndo: true,
        depth: 3,
      }),
    ).toEqual({
      message: "되돌렸어요. 이전 변경: ‘팀 캘린더’를 가져오지 않아요.",
      undoLabel: "다시 넣기",
    });
  });

  it("explains a numbered folder made because of my shared folder", () => {
    expect(getConflictNote("취업 2", "취업")).toBe(
      "공유 중인 내 폴더 ‘취업’과 이름이 같아서 ‘취업 2’로 따로 만들어요.",
    );
  });
});

describe("footer copy", () => {
  it("never mentions a zero count", () => {
    expect(getAddCaption(11, 3)).toBe("링크 11개와 새 폴더 3개를 추가해요");
    expect(getAddCaption(3, 0)).toBe("링크 3개를 추가해요");
    expect(getAddCaption(0, 0)).toBe("가져올 링크가 없어요");
    expect(getAddCaption(2000, 1)).toBe("링크 2,000개와 새 폴더 1개를 추가해요");
  });

  it("folds the link count into the import button", () => {
    expect(getImportButtonLabel(11)).toBe("링크 11개 가져오기");
    expect(getImportButtonLabel(0)).toBe("가져오기");
  });
});
