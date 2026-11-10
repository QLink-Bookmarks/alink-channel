type AuthTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

type StartupRefresh = () => Promise<string | null>;

export type { AuthTokens, StartupRefresh };
