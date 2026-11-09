import * as React from "react";

import { getMyProfile } from "@/features/account/api";
import { accountQueryKeys } from "@/features/account/queries";
import { FOLDER_LIST_SORT, fetchAllFolders, folderQueryKeys } from "@/features/folders/queries";
import type { Folder } from "@/features/folders/types";
import { useQueryClient } from "@tanstack/react-query";

import { type ImportCandidates, buildImportCandidates } from "../lib/build-import-candidates";
import { readBookmarkTree } from "../lib/read-bookmark-tree.web";
import {
  type ImportRange,
  needsRangeSelection,
  selectImportRange,
  splitImportRanges,
} from "../lib/split-import-ranges";
import { useCreateImportPreviewMutation } from "../mutations";
import type { ImportPreview } from "../types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const HTML_FILE_NAME = /\.html?$/i;
const FOLDER_LIST_PARAMS = { ...FOLDER_LIST_SORT, query: undefined };

type UploadError = "type" | "size" | "format";

type ProposalInput = {
  candidates: ImportCandidates;
  preview: ImportPreview;
  myFolders: Folder[];
  meId: number | null;
};

type ImportFlowStep =
  | { name: "closed" }
  | { name: "upload"; error: UploadError | null; fileName?: string }
  | { name: "reading"; fileName: string }
  | { name: "no-links"; fileName: string }
  | { name: "range"; fileName: string; ranges: ImportRange[]; total: number }
  | { name: "preview-loading"; fileName: string; linkCount: number }
  | { name: "preview-error"; fileName: string; linkCount: number }
  | { name: "proposal"; fileName: string; input: ProposalInput };

type ImportFlowFile = Pick<File, "name" | "size"> & Blob;

function getUploadError(file: ImportFlowFile): UploadError | null {
  if (!HTML_FILE_NAME.test(file.name)) {
    return "type";
  }
  return file.size > MAX_FILE_BYTES ? "size" : null;
}

function useImportFlow() {
  const queryClient = useQueryClient();
  const previewMutation = useCreateImportPreviewMutation();
  const [step, setStep] = React.useState<ImportFlowStep>({ name: "closed" });
  const generationRef = React.useRef(0);
  const fileRef = React.useRef<{ fileName: string; candidates: ImportCandidates } | null>(null);
  const selectionRef = React.useRef<ImportCandidates | null>(null);

  const loadMyFolders = React.useCallback(
    () =>
      queryClient
        .fetchQuery({
          queryKey: folderQueryKeys.list(FOLDER_LIST_PARAMS),
          queryFn: () => fetchAllFolders(FOLDER_LIST_PARAMS),
        })
        .then((data) => data.contents),
    [queryClient],
  );

  const loadMeId = React.useCallback(
    () =>
      queryClient
        .ensureQueryData({
          queryKey: accountQueryKeys.myProfile(),
          queryFn: async () => (await getMyProfile()).data,
        })
        .then((profile) => profile?.id ?? null)
        .catch(() => null),
    [queryClient],
  );

  const open = React.useCallback(() => {
    generationRef.current += 1;
    fileRef.current = null;
    selectionRef.current = null;
    setStep({ name: "upload", error: null });
  }, []);

  const close = React.useCallback(() => {
    generationRef.current += 1;
    fileRef.current = null;
    selectionRef.current = null;
    setStep({ name: "closed" });
  }, []);

  const showProposal = React.useCallback(
    async (selection: ImportCandidates, generation: number) => {
      const file = fileRef.current;
      if (!file) {
        return;
      }
      selectionRef.current = selection;
      setStep({
        name: "preview-loading",
        fileName: file.fileName,
        linkCount: selection.links.length,
      });
      try {
        const emptyPreview: ImportPreview = { folders: [], links: [] };
        const [preview, myFolders, meId] = await Promise.all([
          selection.links.length === 0
            ? Promise.resolve(emptyPreview)
            : previewMutation.mutateAsync({
                folders: selection.folders.map(({ key, name }) => ({ key, name })),
                links: selection.links.map(({ key, url }) => ({ key, url })),
              }),
          loadMyFolders(),
          loadMeId(),
        ]);
        if (generation !== generationRef.current) {
          return;
        }
        setStep({
          name: "proposal",
          fileName: file.fileName,
          input: { candidates: selection, preview, myFolders, meId },
        });
      } catch {
        if (generation !== generationRef.current) {
          return;
        }
        setStep({
          name: "preview-error",
          fileName: file.fileName,
          linkCount: selection.links.length,
        });
      }
    },
    [loadMeId, loadMyFolders, previewMutation],
  );

  const selectFile = React.useCallback(
    async (file: ImportFlowFile) => {
      const error = getUploadError(file);
      if (error) {
        setStep({ name: "upload", error, fileName: file.name });
        return;
      }
      generationRef.current += 1;
      const generation = generationRef.current;
      setStep({ name: "reading", fileName: file.name });
      let result: Awaited<ReturnType<typeof readBookmarkTree>>;
      try {
        result = await readBookmarkTree(file);
      } catch {
        result = { kind: "not-bookmark" };
      }
      if (generation !== generationRef.current) {
        return;
      }
      if (result.kind !== "ok") {
        setStep({ name: "upload", error: "format", fileName: file.name });
        return;
      }
      const candidates = buildImportCandidates(result.tree);
      fileRef.current = { fileName: file.name, candidates };
      if (candidates.links.length === 0 && candidates.unsupported.length === 0) {
        setStep({ name: "no-links", fileName: file.name });
        return;
      }
      if (needsRangeSelection(candidates)) {
        setStep({
          name: "range",
          fileName: file.name,
          ranges: splitImportRanges(candidates),
          total: candidates.links.length,
        });
        return;
      }
      await showProposal(candidates, generation);
    },
    [showProposal],
  );

  const previewRange = React.useCallback(
    (range: ImportRange) => {
      const file = fileRef.current;
      if (!file) {
        return;
      }
      void showProposal(selectImportRange(file.candidates, range), generationRef.current);
    },
    [showProposal],
  );

  const retryPreview = React.useCallback(() => {
    const selection = selectionRef.current;
    if (selection) {
      void showProposal(selection, generationRef.current);
    }
  }, [showProposal]);

  const chooseOtherFile = React.useCallback(() => {
    generationRef.current += 1;
    fileRef.current = null;
    selectionRef.current = null;
    setStep({ name: "upload", error: null });
  }, []);

  return { step, open, close, selectFile, previewRange, retryPreview, chooseOtherFile };
}

export { MAX_FILE_BYTES, getUploadError, useImportFlow };
export type { ImportFlowFile, ImportFlowStep, ProposalInput, UploadError };
