import {
  EMPTY_LINK_PREVIEW,
  getLinkPreviewRequestFields,
  isPreviewableUrl,
  selectLinkPreviewImages,
  toLinkPreview,
} from "./link-preview-result";

const THUMBNAIL = "https://images.archivelink.app/dev-preview-a.jpg";
const FAVICON = "https://images.archivelink.app/dev-favicon-b.png";

function hasAtMostOneImage(images: { thumbnailUrl: string | null; faviconUrl: string | null }) {
  return !(images.thumbnailUrl && images.faviconUrl);
}

describe("selectLinkPreviewImages", () => {
  it.each([
    [
      { thumbnailUrl: THUMBNAIL, faviconUrl: FAVICON },
      { thumbnailUrl: THUMBNAIL, faviconUrl: null },
    ],
    [
      { thumbnailUrl: THUMBNAIL, faviconUrl: null },
      { thumbnailUrl: THUMBNAIL, faviconUrl: null },
    ],
    [
      { thumbnailUrl: null, faviconUrl: FAVICON },
      { thumbnailUrl: null, faviconUrl: FAVICON },
    ],
    [
      { thumbnailUrl: "", faviconUrl: FAVICON },
      { thumbnailUrl: null, faviconUrl: FAVICON },
    ],
    [
      { thumbnailUrl: null, faviconUrl: "" },
      { thumbnailUrl: null, faviconUrl: null },
    ],
    [{}, { thumbnailUrl: null, faviconUrl: null }],
  ])("%j → %j", (input, expected) => {
    const selected = selectLinkPreviewImages(input);
    expect(selected).toEqual(expected);
    expect(hasAtMostOneImage(selected)).toBe(true);
  });
});

describe("toLinkPreview", () => {
  it("keeps only the main image when both images are present", () => {
    expect(
      toLinkPreview({
        title: "Title",
        thumbnailUrl: THUMBNAIL,
        faviconUrl: FAVICON,
        isVideo: true,
      }),
    ).toEqual({ title: "Title", thumbnailUrl: THUMBNAIL, faviconUrl: null, isVideo: true });
  });

  it("trims the title and turns a blank one into null", () => {
    expect(toLinkPreview({ title: "  Title  " }).title).toBe("Title");
    expect(toLinkPreview({ title: "   " }).title).toBeNull();
    expect(toLinkPreview({}).title).toBeNull();
  });

  it("treats anything but true as not a video", () => {
    expect(toLinkPreview({ isVideo: null }).isVideo).toBe(false);
    expect(toLinkPreview({}).isVideo).toBe(false);
  });

  it("maps an empty server response to the empty preview", () => {
    expect(
      toLinkPreview({ title: null, thumbnailUrl: null, faviconUrl: null, isVideo: false }),
    ).toEqual(EMPTY_LINK_PREVIEW);
  });
});

describe("getLinkPreviewRequestFields", () => {
  it("sends only thumbnailUrl when there is a main image", () => {
    expect(
      getLinkPreviewRequestFields({
        title: "t",
        thumbnailUrl: THUMBNAIL,
        faviconUrl: null,
        isVideo: true,
      }),
    ).toEqual({ thumbnailUrl: THUMBNAIL, faviconUrl: null, isVideo: true });
  });

  it("sends only faviconUrl when there is no main image", () => {
    expect(
      getLinkPreviewRequestFields({
        title: null,
        thumbnailUrl: null,
        faviconUrl: FAVICON,
        isVideo: false,
      }),
    ).toEqual({ thumbnailUrl: null, faviconUrl: FAVICON, isVideo: false });
  });

  it("never sends both, even from a value that breaks the type", () => {
    const broken = { title: null, thumbnailUrl: THUMBNAIL, faviconUrl: FAVICON, isVideo: false };
    const fields = getLinkPreviewRequestFields(broken as never);
    expect(fields).toEqual({ thumbnailUrl: THUMBNAIL, faviconUrl: null, isVideo: false });
  });

  it("sends nulls and isVideo false without a preview", () => {
    expect(getLinkPreviewRequestFields(null)).toEqual({
      thumbnailUrl: null,
      faviconUrl: null,
      isVideo: false,
    });
  });
});

describe("isPreviewableUrl", () => {
  it.each([
    ["https://example.com", true],
    ["http://example.com/path?q=1", true],
    ["  https://example.com/a  ", true],
    ["HTTPS://EXAMPLE.COM", true],
    ["example.com", false],
    ["ftp://example.com", false],
    ["https://", false],
    ["https:// example.com", false],
    ["", false],
  ])("%j → %s", (value, expected) => {
    expect(isPreviewableUrl(value)).toBe(expected);
  });
});
