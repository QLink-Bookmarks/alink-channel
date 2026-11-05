import { getFolderDeleteTitle } from "./folder-delete-title";

describe("getFolderDeleteTitle", () => {
  it("names a personal folder with its emoji", () => {
    expect(getFolderDeleteTitle({ name: "주말 여행", emoji: "🧳", isShared: false })).toBe(
      "🧳 주말 여행 폴더를 삭제할까요?",
    );
  });

  it("names a shared folder with its emoji", () => {
    expect(getFolderDeleteTitle({ name: "팀 자료", emoji: "🧭", isShared: true })).toBe(
      "🧭 팀 자료 공유 폴더를 삭제할까요?",
    );
  });

  it.each([null, undefined, "", "  "])("leaves the emoji part out when it is %p", (emoji) => {
    expect(getFolderDeleteTitle({ name: "읽을거리", emoji, isShared: false })).toBe(
      "읽을거리 폴더를 삭제할까요?",
    );
    expect(getFolderDeleteTitle({ name: "읽을거리", emoji, isShared: true })).toBe(
      "읽을거리 공유 폴더를 삭제할까요?",
    );
  });

  it("keeps the name exactly as stored", () => {
    expect(getFolderDeleteTitle({ name: "ㄹㅁㅇ  Test", emoji: "😂", isShared: false })).toBe(
      "😂 ㄹㅁㅇ  Test 폴더를 삭제할까요?",
    );
  });
});
