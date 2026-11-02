import * as React from "react";

import { isSignOutTransition } from "@/lib/session-tokens";
import { useAuthStore } from "@/stores/auth";

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

export { useSignOutEffect };
