import type { LinkPreview, LinkPreviewImages } from "../../types";

const EMPTY_LINK_PREVIEW: LinkPreview = {
  title: null,
  thumbnailUrl: null,
  faviconUrl: null,
  isVideo: false,
};

function isPreviewableUrl(value: string): boolean {
  return /^https?:\/\/[^\s/?#]+\S*$/i.test(value.trim());
}

// Keeps at most one image: the main image wins, and the favicon is kept only when
// there is no main image.
function selectLinkPreviewImages(images: {
  thumbnailUrl?: string | null;
  faviconUrl?: string | null;
}): LinkPreviewImages {
  if (images.thumbnailUrl) {
    return { thumbnailUrl: images.thumbnailUrl, faviconUrl: null };
  }
  return { thumbnailUrl: null, faviconUrl: images.faviconUrl || null };
}

function toLinkPreview(data: {
  title?: string | null;
  thumbnailUrl?: string | null;
  faviconUrl?: string | null;
  isVideo?: boolean | null;
}): LinkPreview {
  return {
    title: data.title?.trim() || null,
    isVideo: data.isVideo === true,
    ...selectLinkPreviewImages(data),
  };
}

// The fields the link create and AI requests carry. `LinkPreview` already holds at
// most one image, so the request sends only `thumbnailUrl` or only `faviconUrl`
// (or both null).
function getLinkPreviewRequestFields(preview: LinkPreview | null) {
  const images = selectLinkPreviewImages(preview ?? EMPTY_LINK_PREVIEW);
  return {
    thumbnailUrl: images.thumbnailUrl,
    faviconUrl: images.faviconUrl,
    isVideo: preview?.isVideo ?? false,
  };
}

export {
  EMPTY_LINK_PREVIEW,
  getLinkPreviewRequestFields,
  isPreviewableUrl,
  selectLinkPreviewImages,
  toLinkPreview,
};
