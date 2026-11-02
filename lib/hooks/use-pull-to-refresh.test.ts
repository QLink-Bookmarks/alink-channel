import { act, renderHook } from "@testing-library/react-native";

import { usePullToRefresh } from "./use-pull-to-refresh";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("usePullToRefresh", () => {
  it("starts without a spinner", () => {
    const { result } = renderHook(() => usePullToRefresh(() => Promise.resolve()));
    expect(result.current.isRefreshing).toBe(false);
  });

  it("shows the spinner only while the pulled refresh runs", async () => {
    const pending = deferred();
    const refresh = jest.fn(() => pending.promise);
    const { result } = renderHook(() => usePullToRefresh(refresh));

    act(() => {
      result.current.handleRefresh();
    });
    expect(result.current.isRefreshing).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(result.current.isRefreshing).toBe(false);
  });

  it("stops the spinner when the refresh fails", async () => {
    const pending = deferred();
    const { result } = renderHook(() => usePullToRefresh(() => pending.promise));

    act(() => {
      result.current.handleRefresh();
    });
    await act(async () => {
      pending.reject(new Error("network"));
      await pending.promise.catch(() => undefined);
    });
    expect(result.current.isRefreshing).toBe(false);
  });

  it("does not send a second request while one is running", async () => {
    const pending = deferred();
    const refresh = jest.fn(() => pending.promise);
    const { result } = renderHook(() => usePullToRefresh(refresh));

    act(() => {
      result.current.handleRefresh();
      result.current.handleRefresh();
    });
    act(() => {
      result.current.handleRefresh();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await act(async () => {
      result.current.handleRefresh();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("uses the latest refresh function", async () => {
    const first = jest.fn(() => Promise.resolve());
    const second = jest.fn(() => Promise.resolve());
    const { result, rerender } = renderHook(
      ({ refresh }: { refresh: () => Promise<void> }) => usePullToRefresh(refresh),
      { initialProps: { refresh: first } },
    );
    rerender({ refresh: second });

    await act(async () => {
      result.current.handleRefresh();
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("finishing a refresh after leaving the screen does not touch the unmounted screen", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const pending = deferred();
    const first = renderHook(() => usePullToRefresh(() => pending.promise));
    act(() => {
      first.result.current.handleRefresh();
    });
    expect(first.result.current.isRefreshing).toBe(true);
    first.unmount();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("starts without a spinner when the screen is opened again", () => {
    const second = renderHook(() => usePullToRefresh(() => Promise.resolve()));
    expect(second.result.current.isRefreshing).toBe(false);
  });
});
