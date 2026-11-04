import * as React from "react";

import { getImportErrorName } from "../api";
import {
  EMPTY_EXCLUSIONS,
  type ReversalExclusions,
  type ReversalFolderItem,
  buildReversalFolders,
  buildReverseRequest,
  findReversedSince,
  getReversalCounts,
  hasReversibleItems,
  toggleReversalFolder,
  toggleReversalLink,
} from "../lib/reversal-selection";
import { useReverseImportMutation } from "../mutations";
import { useImportReversalPreviewQuery } from "../queries";
import type { ImportReversalPreview, ImportSummary } from "../types";
import { useInvalidateImportedData } from "./use-invalidate-imported-data";

type ReversalErrorKind = "failed" | "folder-shared" | "not-found";

type ReversalError = {
  kind: ReversalErrorKind;
};

type UseReversalSelectionOptions = {
  importId: number;
  enabled: boolean;
  onReversed?: (summary: ImportSummary) => void;
};

function toReversalErrorKind(error: unknown): ReversalErrorKind {
  const name = getImportErrorName(error);
  if (name === "IMPORT_REVERSAL_FOLDER_SHARED") return "folder-shared";
  if (name === "IMPORT_NOT_FOUND") return "not-found";
  return "failed";
}

function useReversalSelection({ importId, enabled, onReversed }: UseReversalSelectionOptions) {
  const previewQuery = useImportReversalPreviewQuery(importId, { enabled });
  const mutation = useReverseImportMutation();
  const invalidateImportedData = useInvalidateImportedData();
  const [initialPreview, setInitialPreview] = React.useState<ImportReversalPreview | undefined>();
  const [exclusions, setExclusions] = React.useState<ReversalExclusions>(EMPTY_EXCLUSIONS);
  const [error, setError] = React.useState<ReversalError | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const pendingRef = React.useRef(false);
  const onReversedRef = React.useRef(onReversed);
  React.useEffect(() => {
    onReversedRef.current = onReversed;
  }, [onReversed]);

  const preview = previewQuery.data;
  React.useEffect(() => {
    if (!initialPreview && preview && !previewQuery.isFetching) {
      setInitialPreview(preview);
    }
  }, [initialPreview, preview, previewQuery.isFetching]);

  const done = React.useMemo(
    () => findReversedSince(initialPreview, preview),
    [initialPreview, preview],
  );
  const folders = React.useMemo(() => buildReversalFolders(preview, done), [done, preview]);
  const counts = React.useMemo(() => getReversalCounts(folders, exclusions), [exclusions, folders]);
  const doneLinkCount = done.linkIds.size;
  const hasRemaining = React.useMemo(() => hasReversibleItems(folders), [folders]);

  const toggleFolder = React.useCallback((folder: ReversalFolderItem) => {
    setExclusions((current) => toggleReversalFolder(folder, current));
  }, []);

  const toggleLink = React.useCallback((folder: ReversalFolderItem, linkId: number) => {
    setExclusions((current) => toggleReversalLink(folder, linkId, current));
  }, []);

  const submit = React.useCallback(async () => {
    if (pendingRef.current) {
      return;
    }
    const payload = buildReverseRequest(folders, exclusions);
    if (payload.linkIds.length === 0 && payload.folderIds.length === 0) {
      return;
    }
    pendingRef.current = true;
    setIsSubmitting(true);
    try {
      const summary = await mutation.mutateAsync({ id: importId, payload });
      setError(null);
      onReversedRef.current?.(summary);
    } catch (reason) {
      setError({ kind: toReversalErrorKind(reason) });
      await invalidateImportedData({ includeTodos: true });
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  }, [exclusions, folders, importId, invalidateImportedData, mutation]);

  return {
    counts,
    doneLinkCount,
    error,
    folders,
    exclusions,
    hasRemaining,
    isSubmitting,
    previewQuery,
    submit,
    toggleFolder,
    toggleLink,
  };
}

export { useReversalSelection };
export type { ReversalError, ReversalErrorKind };
