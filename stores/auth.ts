import { AppState } from "react-native";

import { SessionStorage } from "@/lib/session-storage";

import {
  type AuthTokens,
  type StartupRefresh,
  keptRefreshToken,
  resolveStartupTokens,
  shouldRewriteStartupRecord,
  toStoredRecord,
} from "./auth-startup";

import { create } from "zustand";

const STORAGE_KEY = "qlink-auth";

type AuthState = AuthTokens & {
  hasHydrated: boolean;
  authenticate: (tokens: { accessToken: string; refreshToken?: string | null }) => void;
  setAccessToken: (accessToken: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  signOut: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hasHydrated: false,
  authenticate: ({ accessToken, refreshToken }) =>
    set({ accessToken, refreshToken: keptRefreshToken(refreshToken ?? null) }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setRefreshToken: (refreshToken) => set({ refreshToken }),
  signOut: () => set({ accessToken: null, refreshToken: null }),
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
}));

async function readStoredTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await SessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthTokens>;
    return {
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
    };
  } catch {
    // ignore corrupt storage
    return null;
  }
}

function writeStoredTokens(tokens: AuthTokens) {
  if (tokens.accessToken || tokens.refreshToken) {
    void SessionStorage.setItem(STORAGE_KEY, JSON.stringify(toStoredRecord(tokens)));
  } else {
    void SessionStorage.removeItem(STORAGE_KEY);
  }
}

let resolveStartupRefresh: (refresh: StartupRefresh) => void = () => {};
const startupRefresh = new Promise<StartupRefresh>((resolve) => {
  resolveStartupRefresh = resolve;
});

function registerStartupRefresh(refresh: StartupRefresh) {
  resolveStartupRefresh(refresh);
}

async function hydrateAuthStore() {
  const stored = await readStoredTokens();
  const tokens = await resolveStartupTokens(stored, startupRefresh);
  if (tokens) {
    useAuthStore.setState({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }
  if (shouldRewriteStartupRecord(stored, tokens)) {
    writeStoredTokens(tokens ?? { accessToken: null, refreshToken: null });
  }
  useAuthStore.setState({ hasHydrated: true });
}

// Re-read the shared keychain and adopt tokens the iOS share extension may have
// refreshed (and rotated) while the app was backgrounded. Without this the app
// keeps its stale in-memory refresh token, which the server already consumed,
// and the next request fails auth. Returns true when new tokens were adopted.
async function syncAuthFromStorage(): Promise<boolean> {
  const stored = await readStoredTokens();
  // A missing/empty record must not clobber a live in-memory session (e.g. a
  // transient keychain miss) — only adopt when the store actually holds tokens.
  if (!stored || !(stored.accessToken || stored.refreshToken)) {
    return false;
  }
  const current = useAuthStore.getState();
  if (current.accessToken === stored.accessToken && current.refreshToken === stored.refreshToken) {
    return false;
  }
  useAuthStore.setState({
    accessToken: stored.accessToken,
    refreshToken: stored.refreshToken,
  });
  return true;
}

let unsubPersist: (() => void) | null = null;

function startAuthPersistence() {
  if (unsubPersist) return;
  unsubPersist = useAuthStore.subscribe((state, previous) => {
    if (
      state.accessToken === previous.accessToken &&
      state.refreshToken === previous.refreshToken
    ) {
      return;
    }
    // On sign-out both tokens are null — delete the keychain entry outright
    // instead of leaving a null-filled record (matches invite/share stores).
    writeStoredTokens(state);
  });
}

let foregroundSyncStarted = false;

function startForegroundAuthSync() {
  if (foregroundSyncStarted || process.env.EXPO_OS === "web") return;
  foregroundSyncStarted = true;
  // On every return to the foreground, pull in whatever the share extension
  // refreshed in the shared keychain so the app never acts on a rotated token.
  AppState.addEventListener("change", (status) => {
    if (status === "active") {
      void syncAuthFromStorage();
    }
  });
}

void hydrateAuthStore().then(() => {
  startAuthPersistence();
  startForegroundAuthSync();
});

function getAccessTokenFromStore() {
  return useAuthStore.getState().accessToken;
}

function getRefreshTokenFromStore() {
  return useAuthStore.getState().refreshToken;
}

export {
  getAccessTokenFromStore,
  getRefreshTokenFromStore,
  registerStartupRefresh,
  syncAuthFromStorage,
  useAuthStore,
};
export type { AuthState };
