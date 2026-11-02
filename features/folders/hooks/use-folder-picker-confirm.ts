import * as React from "react";

import type { FolderPickerSelection } from "../components/folder-picker-list";

type FolderPickerConfirmOptions = {
  open: boolean;
  initialFolderId?: number | null;
  errorMessage: string;
  onConfirm: (selection: FolderPickerSelection) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

function getInitialSelection(initialFolderId?: number | null): FolderPickerSelection | null {
  return initialFolderId === undefined ? null : { id: initialFolderId, label: "" };
}

function useFolderPickerConfirm({
  open,
  initialFolderId,
  errorMessage,
  onConfirm,
  onOpenChange,
}: FolderPickerConfirmOptions) {
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

  const select = React.useCallback((next: FolderPickerSelection) => {
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
