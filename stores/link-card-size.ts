import { type LinkCardSize, normalizeLinkCardSize } from "@/features/links/lib/link-card-size";
import { DeviceStorage } from "@/lib/device-storage";

import { create } from "zustand";

type LinkCardSizeState = {
  /** The size picked on this device; null until one is picked. */
  linkCardSize: LinkCardSize | null;
  hasHydrated: boolean;
  setLinkCardSize: (linkCardSize: LinkCardSize) => void;
};

const LINK_CARD_SIZE_STORAGE_KEY = "qlink-link-card-size";

const useLinkCardSizeStore = create<LinkCardSizeState>()((set) => ({
  linkCardSize: null,
  hasHydrated: false,
  setLinkCardSize: (linkCardSize) => set({ linkCardSize }),
}));

function writeLinkCardSize(linkCardSize: LinkCardSize | null) {
  if (linkCardSize) {
    void DeviceStorage.setItem(LINK_CARD_SIZE_STORAGE_KEY, linkCardSize);
  }
}

function startLinkCardSizePersistence() {
  useLinkCardSizeStore.subscribe((state, previous) => {
    if (state.linkCardSize !== previous.linkCardSize) {
      writeLinkCardSize(state.linkCardSize);
    }
  });
}

function applyPersistedLinkCardSize(raw: string | null, isChangedByUser: boolean) {
  if (isChangedByUser) {
    writeLinkCardSize(useLinkCardSizeStore.getState().linkCardSize);
  } else {
    useLinkCardSizeStore.setState({ linkCardSize: normalizeLinkCardSize(raw) });
  }
  useLinkCardSizeStore.setState({ hasHydrated: true });
}

function hydrateLinkCardSize() {
  const stored = DeviceStorage.getItem(LINK_CARD_SIZE_STORAGE_KEY);
  if (stored instanceof Promise) {
    let isChangedByUser = false;
    const stopTracking = useLinkCardSizeStore.subscribe((state, previous) => {
      if (state.linkCardSize !== previous.linkCardSize) {
        isChangedByUser = true;
      }
    });
    void stored
      .catch(() => null)
      .then((raw) => {
        stopTracking();
        applyPersistedLinkCardSize(raw, isChangedByUser);
        startLinkCardSizePersistence();
      });
    return;
  }
  applyPersistedLinkCardSize(stored, false);
  startLinkCardSizePersistence();
}

hydrateLinkCardSize();

export { LINK_CARD_SIZE_STORAGE_KEY, useLinkCardSizeStore };
