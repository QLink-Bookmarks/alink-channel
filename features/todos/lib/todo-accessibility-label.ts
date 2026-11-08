const UNTITLED_TODO_NAME = "제목 없는 액션";

/** The action's title as a screen reader names it; a blank title reads `제목 없는 액션`. */
function getTodoAccessibilityName(title: string | null | undefined): string {
  const trimmed = title?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : UNTITLED_TODO_NAME;
}

/** `완료 표시, {제목}` or, once done, `완료 취소, {제목}`. */
function getTodoDoneToggleLabel(title: string | null | undefined, done: boolean): string {
  return `${done ? "완료 취소" : "완료 표시"}, ${getTodoAccessibilityName(title)}`;
}

/** `액션 삭제, {제목}`. */
function getTodoRemoveLabel(title: string | null | undefined): string {
  return `액션 삭제, ${getTodoAccessibilityName(title)}`;
}

/** The card's name: its title, then the lines it shows (schedule, badges, link), comma-joined. */
function getTodoCardLabel(
  title: string | null | undefined,
  details: (string | null | undefined | false)[],
): string {
  return [getTodoAccessibilityName(title), ...details].filter(Boolean).join(", ");
}

export {
  UNTITLED_TODO_NAME,
  getTodoAccessibilityName,
  getTodoCardLabel,
  getTodoDoneToggleLabel,
  getTodoRemoveLabel,
};
