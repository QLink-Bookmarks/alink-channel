import * as React from "react";

import { getNewLinkShortcutLabel } from "../lib/new-link-shortcut";

const SERVER_LABEL = "Alt+N";
const isWeb = process.env.EXPO_OS === "web";

function subscribe() {
  return () => {};
}

function getNativeLabel() {
  return null;
}

function useNewLinkShortcutLabel(): string | null {
  return React.useSyncExternalStore(
    subscribe,
    isWeb ? getNewLinkShortcutLabel : getNativeLabel,
    isWeb ? () => SERVER_LABEL : getNativeLabel,
  );
}

export { useNewLinkShortcutLabel };
