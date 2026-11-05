import * as React from "react";

import { getReversalSuccessMessage } from "../components/reversal/reversal-copy";
import type { ReversalCounts } from "../lib/reversal-selection";

const REVERSAL_STATUS_MS = 6000;

type ReversalStatus = {
  key: number;
  message: string;
};

function useReversalStatus(isFocused: boolean) {
  const [status, setStatus] = React.useState<ReversalStatus | null>(null);
  if (!isFocused && status) {
    setStatus(null);
  }

  React.useEffect(() => {
    if (!status) {
      return;
    }
    const timer = setTimeout(() => setStatus(null), REVERSAL_STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const showReversalStatus = React.useCallback((counts: ReversalCounts) => {
    setStatus((current) => ({
      key: (current?.key ?? 0) + 1,
      message: getReversalSuccessMessage(counts),
    }));
  }, []);

  return { status, showReversalStatus };
}

export { REVERSAL_STATUS_MS, useReversalStatus };
export type { ReversalStatus };
