import { getChangeMessage, getConflictNote, withEul, withRo, withWa } from "./proposal-copy";

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
    expect(getChangeMessage({ type: "rename-blocked", name: "자바" })).toEqual({
      message: "공유 폴더와 같은 이름은 쓸 수 없어서 ‘자바’로 그대로 뒀어요.",
      undoLabel: null,
    });
  });

  it("explains a numbered folder made because of my shared folder", () => {
    expect(getConflictNote("취업 2", "취업")).toBe(
      "공유 중인 내 폴더 ‘취업’과 이름이 같아서 ‘취업 2’로 따로 만들어요.",
    );
  });
});
