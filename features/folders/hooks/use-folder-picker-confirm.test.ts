import { act, renderHook } from "@testing-library/react-native";

import type { FolderPickerSelection } from "../components/folder-picker-list";
import {
  type FolderPickerConfirmOptions,
  useFolderPickerConfirm,
} from "./use-folder-picker-confirm";

function setup(overrides: Partial<FolderPickerConfirmOptions> = {}) {
  const onConfirm = jest.fn<Promise<void>, [unknown]>(() => Promise.resolve());
  const onOpenChange = jest.fn();
  const props: FolderPickerConfirmOptions = {
    open: true,
    initialFolderId: 3,
    errorMessage: "폴더를 옮기지 못했어요. 다시 시도해 주세요.",
    onConfirm,
    onOpenChange,
    ...overrides,
  };
  const hook = renderHook(
    (current: FolderPickerConfirmOptions) => useFolderPickerConfirm(current),
    {
      initialProps: props,
    },
  );
  return { ...hook, props, onConfirm: props.onConfirm as jest.Mock, onOpenChange };
}

describe("useFolderPickerConfirm", () => {
  it("keeps confirm disabled until a different folder is chosen", () => {
    const { result } = setup();
    expect(result.current.selection?.id).toBe(3);
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.select({ id: 3, label: "같은 폴더" }));
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.select({ id: 7, label: "다른 폴더" }));
    expect(result.current.canConfirm).toBe(true);

    act(() => result.current.select({ id: null, label: "없음" }));
    expect(result.current.canConfirm).toBe(true);
  });

  it("starts with nothing chosen for add, and enables confirm once a folder is picked", () => {
    const { result } = setup({ initialFolderId: undefined });
    expect(result.current.selection).toBeNull();
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.select({ id: 5, label: "내 폴더" }));
    expect(result.current.canConfirm).toBe(true);
  });

  it("confirms once even when pressed twice, then closes", async () => {
    let resolve: () => void = () => {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { result, onOpenChange } = setup({ onConfirm });
    act(() => result.current.select({ id: 7, label: "다른 폴더" }));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.confirm();
      void result.current.confirm();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ id: 7, label: "다른 폴더" });
    expect(result.current.isPending).toBe(true);
    expect(result.current.canConfirm).toBe(false);

    await act(async () => {
      resolve();
      await first;
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays locked after a success while the window closes, and unlocks when it opens again", async () => {
    const onConfirm = jest.fn(() => Promise.resolve());
    const { result, rerender, props } = setup({ onConfirm });
    act(() => result.current.select({ id: 7, label: "다른 폴더" }));
    await act(async () => {
      await result.current.confirm();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(true);
    expect(result.current.canConfirm).toBe(false);

    await act(async () => {
      await result.current.confirm();
    });
    act(() => result.current.select({ id: 9, label: "또 다른 폴더" }));
    act(() => result.current.requestOpenChange(false));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(result.current.selection?.id).toBe(7);

    rerender({ ...props, onConfirm, open: false });
    rerender({ ...props, onConfirm, open: true });
    expect(result.current.isPending).toBe(false);
    act(() => result.current.select({ id: 9, label: "또 다른 폴더" }));
    await act(async () => {
      await result.current.confirm();
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("does not close or change the selection while pending", async () => {
    let resolve: () => void = () => {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { result, onOpenChange } = setup({ onConfirm });
    act(() => result.current.select({ id: 7, label: "다른 폴더" }));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.confirm();
    });

    act(() => result.current.requestOpenChange(false));
    act(() => result.current.select({ id: 9, label: "또 다른 폴더" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(result.current.selection?.id).toBe(7);

    await act(async () => {
      resolve();
      await pending;
    });
  });

  it("shows the error and keeps the selection when confirming fails, and retries", async () => {
    const onConfirm = jest
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const { result, onOpenChange } = setup({ onConfirm });
    act(() => result.current.select({ id: 7, label: "다른 폴더" }));

    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.error).toBe("폴더를 옮기지 못했어요. 다시 시도해 주세요.");
    expect(result.current.selection?.id).toBe(7);
    expect(result.current.canConfirm).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirm();
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancel closes without confirming, and reopening resets the selection and error", async () => {
    const onConfirm = jest.fn().mockRejectedValueOnce(new Error("network"));
    const { result, rerender, props, onOpenChange } = setup({ onConfirm });
    act(() => result.current.select({ id: 7, label: "다른 폴더" }));
    await act(async () => {
      await result.current.confirm();
    });

    act(() => result.current.requestOpenChange(false));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender({ ...props, onConfirm, open: false });
    rerender({ ...props, onConfirm, open: true });
    expect(result.current.selection?.id).toBe(3);
    expect(result.current.error).toBeNull();
    expect(result.current.canConfirm).toBe(false);
  });

  it("works with string ids, such as folder keys of an import proposal", async () => {
    const onConfirm = jest.fn<Promise<void>, [FolderPickerSelection<string>]>(() =>
      Promise.resolve(),
    );
    const onOpenChange = jest.fn();
    const { result } = renderHook(() =>
      useFolderPickerConfirm<string>({
        open: true,
        initialFolderId: "unfiled",
        errorMessage: "옮기지 못했어요.",
        onConfirm,
        onOpenChange,
      }),
    );
    expect(result.current.selection?.id).toBe("unfiled");
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.select({ id: "unfiled", label: "미분류" }));
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.select({ id: "new:2", label: "읽을거리" }));
    expect(result.current.canConfirm).toBe(true);
    await act(async () => {
      await result.current.confirm();
    });
    expect(onConfirm).toHaveBeenCalledWith({ id: "new:2", label: "읽을거리" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
