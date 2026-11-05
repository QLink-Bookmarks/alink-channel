type FolderDeleteTitleInput = {
  name: string;
  emoji?: string | null;
  isShared: boolean;
};

/**
 * Title of the delete confirm, naming the folder so the name to type stays on screen:
 * `{이모지} {폴더 이름} 폴더를 삭제할까요?` (shared: `… 공유 폴더를 삭제할까요?`).
 * The emoji part is left out when the folder has none.
 */
function getFolderDeleteTitle({ name, emoji, isShared }: FolderDeleteTitleInput) {
  const trimmedEmoji = emoji?.trim();
  const label = trimmedEmoji ? `${trimmedEmoji} ${name}` : name;
  return `${label} ${isShared ? "공유 폴더" : "폴더"}를 삭제할까요?`;
}

export { getFolderDeleteTitle };
export type { FolderDeleteTitleInput };
