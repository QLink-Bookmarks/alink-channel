import { closeImportFlow, openImportFlow, useImportFlowStore } from "./import-flow";

afterEach(() => {
  closeImportFlow();
});

describe("import flow store", () => {
  it("starts with no request", () => {
    expect(useImportFlowStore.getState().request).toBeNull();
  });

  it("records where the flow was opened from", () => {
    openImportFlow({ from: "settings" });

    expect(useImportFlowStore.getState().request).toMatchObject({ from: "settings" });
  });

  it("gives every open a new request id, even from the same place", () => {
    openImportFlow({ from: "home" });
    const first = useImportFlowStore.getState().request;
    openImportFlow({ from: "home" });
    const second = useImportFlowStore.getState().request;

    expect(first?.from).toBe("home");
    expect(second?.from).toBe("home");
    expect(second?.id).not.toBe(first?.id);
  });

  it("clears the request when closed", () => {
    openImportFlow({ from: "home" });
    closeImportFlow();

    expect(useImportFlowStore.getState().request).toBeNull();
  });
});
