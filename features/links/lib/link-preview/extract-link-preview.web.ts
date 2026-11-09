import { getLinkPreview } from "../../api";
import type { LinkPreview } from "../../types";
import { EMPTY_LINK_PREVIEW, toLinkPreview } from "./link-preview-result";

// Web preview extraction: the browser cannot read other sites, so the server
// preview API does it. Its response already holds at most one image (main image,
// or the favicon only when there is none), so the values are used as they are.
// A failed request ends as an empty preview and never blocks saving.

// The server runs its own extraction limits; this only keeps the form from waiting
// forever on a stalled request.
const LINK_PREVIEW_REQUEST_TIMEOUT_MS = 15_000;

type ExtractLinkPreviewOptions = {
  timeLimitMs?: number;
};

async function extractLinkPreview(
  url: string,
  options: ExtractLinkPreviewOptions = {},
): Promise<LinkPreview> {
  try {
    const response = await getLinkPreview(url, {
      timeout: options.timeLimitMs ?? LINK_PREVIEW_REQUEST_TIMEOUT_MS,
    });
    return response.data ? toLinkPreview(response.data) : EMPTY_LINK_PREVIEW;
  } catch {
    return EMPTY_LINK_PREVIEW;
  }
}

export { extractLinkPreview };
export type { ExtractLinkPreviewOptions };
