import { renderHook } from "@testing-library/react-native";

import { useNewLinkShortcutLabel } from "./use-new-link-shortcut-label";

describe("useNewLinkShortcutLabel", () => {
  it("returns no shortcut label outside the web", () => {
    const { result } = renderHook(() => useNewLinkShortcutLabel());
    expect(result.current).toBeNull();
  });
});
