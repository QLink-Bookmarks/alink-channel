import * as React from "react";

const TODO_TITLE_MAX_LENGTH = 50;

type TodoTitleLimit = {
  maxLength: number | undefined;
  /** Changes when the field has to be mounted again to show the cut title. */
  inputKey: number;
  handleChangeText: (next: string) => void;
};

// The title stops at 50 characters through the field's own maxLength, which also cuts a
// longer paste at 50.
function useTodoTitleLimit(onChangeText: (next: string) => void, _value: string): TodoTitleLimit {
  const handleChangeText = React.useCallback(
    (next: string) => onChangeText(next.slice(0, TODO_TITLE_MAX_LENGTH)),
    [onChangeText],
  );
  return { maxLength: TODO_TITLE_MAX_LENGTH, inputKey: 0, handleChangeText };
}

export { TODO_TITLE_MAX_LENGTH, useTodoTitleLimit };
export type { TodoTitleLimit };
