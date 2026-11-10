import * as React from "react";

import { accountQueryKeys } from "@/features/account/queries";
import { useToastStore } from "@/stores/toast-store";
import { useQueryClient } from "@tanstack/react-query";

import type { ConnectOutcome } from "../lib/connect-with-token";

// Shared post-connect side effects: surface a toast at once, then refresh the
// connected-provider list in the background. Used by the connect sheet/dialog
// and the web redirect dispatcher.
function useConnectFeedback() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  return React.useCallback(
    (outcome: ConnectOutcome) => {
      if (outcome.kind === "connected") {
        void queryClient.invalidateQueries({ queryKey: accountQueryKeys.mySettings() });
        showToast({
          title: "계정을 연결했어요.",
          variant: "success",
          sourceKey: "auth-connect",
          dismissible: true,
          durationMs: 3000,
        });
        return;
      }

      const isKnown =
        outcome.reason === "already-connected" || outcome.reason === "linked-to-other-user";
      const title =
        outcome.reason === "linked-to-other-user"
          ? "이미 다른 사용자에 연결된 계정이에요."
          : outcome.reason === "already-connected"
            ? "이미 연결된 계정이에요."
            : "연결에 실패했어요.";
      showToast({
        title,
        description: isKnown ? undefined : "잠시 후 다시 시도해주세요.",
        variant: isKnown ? "warning" : "error",
        sourceKey: "auth-connect",
        dismissible: true,
        durationMs: 3000,
      });
    },
    [queryClient, showToast],
  );
}

export { useConnectFeedback };
