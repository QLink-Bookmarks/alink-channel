import * as React from "react";

import { isJustImported } from "../lib/import-status-copy";
import type { ImportSummary } from "../types";

const EMPTY_IDS: ReadonlySet<number> = new Set();
const shownImportIds = new Set<number>();

function takeJustImportedIds(
  summaries: Pick<ImportSummary, "id" | "createdAt">[],
  shown: Set<number>,
  now: Date,
) {
  const fresh: number[] = [];
  for (const summary of summaries) {
    if (shown.has(summary.id)) {
      continue;
    }
    shown.add(summary.id);
    if (isJustImported(summary.createdAt, now)) {
      fresh.push(summary.id);
    }
  }
  return fresh;
}

function resetShownImportIds() {
  shownImportIds.clear();
}

function useJustImportedIds(summaries: ImportSummary[] | undefined): ReadonlySet<number> {
  const [ids, setIds] = React.useState<ReadonlySet<number>>(EMPTY_IDS);

  React.useLayoutEffect(() => {
    if (!summaries) {
      return;
    }
    const fresh = takeJustImportedIds(summaries, shownImportIds, new Date());
    if (fresh.length > 0) {
      setIds((previous) => new Set([...previous, ...fresh]));
    }
  }, [summaries]);

  return ids;
}

export { resetShownImportIds, takeJustImportedIds, useJustImportedIds };
