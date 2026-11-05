import type { WebKeyDownEvent } from "./web-key-down";

/** Native has no arrow keys; see `folder-picker-arrow-keys.web.ts`. */
function handleFolderPickerArrowKey(_event: WebKeyDownEvent) {}

export { handleFolderPickerArrowKey };
