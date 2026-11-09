import * as React from "react";

import { getLinkQueryKeyRoot } from "@/features/links/queries";
import { useQueryClient } from "@tanstack/react-query";

import type { ImportSummary } from "../types";

type ImportProgressSnapshot = ReadonlyMap<number, number>;

function toProgressSnapshot(summaries: Pick<ImportSummary, "id" | "progress">[]) {
  return new Map(summaries.map((summary) => [summary.id, summary.progress]));
}

function hasFinishedImportProgress(
  previous: ImportProgressSnapshot,
  summaries: Pick<ImportSummary, "id" | "progress">[],
) {
  return summaries.some((summary) => {
    const before = previous.get(summary.id);
    return before !== undefined && before < 1 && summary.progress >= 1;
  });
}

function useImportProgressRefresh(summaries: ImportSummary[] | undefined) {
  const queryClient = useQueryClient();
  const previousRef = React.useRef<ImportProgressSnapshot>(new Map());

  React.useEffect(() => {
    if (!summaries) {
      return;
    }
    const finished = hasFinishedImportProgress(previousRef.current, summaries);
    previousRef.current = toProgressSnapshot(summaries);
    if (finished) {
      void queryClient.invalidateQueries({ queryKey: getLinkQueryKeyRoot() });
    }
  }, [queryClient, summaries]);
}

export { hasFinishedImportProgress, toProgressSnapshot, useImportProgressRefresh };
