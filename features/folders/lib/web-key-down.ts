/** The part of a keydown event the folder pickers read. */
type WebKeyDownEvent = {
  nativeEvent?: { key?: string };
  currentTarget?: unknown;
  preventDefault?: () => void;
};

type WebKeyDownProps = { onKeyDown: (event: WebKeyDownEvent) => void };

/**
 * Props for a Pressable's keydown handler. react-native-web forwards `onKeyDown` to the DOM;
 * native has no key events, so the prop is never called there.
 */
function webKeyDownProps(onKeyDown: (event: WebKeyDownEvent) => void): WebKeyDownProps {
  return { onKeyDown };
}

/** +1 for ArrowDown/ArrowRight, -1 for ArrowUp/ArrowLeft, 0 for other keys. */
function getArrowKeyDelta(key: string | undefined): -1 | 0 | 1 {
  if (key === "ArrowDown" || key === "ArrowRight") {
    return 1;
  }
  if (key === "ArrowUp" || key === "ArrowLeft") {
    return -1;
  }
  return 0;
}

export { getArrowKeyDelta, webKeyDownProps };
export type { WebKeyDownEvent, WebKeyDownProps };
