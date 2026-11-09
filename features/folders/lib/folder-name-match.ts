function normalizeFolderName(value: string) {
  return value.normalize("NFC").trim();
}

/**
 * Whether the typed name confirms the folder name: both NFC-normalized and trimmed, then
 * compared exactly (case-sensitive).
 */
function isFolderNameMatch(typed: string, folderName: string) {
  return normalizeFolderName(typed) === normalizeFolderName(folderName);
}

export { isFolderNameMatch };
