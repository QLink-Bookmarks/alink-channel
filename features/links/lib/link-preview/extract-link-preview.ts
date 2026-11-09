import { storeFavicon, uploadImage } from "@/features/images/api";

import type { LinkPreview } from "../../types";
import { EMPTY_LINK_PREVIEW, toLinkPreview } from "./link-preview-result";
import { type ParsedLinkPreviewHtml, parseLinkPreviewHtml } from "./parse-link-preview-html";
import {
  LINK_PREVIEW_TIME_LIMIT_MS,
  type StoreFavicon,
  type UploadThumbnail,
  runBeforeDeadline,
  storeLinkPreviewImages,
} from "./store-link-preview-images";

// App (iOS/Android) preview extraction: the device reads the page itself, then
// stores the main image (or, failing that, asks the server for the favicon).
// The whole run, favicon request included, is limited to 10 seconds. Nothing here
// throws: failures and timeouts end with whatever was found so far.

type ExtractLinkPreviewOptions = {
  uploadThumbnail?: UploadThumbnail;
  storeFavicon?: StoreFavicon;
  timeLimitMs?: number;
};

async function uploadLinkPreviewThumbnail(file: Parameters<UploadThumbnail>[0]): Promise<string> {
  const response = await uploadImage(file, "LINK_PREVIEW");
  return response.data.url;
}

async function storeLinkFavicon(pageUrl: string): Promise<string> {
  const response = await storeFavicon(pageUrl);
  return response.data.url;
}

async function fetchPageHtml(
  url: string,
  deadlineAt: number,
): Promise<{ html: string; pageUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadlineAt - Date.now()));
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || (contentType && !/html|xml/i.test(contentType))) {
      return null;
    }
    const html = await response.text();
    // `response.url` is the final page after redirects; relative image paths
    // resolve against it.
    return { html, pageUrl: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function extractLinkPreview(
  url: string,
  options: ExtractLinkPreviewOptions = {},
): Promise<LinkPreview> {
  const deadlineAt = Date.now() + (options.timeLimitMs ?? LINK_PREVIEW_TIME_LIMIT_MS);

  let parsed: ParsedLinkPreviewHtml | null = null;
  try {
    const page = await runBeforeDeadline(fetchPageHtml(url, deadlineAt), deadlineAt);
    parsed = page ? parseLinkPreviewHtml(page.html, page.pageUrl) : null;
  } catch {
    // The page could not be read; only the favicon request remains.
  }

  try {
    const images = await storeLinkPreviewImages({
      pageUrl: url,
      thumbnailCandidates: parsed?.thumbnailCandidates ?? [],
      uploadThumbnail: options.uploadThumbnail ?? uploadLinkPreviewThumbnail,
      storeFavicon: options.storeFavicon ?? storeLinkFavicon,
      deadlineAt,
    });
    return toLinkPreview({ ...images, title: parsed?.title, isVideo: parsed?.isVideo });
  } catch {
    return parsed
      ? toLinkPreview({ title: parsed.title, isVideo: parsed.isVideo })
      : EMPTY_LINK_PREVIEW;
  }
}

export { extractLinkPreview };
export type { ExtractLinkPreviewOptions };
