import * as React from "react";

import { useAuthStore } from "@/stores/auth";

type SessionTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

function hasSessionTokens(tokens: SessionTokens) {
  return Boolean(tokens.accessToken || tokens.refreshToken);
}

function isSignOutTransition(next: SessionTokens, previous: SessionTokens) {
  return hasSessionTokens(previous) && !hasSessionTokens(next);
}

function useSignOutEffect(onSignOut: () => void) {
  const onSignOutRef = React.useRef(onSignOut);

  React.useEffect(() => {
    onSignOutRef.current = onSignOut;
  }, [onSignOut]);

  React.useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (isSignOutTransition(state, previous)) {
          onSignOutRef.current();
        }
      }),
    [],
  );
}

export { hasSessionTokens, isSignOutTransition, useSignOutEffect };
export type { SessionTokens };
