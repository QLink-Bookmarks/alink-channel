import * as React from "react";

import type { FolderPickerId, FolderPickerSelection } from "../components/folder-picker-list";

type FolderPickerConfirmOptions<Id = FolderPickerId> = {
  open: boolean;
  initialFolderId?: Id;
  errorMessage: string;
  onConfirm: (selection: FolderPickerSelection<Id>) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

function getInitialSelection<Id>(initialFolderId?: Id): FolderPickerSelection<Id> | null {
  return initialFolderId === undefined ? null : { id: initialFolderId, label: "" };
}

function useFolderPickerConfirm<Id = FolderPickerId>({
  open,
  initialFolderId,
  errorMessage,
  onConfirm,
  onOpenChange,
}: FolderPickerConfirmOptions<Id>) {
  const [selection, setSelection] = React.useState(() => getInitialSelection(initialFolderId));
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  const pendingRef = React.useRef(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelection(getInitialSelection(initialFolderId));
      setError(null);
      setIsPending(false);
    }
  }

  React.useEffect(() => {
    if (open) {
      pendingRef.current = false;
    }
  }, [open]);

  const isChanged =
    selection != null && (initialFolderId === undefined || selection.id !== initialFolderId);
  const canConfirm = isChanged && !isPending;

  const select = React.useCallback((next: FolderPickerSelection<Id>) => {
    if (pendingRef.current) {
      return;
    }
    setSelection(next);
    setError(null);
  }, []);

  const requestOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next && pendingRef.current) {
        return;
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const confirm = React.useCallback(async () => {
    if (pendingRef.current || !isChanged || selection == null) {
      return;
    }
    pendingRef.current = true;
    setIsPending(true);
    setError(null);
    try {
      await onConfirm(selection);
      onOpenChange(false);
    } catch {
      pendingRef.current = false;
      setIsPending(false);
      setError(errorMessage);
    }
  }, [errorMessage, isChanged, onConfirm, onOpenChange, selection]);

  return { selection, error, isPending, canConfirm, select, confirm, requestOpenChange };
}

export { useFolderPickerConfirm };
export type { FolderPickerConfirmOptions };
