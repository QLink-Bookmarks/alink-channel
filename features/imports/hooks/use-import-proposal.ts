import * as React from "react";

import {
  type ProposalState,
  type ProposalTarget,
  createProposalState,
  getNewTarget,
  getProposalSummary,
  getTargetName,
  isProposalDirty,
  proposalReducer,
} from "../lib/proposal-state";
import { type RenameCheck, checkRename } from "../lib/rename-check";
import type { ProposalInput } from "./use-import-flow";

function initProposal(input: ProposalInput): ProposalState {
  return createProposalState({
    candidates: input.candidates,
    preview: input.preview,
    myFolders: input.myFolders,
  });
}

function useImportProposal(input: ProposalInput) {
  const [state, dispatch] = React.useReducer(proposalReducer, input, initProposal);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const { myFolders, meId } = input;

  const summary = React.useMemo(() => getProposalSummary(state), [state]);
  const isDirty = React.useMemo(() => isProposalDirty(state), [state]);

  const nameOf = React.useCallback(
    (target: ProposalTarget) => getTargetName(stateRef.current, target),
    [],
  );

  const checkName = React.useCallback(
    (target: ProposalTarget | null, name: string): RenameCheck => {
      const current = target
        ? stateRef.current.newFolders.find((folder) => folder.target === target)
        : null;
      return checkRename(name, {
        currentTarget: target,
        currentName: current?.name ?? null,
        newFolders: stateRef.current.newFolders,
        myFolders,
        meId,
      });
    },
    [meId, myFolders],
  );

  const moveLink = React.useCallback((linkKey: string, target: ProposalTarget) => {
    dispatch({
      type: "move",
      linkKey,
      target,
      targetName: getTargetName(stateRef.current, target),
    });
  }, []);

  const removeLink = React.useCallback((linkKey: string) => {
    dispatch({ type: "remove", linkKey });
  }, []);

  const renameNewFolder = React.useCallback(
    (target: ProposalTarget, name: string) => {
      const check = checkName(target, name);
      dispatch({ type: "rename", target, check });
      return check;
    },
    [checkName],
  );

  const addPickerFolder = React.useCallback((name: string) => {
    const target = getNewTarget(`p${stateRef.current.nextPickerIndex}`);
    dispatch({ type: "add-picker-folder", name });
    return target;
  }, []);

  const discardUnusedPickerFolders = React.useCallback(() => {
    dispatch({ type: "discard-unused-picker-folders" });
  }, []);

  const undo = React.useCallback(() => dispatch({ type: "undo" }), []);
  const dismissChange = React.useCallback(() => dispatch({ type: "dismiss-change" }), []);

  return {
    state,
    summary,
    isDirty,
    myFolders,
    meId,
    nameOf,
    checkName,
    moveLink,
    removeLink,
    renameNewFolder,
    addPickerFolder,
    discardUnusedPickerFolders,
    undo,
    dismissChange,
  };
}

type ImportProposal = ReturnType<typeof useImportProposal>;

export { useImportProposal };
export type { ImportProposal };
