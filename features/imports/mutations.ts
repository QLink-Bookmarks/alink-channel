import { useMutation } from "@tanstack/react-query";

import { createImportPreview, reverseImport, startImport } from "./api";
import { useInvalidateImportedData } from "./hooks/use-invalidate-imported-data";
import type {
  CreateImportPreviewRequest,
  ImportSummary,
  ImportSummaryResponse,
  ReverseImportRequest,
  StartImportRequest,
} from "./types";

class ImportSummaryMissingError extends Error {
  constructor() {
    super("IMPORT_SUMMARY_MISSING");
    this.name = "ImportSummaryMissingError";
  }
}

function requireImportSummary(response: ImportSummaryResponse): ImportSummary {
  if (!response?.success || !response.data) {
    throw new ImportSummaryMissingError();
  }
  return response.data;
}

function useCreateImportPreviewMutation() {
  return useMutation({
    mutationFn: async (payload: CreateImportPreviewRequest) => {
      const response = await createImportPreview(payload);
      return response.data;
    },
  });
}

function useStartImportMutation() {
  const invalidateImportedData = useInvalidateImportedData();

  return useMutation({
    mutationFn: async (payload: StartImportRequest) =>
      requireImportSummary(await startImport(payload)),
    onSuccess: () => {
      void invalidateImportedData();
    },
  });
}

function useReverseImportMutation() {
  const invalidateImportedData = useInvalidateImportedData();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ReverseImportRequest }) =>
      requireImportSummary(await reverseImport(id, payload)),
    onSuccess: () => {
      void invalidateImportedData({ includeTodos: true });
    },
  });
}

export {
  ImportSummaryMissingError,
  requireImportSummary,
  useCreateImportPreviewMutation,
  useReverseImportMutation,
  useStartImportMutation,
};
