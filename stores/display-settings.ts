import type {
  AiProviderType,
  GetMySettingsResponseData,
  UserDefaultModel,
  UserDefaultProvider,
} from "@/features/account/types";
import { SessionStorage } from "@/lib/session-storage";
import { type AccentName, DEFAULT_ACCENT, type ThemeMode } from "@/lib/theme";
import { ACCENT_VALUES, SETTINGS_STORAGE_KEY } from "@/lib/theme-storage";

import { create } from "zustand";

const THEME_VALUES: ThemeMode[] = ["light", "dark"];

function normalizeAccent(value: unknown): AccentName {
  return ACCENT_VALUES.includes(value as AccentName) ? (value as AccentName) : DEFAULT_ACCENT;
}

function normalizeTheme(value: unknown): ThemeMode {
  return THEME_VALUES.includes(value as ThemeMode) ? (value as ThemeMode) : "light";
}

type PersistedSettings = {
  display: { theme: ThemeMode; accent: AccentName };
  behavior: { allowsReminderNotification: boolean };
  ai: { defaultProvider: UserDefaultProvider; defaultModel: UserDefaultModel };
  profile: { avatarEmoji: string | null };
};

type SettingsState = PersistedSettings & {
  hasHydratedFromServer: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setAccent: (accent: AccentName) => void;
  setAllowsReminderNotification: (next: boolean) => void;
  setDefaultProvider: (provider: UserDefaultProvider) => void;
  setDefaultModel: (model: UserDefaultModel) => void;
  setAvatarEmoji: (emoji: string | null) => void;
  hydrateFromServer: (payload: GetMySettingsResponseData) => void;
};

const DEFAULT_SETTINGS: PersistedSettings = {
  display: { theme: "light", accent: DEFAULT_ACCENT },
  behavior: { allowsReminderNotification: true },
  ai: {
    defaultProvider: { id: null, type: null },
    defaultModel: { id: null, model: null },
  },
  profile: { avatarEmoji: null },
};

const useDisplaySettings = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  hasHydratedFromServer: false,

  setTheme: (theme) =>
    set((state) => ({
      display: { ...state.display, theme },
    })),
  toggleTheme: () =>
    set((state) => ({
      display: {
        ...state.display,
        theme: state.display.theme === "light" ? "dark" : "light",
      },
    })),
  setAccent: (accent) =>
    set((state) => ({
      display: { ...state.display, accent },
    })),
  setAllowsReminderNotification: (next) =>
    set((state) => ({
      behavior: { ...state.behavior, allowsReminderNotification: next },
    })),
  setDefaultProvider: (provider) =>
    set((state) => ({
      ai: { ...state.ai, defaultProvider: provider },
    })),
  setDefaultModel: (model) =>
    set((state) => ({
      ai: { ...state.ai, defaultModel: model },
    })),
  setAvatarEmoji: (emoji) =>
    set((state) => ({
      profile: { ...state.profile, avatarEmoji: emoji },
    })),
  hydrateFromServer: (payload) =>
    set({
      display: {
        theme: normalizeTheme(payload.display?.theme),
        accent: normalizeAccent(payload.display?.accent),
      },
      behavior: {
        allowsReminderNotification: Boolean(payload.behavior?.allowsReminderNotification),
      },
      ai: {
        defaultProvider: {
          id: payload.ai?.defaultProvider?.id ?? null,
          type: (payload.ai?.defaultProvider?.type as AiProviderType | null) ?? null,
        },
        defaultModel: {
          id: payload.ai?.defaultModel?.id ?? null,
          model: payload.ai?.defaultModel?.model ?? null,
        },
      },
      hasHydratedFromServer: true,
    }),
}));

// profile.avatarEmoji is per-user (source of truth is the API); never persist it,
// otherwise the override leaks across sessions and to the next signed-in user.
function extractPersisted(state: SettingsState): Omit<PersistedSettings, "profile"> {
  return {
    ai: state.ai,
    behavior: state.behavior,
    display: state.display,
  };
}

async function hydratePersistedSettings() {
  try {
    const raw = await SessionStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    useDisplaySettings.setState({
      display: {
        accent: normalizeAccent(parsed.display?.accent),
        theme: normalizeTheme(parsed.display?.theme),
      },
      behavior: {
        allowsReminderNotification:
          parsed.behavior?.allowsReminderNotification ??
          DEFAULT_SETTINGS.behavior.allowsReminderNotification,
      },
      ai: {
        defaultProvider: {
          id: parsed.ai?.defaultProvider?.id ?? null,
          type: (parsed.ai?.defaultProvider?.type as AiProviderType | null) ?? null,
        },
        defaultModel: {
          id: parsed.ai?.defaultModel?.id ?? null,
          model: parsed.ai?.defaultModel?.model ?? null,
        },
      },
    });
  } catch {
    // ignore — fall back to defaults
  }
}

let previousPersisted: string | null = null;

useDisplaySettings.subscribe((state) => {
  const next = JSON.stringify(extractPersisted(state));
  if (next === previousPersisted) {
    return;
  }
  previousPersisted = next;
  SessionStorage.setItem(SETTINGS_STORAGE_KEY, next);
});

void hydratePersistedSettings();

export { hydratePersistedSettings, useDisplaySettings };
