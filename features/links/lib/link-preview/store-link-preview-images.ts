import type { NativeImageFile } from "@/features/images/types";

import type { LinkPreviewImages } from "../../types";

import { File, Paths } from "expo-file-system";

// Stores the images of a link preview in our storage before the link is saved.
// The main image comes first: each candidate is downloaded to the cache, checked
// (10MB, JPEG/PNG/GIF/WEBP) and uploaded, and the first one that succeeds becomes
// `thumbnailUrl`. Only when no main image was stored does it ask the server to store
// the page's favicon, which becomes `faviconUrl`. Every step is best effort: a
// failure moves on to the next step and never throws.

type UploadThumbnail = (file: NativeImageFile) => Promise<string>;
type StoreFavicon = (pageUrl: string) => Promise<string>;

type StoreLinkPreviewImagesInput = {
  // The link URL, sent to the server when asking for the favicon.
  pageUrl: string;
  thumbnailCandidates: string[];
  uploadThumbnail: UploadThumbnail;
  // Left out by the share sheet, which never stores favicons.
  storeFavicon?: StoreFavicon;
  // Epoch milliseconds after which nothing more is started or awaited.
  deadlineAt: number;
};

type ImageFormat = {
  extension: "jpg" | "png" | "gif" | "webp";
  mimeType: string;
};

// Total time for one preview run, image uploads and the favicon request included.
const LINK_PREVIEW_TIME_LIMIT_MS = 10_000;
const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;
const NO_IMAGES: LinkPreviewImages = { thumbnailUrl: null, faviconUrl: null };

class DeadlineExceededError extends Error {
  constructor() {
    super("Link preview deadline exceeded");
    this.name = "DeadlineExceededError";
  }
}

// Resolves with `promise` unless the deadline passes first. The work itself keeps
// running; callers clean up after it on their own.
function runBeforeDeadline<T>(promise: Promise<T>, deadlineAt: number): Promise<T> {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) {
    promise.catch(() => {});
    return Promise.reject(new DeadlineExceededError());
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineExceededError()), remaining);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Detects the real image format from the file's first bytes.
function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: "png", mimeType: "image/png" };
  }
  if (startsWith([0x47, 0x49, 0x46, 0x38])) {
    return { extension: "gif", mimeType: "image/gif" };
  }
  // "RIFF" .... "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return { extension: "webp", mimeType: "image/webp" };
  }
  return null;
}

function deleteQuietly(file: File) {
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // The cache is cleared by the system eventually.
  }
}

function readHeaderBytes(file: File): Uint8Array {
  const handle = file.open();
  try {
    return handle.readBytes(12);
  } finally {
    handle.close();
  }
}

async function storeThumbnailCandidate(
  candidateUrl: string,
  uploadThumbnail: UploadThumbnail,
): Promise<string | null> {
  const destination = new File(
    Paths.cache,
    `link-preview-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  try {
    const file = await File.downloadFileAsync(candidateUrl, destination, { idempotent: true });
    if (file.size <= 0 || file.size > MAX_THUMBNAIL_BYTES) {
      return null;
    }
    const format = detectImageFormat(readHeaderBytes(file));
    if (!format) {
      return null;
    }
    return await uploadThumbnail({
      uri: file.uri,
      name: `preview.${format.extension}`,
      type: format.mimeType,
    });
  } finally {
    // Also runs when the caller already gave up on the deadline.
    deleteQuietly(destination);
  }
}

async function storeLinkPreviewImages({
  pageUrl,
  thumbnailCandidates,
  uploadThumbnail,
  storeFavicon,
  deadlineAt,
}: StoreLinkPreviewImagesInput): Promise<LinkPreviewImages> {
  for (const candidateUrl of thumbnailCandidates) {
    if (Date.now() >= deadlineAt) {
      return NO_IMAGES;
    }
    try {
      const thumbnailUrl = await runBeforeDeadline(
        storeThumbnailCandidate(candidateUrl, uploadThumbnail),
        deadlineAt,
      );
      if (thumbnailUrl) {
        return { thumbnailUrl, faviconUrl: null };
      }
    } catch {
      // Download, format or upload failed (or the server rejected the format):
      // try the next candidate.
    }
  }

  if (!storeFavicon || Date.now() >= deadlineAt) {
    return NO_IMAGES;
  }
  try {
    const faviconUrl = await runBeforeDeadline(storeFavicon(pageUrl), deadlineAt);
    return { thumbnailUrl: null, faviconUrl: faviconUrl || null };
  } catch {
    return NO_IMAGES;
  }
}

export { detectImageFormat, LINK_PREVIEW_TIME_LIMIT_MS, runBeforeDeadline, storeLinkPreviewImages };
export type { StoreFavicon, StoreLinkPreviewImagesInput, UploadThumbnail };
