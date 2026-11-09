type ShortcutKeyEvent = Pick<KeyboardEvent, "altKey" | "metaKey" | "ctrlKey" | "code">;

type PlatformNavigator = {
  platform?: string;
  userAgentData?: { platform?: string };
};

const TEXT_INPUT_SUPPRESS_MS = 400;

function isNewLinkShortcut(event: ShortcutKeyEvent) {
  return event.altKey && !event.metaKey && !event.ctrlKey && event.code === "KeyN";
}

function isMacPlatform(navigatorLike?: PlatformNavigator) {
  const platform = navigatorLike?.userAgentData?.platform || navigatorLike?.platform || "";
  return /mac/i.test(platform);
}

function getNewLinkShortcutLabel(navigatorLike?: PlatformNavigator) {
  const source =
    navigatorLike ??
    (typeof navigator === "undefined" ? undefined : (navigator as PlatformNavigator));
  return isMacPlatform(source) ? "⌥N" : "Alt+N";
}

function isDeadKeyInput(event: Event) {
  if (event.type === "compositionstart") {
    return true;
  }
  const inputEvent = event as InputEvent;
  return inputEvent.inputType === "insertCompositionText" || inputEvent.data === "˜";
}

function suppressNextTextInput(target: Pick<Window, "addEventListener" | "removeEventListener">) {
  const cancel = (event: Event) => {
    if (!isDeadKeyInput(event)) {
      return;
    }
    event.preventDefault();
    if (event.type === "beforeinput") {
      release();
    }
  };
  const release = () => {
    clearTimeout(timer);
    target.removeEventListener("beforeinput", cancel, true);
    target.removeEventListener("compositionstart", cancel, true);
  };
  const timer = setTimeout(release, TEXT_INPUT_SUPPRESS_MS);
  target.addEventListener("beforeinput", cancel, true);
  target.addEventListener("compositionstart", cancel, true);
  return release;
}

export { getNewLinkShortcutLabel, isMacPlatform, isNewLinkShortcut, suppressNextTextInput };
export type { PlatformNavigator, ShortcutKeyEvent };
