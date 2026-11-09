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

type StoreModule = typeof import("./folder-navigation");

async function loadStore(stored?: string, options = { asyncRead: false }): Promise<StoreModule> {
  mockAsyncRead.enabled = options.asyncRead;
  mockMemory.clear();
  if (stored != null) {
    mockMemory.set("qlink-folder-navigation", stored);
  }
  let loaded: StoreModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<StoreModule>("./folder-navigation");
  });
  return loaded as StoreModule;
}

describe("folder navigation store", () => {
  it("starts with the sidebar expanded and 내 폴더 open on every surface", async () => {
    const { useFolderNavigation } = await loadStore();
    const state = useFolderNavigation.getState();
    expect(state.hasHydrated).toBe(true);
    expect(state.isSidebarCollapsed).toBe(false);
    expect(state.openSection).toEqual({ sidebar: "mine", mobileTab: "mine", picker: "mine" });
  });

  it("keeps one section open, and closes both when the open one is pressed again", async () => {
    const { useFolderNavigation } = await loadStore();
    const { toggleSection } = useFolderNavigation.getState();

    toggleSection("sidebar", "shared");
    expect(useFolderNavigation.getState().openSection.sidebar).toBe("shared");

    toggleSection("sidebar", "mine");
    expect(useFolderNavigation.getState().openSection.sidebar).toBe("mine");

    toggleSection("sidebar", "mine");
    expect(useFolderNavigation.getState().openSection.sidebar).toBeNull();
  });

  it("remembers each surface separately and writes it to device storage", async () => {
    const { useFolderNavigation } = await loadStore();
    useFolderNavigation.getState().toggleSection("sidebar", "shared");

    const state = useFolderNavigation.getState();
    expect(state.openSection).toEqual({ sidebar: "shared", mobileTab: "mine", picker: "mine" });
    expect(JSON.parse(mockMemory.get("qlink-folder-navigation") ?? "{}")).toEqual({
      isSidebarCollapsed: false,
      openSection: { sidebar: "shared", mobileTab: "mine", picker: "mine" },
    });
  });

  it("restores stored values on start", async () => {
    const { useFolderNavigation } = await loadStore(
      JSON.stringify({
        isSidebarCollapsed: true,
        openSection: { sidebar: null, mobileTab: "shared", picker: "mine" },
      }),
    );
    const state = useFolderNavigation.getState();
    expect(state.isSidebarCollapsed).toBe(true);
    expect(state.openSection).toEqual({ sidebar: null, mobileTab: "shared", picker: "mine" });
  });

  it("falls back to the first-use values for invalid stored data", async () => {
    expect((await loadStore("not json")).useFolderNavigation.getState().openSection.sidebar).toBe(
      "mine",
    );

    const invalid = await loadStore(
      JSON.stringify({ isSidebarCollapsed: "yes", openSection: { sidebar: "all", picker: 3 } }),
    );
    const state = invalid.useFolderNavigation.getState();
    expect(state.isSidebarCollapsed).toBe(false);
    expect(state.openSection).toEqual({ sidebar: "mine", mobileTab: "mine", picker: "mine" });
  });

  it("keeps scroll offsets in memory only", async () => {
    const store = await loadStore();
    store.setFolderScrollOffset("sidebar", "mine", 240);
    expect(store.getFolderScrollOffset("sidebar", "mine")).toBe(240);
    expect(store.getFolderScrollOffset("sidebar", "shared")).toBe(0);
    expect(mockMemory.get("qlink-folder-navigation")).toBeUndefined();
  });

  it("waits for an async read, keeping what the user changed meanwhile and restoring the rest", async () => {
    const stored = JSON.stringify({
      isSidebarCollapsed: true,
      openSection: { sidebar: null, mobileTab: "shared", picker: null },
    });
    const { useFolderNavigation } = await loadStore(stored, { asyncRead: true });
    expect(useFolderNavigation.getState().hasHydrated).toBe(false);

    useFolderNavigation.getState().toggleSection("sidebar", "shared");
    mockAsyncRead.release();
    await Promise.resolve();
    await Promise.resolve();

    const state = useFolderNavigation.getState();
    expect(state.hasHydrated).toBe(true);
    expect(state.openSection).toEqual({ sidebar: "shared", mobileTab: "shared", picker: null });
    expect(state.isSidebarCollapsed).toBe(true);
    expect(JSON.parse(mockMemory.get("qlink-folder-navigation") ?? "{}").openSection.sidebar).toBe(
      "shared",
    );
  });

  it("applies the stored values after an async read when the user changed nothing", async () => {
    const stored = JSON.stringify({
      isSidebarCollapsed: false,
      openSection: { sidebar: "shared", mobileTab: null, picker: "mine" },
    });
    const { useFolderNavigation } = await loadStore(stored, { asyncRead: true });
    mockAsyncRead.release();
    await Promise.resolve();
    await Promise.resolve();

    expect(useFolderNavigation.getState().openSection).toEqual({
      sidebar: "shared",
      mobileTab: null,
      picker: "mine",
    });
  });
});
