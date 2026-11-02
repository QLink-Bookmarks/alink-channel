import type { StateStorage } from "zustand/middleware";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const DeviceStorage: StateStorage = {
  getItem(name) {
    try {
      return getStorage()?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      getStorage()?.setItem(name, value);
    } catch {
      return;
    }
  },
  removeItem(name) {
    try {
      getStorage()?.removeItem(name);
    } catch {
      return;
    }
  },
};

export { DeviceStorage };
