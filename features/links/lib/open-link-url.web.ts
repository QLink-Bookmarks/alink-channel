/** Opens a saved link's original page in a new tab, without giving it access to this one. */
function openLinkUrl(url: string) {
  globalThis.open?.(url, "_blank", "noopener,noreferrer");
}

export { openLinkUrl };
