import type { TodoDraftEditorItem } from "@/features/todos/components/todo-draft-list-editor";

import { getMemoActionsSummary } from "./link-create-memo-actions";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

function todo(overrides: Partial<TodoDraftEditorItem> = {}): TodoDraftEditorItem {
  return {
    id: "1",
    title: "",
    mode: "none",
    selectedWeekdays: ["mon"],
    date: null,
    time: null,
    ...overrides,
  };
}

describe("getMemoActionsSummary", () => {
  it("says 선택 when the group holds nothing", () => {
    expect(getMemoActionsSummary("", [])).toBe("선택");
    expect(getMemoActionsSummary("   ", [todo()])).toBe("선택");
  });

  it("names the memo alone", () => {
    expect(getMemoActionsSummary("연말 연휴에 갈 때 참고", [])).toBe("메모");
  });

  it("counts the actions with a title or a schedule, after the memo", () => {
    expect(
      getMemoActionsSummary("메모", [todo({ title: "렌터카 예약 확인" }), todo({ id: "2" })]),
    ).toBe("메모 · 액션 1개");
    expect(
      getMemoActionsSummary("", [
        todo({ title: "a" }),
        todo({ id: "2", mode: "time", date: { year: 2027, month: 3, day: 15 } }),
      ]),
    ).toBe("액션 2개");
  });

  it("leaves out a row with a mode but no title, date or time, as the save does", () => {
    expect(getMemoActionsSummary("", [todo({ mode: "time" })])).toBe("선택");
  });
});
