import {
  getNewLinkShortcutLabel,
  isNewLinkShortcut,
  suppressNextTextInput,
} from "./new-link-shortcut";

function keyEvent(overrides: Partial<KeyboardEvent>) {
  return { altKey: false, metaKey: false, ctrlKey: false, code: "KeyN", ...overrides };
}

describe("isNewLinkShortcut", () => {
  it("matches Alt/Option with the N key position, whatever character it produces", () => {
    expect(isNewLinkShortcut(keyEvent({ altKey: true }))).toBe(true);
    for (const key of ["˜", "Dead", "Process", "ㅜ"]) {
      expect(isNewLinkShortcut(keyEvent({ altKey: true, key }))).toBe(true);
    }
  });

  it("ignores N alone, other keys and Cmd/Ctrl combinations", () => {
    expect(isNewLinkShortcut(keyEvent({}))).toBe(false);
    expect(isNewLinkShortcut(keyEvent({ altKey: true, code: "KeyM" }))).toBe(false);
    expect(isNewLinkShortcut(keyEvent({ altKey: true, metaKey: true }))).toBe(false);
    expect(isNewLinkShortcut(keyEvent({ altKey: true, ctrlKey: true }))).toBe(false);
  });
});

describe("getNewLinkShortcutLabel", () => {
  it("shows ⌥N on macOS and Alt+N elsewhere", () => {
    expect(getNewLinkShortcutLabel({ platform: "MacIntel" })).toBe("⌥N");
    expect(getNewLinkShortcutLabel({ userAgentData: { platform: "macOS" } })).toBe("⌥N");
    expect(getNewLinkShortcutLabel({ platform: "Win32" })).toBe("Alt+N");
    expect(getNewLinkShortcutLabel({ userAgentData: { platform: "Windows" } })).toBe("Alt+N");
    expect(getNewLinkShortcutLabel({ platform: "Linux x86_64" })).toBe("Alt+N");
  });
});

describe("suppressNextTextInput", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function createTarget() {
    const listeners = new Map<string, (event: Event) => void>();
    return {
      listeners,
      addEventListener: jest.fn((type: string, listener: (event: Event) => void) => {
        listeners.set(type, listener);
      }),
      removeEventListener: jest.fn((type: string) => {
        listeners.delete(type);
      }),
    };
  }

  it("cancels the dead-key composition right after the shortcut, then stops listening", () => {
    const target = createTarget();
    suppressNextTextInput(target as unknown as Window);
    const composition = { type: "compositionstart", preventDefault: jest.fn() };
    const typed = {
      type: "beforeinput",
      inputType: "insertCompositionText",
      data: "˜",
      preventDefault: jest.fn(),
    };

    target.listeners.get("compositionstart")?.(composition as unknown as Event);
    target.listeners.get("beforeinput")?.(typed as unknown as Event);

    expect(composition.preventDefault).toHaveBeenCalled();
    expect(typed.preventDefault).toHaveBeenCalled();
    expect(target.listeners.size).toBe(0);
  });

  it("lets ordinary typing through", () => {
    const target = createTarget();
    suppressNextTextInput(target as unknown as Window);
    const typed = {
      type: "beforeinput",
      inputType: "insertText",
      data: "h",
      preventDefault: jest.fn(),
    };

    target.listeners.get("beforeinput")?.(typed as unknown as Event);

    expect(typed.preventDefault).not.toHaveBeenCalled();
    expect(target.listeners.size).toBe(2);
  });

  it("stops listening after a short time when no text input follows", () => {
    const target = createTarget();
    suppressNextTextInput(target as unknown as Window);
    expect(target.listeners.size).toBe(2);

    jest.advanceTimersByTime(400);

    expect(target.listeners.size).toBe(0);
  });
});
