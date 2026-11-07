import {
  getTodoAccessibilityName,
  getTodoCardLabel,
  getTodoDoneToggleLabel,
  getTodoRemoveLabel,
} from "./todo-accessibility-label";

describe("todo accessibility labels", () => {
  it("names the action by its title, or 제목 없는 액션 when blank", () => {
    expect(getTodoAccessibilityName("렌터카 예약 확인")).toBe("렌터카 예약 확인");
    expect(getTodoAccessibilityName("  렌터카  ")).toBe("렌터카");
    expect(getTodoAccessibilityName("")).toBe("제목 없는 액션");
    expect(getTodoAccessibilityName("   ")).toBe("제목 없는 액션");
    expect(getTodoAccessibilityName(null)).toBe("제목 없는 액션");
  });

  it("names the done checkbox by its next action and the title", () => {
    expect(getTodoDoneToggleLabel("렌터카 예약 확인", false)).toBe("완료 표시, 렌터카 예약 확인");
    expect(getTodoDoneToggleLabel("렌터카 예약 확인", true)).toBe("완료 취소, 렌터카 예약 확인");
    expect(getTodoDoneToggleLabel("", false)).toBe("완료 표시, 제목 없는 액션");
  });

  it("names the remove button with the title", () => {
    expect(getTodoRemoveLabel("숙소 2박 결제")).toBe("액션 삭제, 숙소 2박 결제");
    expect(getTodoRemoveLabel("")).toBe("액션 삭제, 제목 없는 액션");
  });

  it("joins the card's lines after the title and skips empty ones", () => {
    expect(getTodoCardLabel("렌터카 예약 확인", ["11/20 22:45", "고치기"])).toBe(
      "렌터카 예약 확인, 11/20 22:45, 고치기",
    );
    expect(getTodoCardLabel("숙소 2박 결제", [null, false, "", "고치기"])).toBe(
      "숙소 2박 결제, 고치기",
    );
  });
});
