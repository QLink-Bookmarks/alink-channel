const mockMemory = new Map<string, string>();
const mockAsyncRead: { enabled: boolean; release: () => void } = {
  enabled: false,
  release: () => {},
};

jest.mock("@/lib/device-storage", () => ({
  DeviceStorage: {
    getItem: (name: string) => {
      if (!mockAsyncRead.enabled) {
        return mockMemory.get(name) ?? null;
      }
      return new Promise<string | null>((resolve) => {
        mockAsyncRead.release = () => resolve(mockMemory.get(name) ?? null);
      });
    },
    setItem: (name: string, value: string) => {
      mockMemory.set(name, value);
    },
    removeItem: (name: string) => {
      mockMemory.delete(name);
    },
  },
}));

type StoreModule = typeof import("./link-card-size");

async function loadStore(stored?: string, options = { asyncRead: false }): Promise<StoreModule> {
  mockAsyncRead.enabled = options.asyncRead;
  mockMemory.clear();
  if (stored != null) {
    mockMemory.set("qlink-link-card-size", stored);
  }
  let loaded: StoreModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<StoreModule>("./link-card-size");
  });
  return loaded as StoreModule;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("link card size store", () => {
  it("starts with nothing picked and writes nothing", async () => {
    const { useLinkCardSizeStore } = await loadStore();
    const state = useLinkCardSizeStore.getState();
    expect(state.hasHydrated).toBe(true);
    expect(state.linkCardSize).toBeNull();
    expect(mockMemory.size).toBe(0);
  });

  it("writes the picked size to device storage", async () => {
    const { useLinkCardSizeStore } = await loadStore();
    useLinkCardSizeStore.getState().setLinkCardSize("small");
    expect(mockMemory.get("qlink-link-card-size")).toBe("small");
    useLinkCardSizeStore.getState().setLinkCardSize("large");
    expect(mockMemory.get("qlink-link-card-size")).toBe("large");
  });

  it("restores a stored size on start", async () => {
    const { useLinkCardSizeStore } = await loadStore("small");
    expect(useLinkCardSizeStore.getState().linkCardSize).toBe("small");
  });

  it("treats an invalid stored value as nothing picked", async () => {
    for (const stored of ["medium", "", '"small"', "LARGE"]) {
      const { useLinkCardSizeStore } = await loadStore(stored);
      expect(useLinkCardSizeStore.getState().linkCardSize).toBeNull();
    }
  });

  it("applies the stored size after an async read when nothing was picked meanwhile", async () => {
    const { useLinkCardSizeStore } = await loadStore("small", { asyncRead: true });
    expect(useLinkCardSizeStore.getState().hasHydrated).toBe(false);
    mockAsyncRead.release();
    await flush();
    expect(useLinkCardSizeStore.getState()).toMatchObject({
      hasHydrated: true,
      linkCardSize: "small",
    });
  });

  it("keeps a size picked during an async read and stores it", async () => {
    const { useLinkCardSizeStore } = await loadStore("small", { asyncRead: true });
    useLinkCardSizeStore.getState().setLinkCardSize("large");
    mockAsyncRead.release();
    await flush();
    expect(useLinkCardSizeStore.getState().linkCardSize).toBe("large");
    expect(mockMemory.get("qlink-link-card-size")).toBe("large");
  });
});
