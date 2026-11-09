import * as React from "react";

type PullToRefresh = {
  isRefreshing: boolean;
  handleRefresh: () => void;
};

function usePullToRefresh(refresh: () => Promise<unknown>): PullToRefresh {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const refreshRef = React.useRef(refresh);
  const isInFlightRef = React.useRef(false);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleRefresh = React.useCallback(() => {
    if (isInFlightRef.current) {
      return;
    }
    isInFlightRef.current = true;
    setIsRefreshing(true);

    let task: Promise<unknown>;
    try {
      task = Promise.resolve(refreshRef.current());
    } catch (error: unknown) {
      task = Promise.reject(error);
    }
    task
      .catch(() => undefined)
      .finally(() => {
        isInFlightRef.current = false;
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      });
  }, []);

  return { isRefreshing, handleRefresh };
}

export { usePullToRefresh };
export type { PullToRefresh };
