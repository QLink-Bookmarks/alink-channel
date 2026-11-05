import { getFolderNameGuide } from "./folder-name-guide";

const sentence = (name: string) => {
  const guide = getFolderNameGuide(name);
  return `${guide.before}${guide.name}${guide.after}`;
};

describe("getFolderNameGuide", () => {
  it("uses 을 after a Hangul syllable with a final consonant", () => {
    expect(getFolderNameGuide("주말 여행")).toEqual({
      before: "삭제하려면 ",
      name: "주말 여행",
      after: "을 입력해주세요.",
    });
    expect(sentence("팀 자료함")).toBe("삭제하려면 팀 자료함을 입력해주세요.");
    expect(sentence("캠핑 모임 2026 사진")).toBe("삭제하려면 캠핑 모임 2026 사진을 입력해주세요.");
  });

  it("uses 를 after a Hangul syllable without a final consonant", () => {
    expect(sentence("읽을거리")).toBe("삭제하려면 읽을거리를 입력해주세요.");
    expect(sentence("나의 노트")).toBe("삭제하려면 나의 노트를 입력해주세요.");
  });

  it.each([
    ["Dev folder"],
    ["qa57-personal"],
    ["2026"],
    ["ㄹㅁㅇㅎㄹㅁㅇ"],
    ["여행 ✈️"],
    ["자료!"],
  ])("falls back to the neutral form for %p", (name) => {
    expect(getFolderNameGuide(name)).toEqual({
      before: "삭제하려면 아래에 ",
      name,
      after: " 입력해주세요.",
    });
  });

  it("decides by the trimmed name and shows it trimmed", () => {
    expect(getFolderNameGuide("  읽을거리  ")).toEqual({
      before: "삭제하려면 ",
      name: "읽을거리",
      after: "를 입력해주세요.",
    });
  });
});
