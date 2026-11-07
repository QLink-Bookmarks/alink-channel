import * as React from "react";

import type { TodoTitleLimit } from "./use-todo-title-limit";

const TODO_TITLE_MAX_LENGTH = 50;

// iOS: the native maxLength refuses the next jamo of the syllable being composed at the
// limit, so a Korean 50th character stops half-built (확 → 호). The field takes the text
// as typed and the title is cut at 50 here instead. When the cut title equals the one
// already shown, the field would keep showing the longer text, so it is mounted again.
function useTodoTitleLimit(onChangeText: (next: string) => void, value: string): TodoTitleLimit {
  const [inputKey, setInputKey] = React.useState(0);

  const handleChangeText = React.useCallback(
    (next: string) => {
      if (next.length <= TODO_TITLE_MAX_LENGTH) {
        onChangeText(next);
        return;
      }
      const cut = next.slice(0, TODO_TITLE_MAX_LENGTH);
      onChangeText(cut);
      if (cut === value) setInputKey((key) => key + 1);
    },
    [onChangeText, value],
  );

  return { maxLength: undefined, inputKey, handleChangeText };
}

export { TODO_TITLE_MAX_LENGTH, useTodoTitleLimit };
