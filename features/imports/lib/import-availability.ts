function isImportAvailable() {
  return process.env.EXPO_OS === "web";
}

export { isImportAvailable };
