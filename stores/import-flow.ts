import { create } from "zustand";

type ImportFlowOrigin = "settings" | "home";

type ImportFlowRequest = {
  id: number;
  from: ImportFlowOrigin;
};

type OpenImportFlowOptions = {
  from: ImportFlowOrigin;
};

type ImportFlowState = {
  request: ImportFlowRequest | null;
  openImportFlow: (options: OpenImportFlowOptions) => void;
  closeImportFlow: () => void;
};

let nextRequestId = 1;

const useImportFlowStore = create<ImportFlowState>((set) => ({
  request: null,
  openImportFlow: ({ from }) => {
    const id = nextRequestId;
    nextRequestId += 1;
    set({ request: { id, from } });
  },
  closeImportFlow: () => set({ request: null }),
}));

function openImportFlow(options: OpenImportFlowOptions) {
  useImportFlowStore.getState().openImportFlow(options);
}

function closeImportFlow() {
  useImportFlowStore.getState().closeImportFlow();
}

export { closeImportFlow, openImportFlow, useImportFlowStore };
export type { ImportFlowOrigin, ImportFlowRequest, OpenImportFlowOptions };
