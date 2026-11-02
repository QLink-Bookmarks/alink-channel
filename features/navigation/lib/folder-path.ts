const FOLDER_DETAIL_PATH = /^\/folders\/(\d+)$/;

function getFolderIdFromPath(pathname: string) {
  const match = FOLDER_DETAIL_PATH.exec(pathname);
  return match ? Number(match[1]) : undefined;
}

export { getFolderIdFromPath };
