class LinkAccessDenied extends Error {}

// Distinguishes "this link doesn't exist" (404 / LINK_404) from a transient
// failure, so the UI can say "찾으시는 링크가 없어요" instead of a retry error.
function isLinkNotFound(error: unknown): boolean {
  if (error instanceof LinkAccessDenied) return true;
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status === 404) {
    return true;
  }
  const code = (response?.data as { error?: { code?: string } } | undefined)?.error?.code;
  return typeof code === "string" && code.startsWith("LINK_404");
}

export { LinkAccessDenied, isLinkNotFound };
