import { act, renderHook } from "@testing-library/react-native";

// Jest runs as iOS, so this resolves to use-todo-title-limit.ios.ts; the web field keeps
// its maxLength (checked in tests/e2e/todo-editor.spec.ts).
import { useTodoTitleLimit as useIosTodoTitleLimit } from "./use-todo-title-limit";

describe("useTodoTitleLimit on iOS", () => {
  it("drops the native maxLength so the 50th Korean syllable can finish composing", () => {
    const { result } = renderHook(() => useIosTodoTitleLimit(jest.fn(), ""));
    expect(result.current.maxLength).toBeUndefined();
  });

  it("cuts at 50 and mounts the field again only when the cut title is already shown", () => {
    const onChangeText = jest.fn();
    const full = "가".repeat(50);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useIosTodoTitleLimit(onChangeText, value),
      { initialProps: { value: "가".repeat(49) } },
    );

    act(() => result.current.handleChangeText(`${"가".repeat(49)}확인`));
    expect(onChangeText).toHaveBeenLastCalledWith(`${"가".repeat(49)}확`);
    expect(result.current.inputKey).toBe(0);

    rerender({ value: full });
    act(() => result.current.handleChangeText(`${full}나`));
    expect(onChangeText).toHaveBeenLastCalledWith(full);
    expect(result.current.inputKey).toBe(1);
  });
});
