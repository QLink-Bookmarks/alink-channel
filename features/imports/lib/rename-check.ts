import type { Folder } from "@/features/folders/types";

type RenameCheck =
  | { type: "blank" }
  | { type: "same" }
  | { type: "blocked" }
  | { type: "merge-existing"; folderId: number; name: string }
  | { type: "merge-new"; target: string; name: string }
  | { type: "ok"; name: string };

type RenameNewFolder = {
  target: string;
  name: string;
};

type RenameCheckContext = {
  currentTarget: string | null;
  currentName: string | null;
  newFolders: readonly RenameNewFolder[];
  myFolders: readonly Folder[];
  meId: number | null;
};

function normalizeFolderName(name: string) {
  return name.trim().normalize("NFC");
}

function isOwnSharedFolder(folder: Folder, meId: number | null) {
  return folder.isShared && (folder.ownerId == null || meId == null || folder.ownerId === meId);
}

function checkRename(input: string, context: RenameCheckContext): RenameCheck {
  const name = normalizeFolderName(input);
  if (!name) {
    return { type: "blank" };
  }
  if (context.currentName != null && name === normalizeFolderName(context.currentName)) {
    return { type: "same" };
  }
  if (
    context.myFolders.some(
      (folder) =>
        isOwnSharedFolder(folder, context.meId) && normalizeFolderName(folder.name) === name,
    )
  ) {
    return { type: "blocked" };
  }
  const existing = context.myFolders.find(
    (folder) => !folder.isShared && normalizeFolderName(folder.name) === name,
  );
  if (existing) {
    return { type: "merge-existing", folderId: existing.id, name: existing.name };
  }
  const other = context.newFolders.find(
    (folder) =>
      folder.target !== context.currentTarget && normalizeFolderName(folder.name) === name,
  );
  if (other) {
    return { type: "merge-new", target: other.target, name: other.name };
  }
  return { type: "ok", name };
}

export { checkRename, isOwnSharedFolder, normalizeFolderName };
export type { RenameCheck, RenameCheckContext, RenameNewFolder };
