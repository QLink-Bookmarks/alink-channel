import { getArrowKeyDelta, webKeyDownProps } from "./web-key-down";

describe("getArrowKeyDelta", () => {
  it("moves forward on down/right and back on up/left", () => {
    expect(getArrowKeyDelta("ArrowDown")).toBe(1);
    expect(getArrowKeyDelta("ArrowRight")).toBe(1);
    expect(getArrowKeyDelta("ArrowUp")).toBe(-1);
    expect(getArrowKeyDelta("ArrowLeft")).toBe(-1);
  });

  it("ignores other keys", () => {
    expect(getArrowKeyDelta("Enter")).toBe(0);
    expect(getArrowKeyDelta(" ")).toBe(0);
    expect(getArrowKeyDelta(undefined)).toBe(0);
  });
});

describe("webKeyDownProps", () => {
  it("passes the handler as onKeyDown", () => {
    const handler = jest.fn();
    webKeyDownProps(handler).onKeyDown({ nativeEvent: { key: "ArrowDown" } });
    expect(handler).toHaveBeenCalledWith({ nativeEvent: { key: "ArrowDown" } });
  });
});
