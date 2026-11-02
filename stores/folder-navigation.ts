import { DeviceStorage } from "@/lib/device-storage";

import { create } from "zustand";

type FolderSection = "mine" | "shared";
type OpenFolderSection = FolderSection | null;
type FolderSectionSurface = "sidebar" | "mobileTab" | "picker";
type FolderScrollSurface = "sidebar" | "mobileTab";

type PersistedFolderNavigation = {
  isSidebarCollapsed: boolean;
  openSection: Record<FolderSectionSurface, OpenFolderSection>;
};

type FolderNavigationState = PersistedFolderNavigation & {
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  toggleSection: (surface: FolderSectionSurface, section: FolderSection) => void;
  openSectionOn: (surface: FolderSectionSurface, section: FolderSection) => void;
  setSidebarCollapsed: (isSidebarCollapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
};

const FOLDER_NAVIGATION_STORAGE_KEY = "qlink-folder-navigation";
const FOLDER_SECTION_SURFACES: FolderSectionSurface[] = ["sidebar", "mobileTab", "picker"];

const DEFAULT_FOLDER_NAVIGATION: PersistedFolderNavigation = {
  isSidebarCollapsed: false,
  openSection: { sidebar: "mine", mobileTab: "mine", picker: "mine" },
};

const folderScrollOffsets: Record<FolderScrollSurface, Record<FolderSection, number>> = {
  sidebar: { mine: 0, shared: 0 },
  mobileTab: { mine: 0, shared: 0 },
};

function getFolderScrollOffset(surface: FolderScrollSurface, section: FolderSection) {
  return folderScrollOffsets[surface][section];
}

function setFolderScrollOffset(
  surface: FolderScrollSurface,
  section: FolderSection,
  offset: number,
) {
  folderScrollOffsets[surface][section] = Math.max(0, offset);
}

function resetFolderScrollOffsets() {
  for (const surface of Object.keys(folderScrollOffsets) as FolderScrollSurface[]) {
    folderScrollOffsets[surface] = { mine: 0, shared: 0 };
  }
}

function normalizeOpenSection(value: unknown): OpenFolderSection {
  if (value === "mine" || value === "shared" || value === null) {
    return value;
  }
  return "mine";
}

function normalizeFolderNavigation(value: unknown): PersistedFolderNavigation {
  const source = (value && typeof value === "object" ? value : {}) as Partial<
    Record<keyof PersistedFolderNavigation, unknown>
  >;
  const openSource = (
    source.openSection && typeof source.openSection === "object" ? source.openSection : {}
  ) as Partial<Record<FolderSectionSurface, unknown>>;
  const openSection = { ...DEFAULT_FOLDER_NAVIGATION.openSection };
  for (const surface of FOLDER_SECTION_SURFACES) {
    if (surface in openSource) {
      openSection[surface] = normalizeOpenSection(openSource[surface]);
    }
  }
  return {
    isSidebarCollapsed:
      typeof source.isSidebarCollapsed === "boolean"
        ? source.isSidebarCollapsed
        : DEFAULT_FOLDER_NAVIGATION.isSidebarCollapsed,
    openSection,
  };
}

const useFolderNavigation = create<FolderNavigationState>()((set) => ({
  ...DEFAULT_FOLDER_NAVIGATION,
  hasHydrated: false,
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  toggleSection: (surface, section) =>
    set((state) => ({
      openSection: {
        ...state.openSection,
        [surface]: state.openSection[surface] === section ? null : section,
      },
    })),
  openSectionOn: (surface, section) =>
    set((state) =>
      state.openSection[surface] === section
        ? state
        : { openSection: { ...state.openSection, [surface]: section } },
    ),
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));

type PendingUserChanges = {
  isSidebarCollapsed: boolean;
  openSection: Set<FolderSectionSurface>;
};

function readPersistedFolderNavigation(raw: string | null): PersistedFolderNavigation | null {
  if (!raw) {
    return null;
  }
  try {
    return normalizeFolderNavigation(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FOLDER_NAVIGATION };
  }
}

function writeFolderNavigation(state: PersistedFolderNavigation) {
  const persisted: PersistedFolderNavigation = {
    isSidebarCollapsed: state.isSidebarCollapsed,
    openSection: state.openSection,
  };
  void DeviceStorage.setItem(FOLDER_NAVIGATION_STORAGE_KEY, JSON.stringify(persisted));
}

function applyPersistedFolderNavigation(raw: string | null, changes: PendingUserChanges) {
  const stored = readPersistedFolderNavigation(raw);
  if (stored) {
    const current = useFolderNavigation.getState();
    const openSection = { ...stored.openSection };
    for (const surface of changes.openSection) {
      openSection[surface] = current.openSection[surface];
    }
    useFolderNavigation.setState({
      isSidebarCollapsed: changes.isSidebarCollapsed
        ? current.isSidebarCollapsed
        : stored.isSidebarCollapsed,
      openSection,
    });
  }
  useFolderNavigation.setState({ hasHydrated: true });
  if (changes.isSidebarCollapsed || changes.openSection.size > 0) {
    writeFolderNavigation(useFolderNavigation.getState());
  }
}

function startFolderNavigationPersistence() {
  useFolderNavigation.subscribe((state, previous) => {
    if (
      state.isSidebarCollapsed === previous.isSidebarCollapsed &&
      state.openSection === previous.openSection
    ) {
      return;
    }
    writeFolderNavigation(state);
  });
}

function trackUserChanges(changes: PendingUserChanges) {
  return useFolderNavigation.subscribe((state, previous) => {
    if (state.isSidebarCollapsed !== previous.isSidebarCollapsed) {
      changes.isSidebarCollapsed = true;
    }
    for (const surface of FOLDER_SECTION_SURFACES) {
      if (state.openSection[surface] !== previous.openSection[surface]) {
        changes.openSection.add(surface);
      }
    }
  });
}

function hydrateFolderNavigation() {
  const changes: PendingUserChanges = { isSidebarCollapsed: false, openSection: new Set() };
  const stored = DeviceStorage.getItem(FOLDER_NAVIGATION_STORAGE_KEY);
  if (stored instanceof Promise) {
    const stopTracking = trackUserChanges(changes);
    void stored
      .catch(() => null)
      .then((raw) => {
        stopTracking();
        applyPersistedFolderNavigation(raw, changes);
        startFolderNavigationPersistence();
      });
    return;
  }
  applyPersistedFolderNavigation(stored, changes);
  startFolderNavigationPersistence();
}

hydrateFolderNavigation();

export {
  DEFAULT_FOLDER_NAVIGATION,
  FOLDER_NAVIGATION_STORAGE_KEY,
  getFolderScrollOffset,
  normalizeFolderNavigation,
  resetFolderScrollOffsets,
  setFolderScrollOffset,
  useFolderNavigation,
};
export type {
  FolderScrollSurface,
  FolderSection,
  FolderSectionSurface,
  OpenFolderSection,
  PersistedFolderNavigation,
};
