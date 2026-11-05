import { type WebKeyDownEvent, getArrowKeyDelta } from "./web-key-down";

/**
 * Arrow keys move to the previous or next folder row in the picker list and choose it, as in a
 * radio group. Rows are separate Pressables (the sections sit between them), so this walks the
 * rendered `role="radio"` rows inside the list's radiogroup.
 */
function handleFolderPickerArrowKey(event: WebKeyDownEvent) {
  const delta = getArrowKeyDelta(event.nativeEvent?.key);
  const current = event.currentTarget as HTMLElement | undefined;
  const group = current?.closest?.('[role="radiogroup"]');
  if (delta === 0 || !current || !group) {
    return;
  }
  const rows = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
  const index = rows.indexOf(current);
  if (index < 0 || rows.length < 2) {
    return;
  }
  event.preventDefault?.();
  const next = rows[(index + delta + rows.length) % rows.length];
  next.focus();
  next.click();
}

export { handleFolderPickerArrowKey };
