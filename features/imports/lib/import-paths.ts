const IMPORTS_PATH = "/settings/imports";

function getImportDetailPath(id: number | string) {
  return `${IMPORTS_PATH}/${encodeURIComponent(String(id))}`;
}

export { IMPORTS_PATH, getImportDetailPath };
