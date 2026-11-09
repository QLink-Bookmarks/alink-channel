import { parseLinkPreviewHtml } from "@/features/links/lib/link-preview/parse-link-preview-html";
import {
  LINK_PREVIEW_TIME_LIMIT_MS,
  storeLinkPreviewImages,
} from "@/features/links/lib/link-preview/store-link-preview-images";

import { uploadSharedPreviewImage } from "./share-api";

type FetchedPage = {
  title: string | null;
  thumbnailCandidates: string[];
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

// AI summary generates its own title, so a "title" that is really just the URL
// (the last-resort fallback, or an extracted title that happens to be
// URL-shaped) should be dropped — otherwise the AI keeps the URL as the title.
// A real web/OG title is kept so the AI can build on it.
function isUrlLikeTitle(title: string, url: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  const strip = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  if (strip(trimmed) === strip(url)) return true;
  // A bare host (optionally with a path) and no whitespace, e.g.
  // "developer.apple.com" or "developer.apple.com/wwdc".
  if (!/\s/.test(trimmed) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(trimmed)) return true;
  return false;
}

function getMetaTitle(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  for (const key of ["og:title", "twitter:title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getSharedTitle(preprocessingResults: unknown, fallback: string): string {
  if (preprocessingResults && typeof preprocessingResults === "object") {
    const pre = preprocessingResults as { title?: unknown; meta?: unknown };
    // Prefer og:title/twitter:title over document.title. YouTube's mobile SPA
    // leaves document.title as a stale "YouTube" at share time, but the OG tags
    // already carry the real video title.
    const metaTitle = getMetaTitle(pre.meta);
    if (metaTitle) return metaTitle;
    if (typeof pre.title === "string" && pre.title.trim()) return pre.title.trim();
  }
  return fallback;
}

function getSharedUrl(url: string | undefined, text: string | undefined, pre: unknown): string {
  if (url?.trim()) return url.trim();
  if (pre && typeof pre === "object") {
    const preUrl = (pre as { url?: unknown }).url;
    if (typeof preUrl === "string" && preUrl.trim()) return preUrl.trim();
  }
  if (text?.trim()) return text.trim();
  return "";
}

function getSharedDomain(url: string): string {
  const match = /^https?:\/\/([^/?#:]+)/i.exec(url.trim());
  if (!match) return url;
  return match[1].toLowerCase().replace(/^www\./, "");
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g,
    (entity) => HTML_ENTITIES[entity] ?? entity,
  );
}

// Prefer og:title/twitter:title over <title>. Sites like YouTube's mobile web
// (m.youtube.com) serve a static <title> of just "YouTube" and inject the real
// title via client JS, but their OG tags carry it in the server HTML.
function extractTitleFromHtml(html: string): string | null {
  const ogMatch =
    /<meta[^>]+(?:property|name)=["']og:title["'][^>]*>/i.exec(html) ??
    /<meta[^>]+(?:property|name)=["']twitter:title["'][^>]*>/i.exec(html);
  if (ogMatch) {
    const content = /content=(["'])([\s\S]*?)\1/i.exec(ogMatch[0]);
    const ogTitle = content ? decodeHtmlEntities(content[2]).replace(/\s+/g, " ").trim() : "";
    if (ogTitle) return ogTitle;
  }
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : "";
  return title || null;
}

function getPreprocessedMeta(preprocessingResults: unknown): Record<string, unknown> | null {
  if (!preprocessingResults || typeof preprocessingResults !== "object") return null;
  const meta = (preprocessingResults as { meta?: unknown }).meta;
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
}

// Fallback when the share preprocessing didn't surface a title or meta tags (e.g. a
// bare URL shared from a non-browser app): fetch the page and read its OG/<title>
// and main image candidates. Bounded and best-effort — returns null on any failure.
async function fetchPage(url: string): Promise<FetchedPage | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html" },
    });
    clearTimeout(timer);
    const html = await response.text();
    return {
      title: extractTitleFromHtml(html),
      thumbnailCandidates: parseLinkPreviewHtml(html, response.url || url).thumbnailCandidates,
    };
  } catch {
    return null;
  }
}

// Uploads the first main image candidate that works and returns its URL. Never
// throws: without a stored image the link is saved without one. Favicons are not
// handled in the share sheet.
async function storeSharedThumbnail(pageUrl: string, candidates: string[]): Promise<string | null> {
  if (candidates.length === 0) return null;
  try {
    const images = await storeLinkPreviewImages({
      pageUrl,
      thumbnailCandidates: candidates,
      uploadThumbnail: uploadSharedPreviewImage,
      deadlineAt: Date.now() + LINK_PREVIEW_TIME_LIMIT_MS,
    });
    return images.thumbnailUrl;
  } catch {
    return null;
  }
}

export {
  extractTitleFromHtml,
  fetchPage,
  getPreprocessedMeta,
  getSharedDomain,
  getSharedTitle,
  getSharedUrl,
  isHttpUrl,
  isUrlLikeTitle,
  storeSharedThumbnail,
};
export type { FetchedPage };
