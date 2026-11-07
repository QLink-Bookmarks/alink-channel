import * as React from "react";

import { act, render, screen } from "@testing-library/react-native";

import { ArchivedSuccess } from "./archived-success";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
let mockReducedMotion = false;
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  return {
    ...require("react-native-reanimated/mock"),
    useReducedMotion: () => mockReducedMotion,
    useSharedValue: (init: unknown) => ReactModule.useRef({ value: init }).current,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

function renderedWord() {
  return screen
    .getAllByText(/^[A-Za-z]$/)
    .map((node) => node.props.children)
    .join("");
}

describe("ArchivedSuccess", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the Archived word with an accessible saved label", () => {
    render(<ArchivedSuccess onFinished={jest.fn()} />);

    expect(renderedWord()).toBe("Archived");
    expect(screen.getByLabelText("저장됨")).toBeTruthy();
  });

  it("calls onFinished once after the full animation", () => {
    const handleFinished = jest.fn();
    render(<ArchivedSuccess onFinished={handleFinished} />);

    act(() => {
      jest.advanceTimersByTime(2249);
    });
    expect(handleFinished).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(handleFinished).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(handleFinished).toHaveBeenCalledTimes(1);
  });

  it("finishes sooner with Reduce Motion", () => {
    mockReducedMotion = true;
    const handleFinished = jest.fn();
    render(<ArchivedSuccess onFinished={handleFinished} />);

    expect(renderedWord()).toBe("Archived");

    act(() => {
      jest.advanceTimersByTime(1299);
    });
    expect(handleFinished).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(handleFinished).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(handleFinished).toHaveBeenCalledTimes(1);
  });

  it("does not call onFinished after unmounting early", () => {
    const handleFinished = jest.fn();
    const { unmount } = render(<ArchivedSuccess onFinished={handleFinished} />);

    unmount();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(handleFinished).not.toHaveBeenCalled();
  });

  it("uses the latest onFinished without restarting the timer", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(<ArchivedSuccess onFinished={first} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    rerender(<ArchivedSuccess onFinished={second} />);
    act(() => {
      jest.advanceTimersByTime(1250);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
