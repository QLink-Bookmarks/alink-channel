import { fireEvent, render, screen } from "@testing-library/react-native";

import { LinkThumbnail } from "./link-thumbnail";

const IMAGE = "https://cdn.example/dev-preview-1.png";
const FAVICON = "https://cdn.example/dev-favicon-1.png";

// The test ID lands on expo-image's native view, which receives native events.
function loadImage(testID: string, width: number, height: number) {
  fireEvent(screen.getByTestId(testID), "load", {
    nativeEvent: { cacheType: "none", source: { url: IMAGE, width, height, mediaType: null } },
  });
}

function failImage(testID: string) {
  fireEvent(screen.getByTestId(testID), "error", { nativeEvent: { error: "404" } });
}

function sourceUri(testID: string) {
  const source = screen.getByTestId(testID).props.source;
  return (Array.isArray(source) ? source[0] : source)?.uri;
}

describe("LinkThumbnail", () => {
  it("shows the representative image with a loading state until it loads", () => {
    render(
      <LinkThumbnail
        domain="velog.io"
        thumbnailUrl={IMAGE}
      />,
    );
    expect(sourceUri("link-thumbnail-image")).toBe(IMAGE);
    expect(screen.getByTestId("link-thumbnail-image-loading")).toBeOnTheScreen();

    loadImage("link-thumbnail-image", 1600, 900);
    expect(screen.queryByTestId("link-thumbnail-image-loading")).toBeNull();
    expect(screen.getByTestId("link-thumbnail-image").props.contentFit).toBe("cover");
    expect(screen.queryByText("velog.io")).toBeNull();
  });

  it("shows a bundled image instead of the URL and skips the favicon", () => {
    const bundledImage = 42;
    render(
      <LinkThumbnail
        domain="airbnb.co.kr"
        thumbnailAsset={bundledImage}
        faviconUrl={FAVICON}
      />,
    );
    // expo-image resolves a bundled module to a packager asset rather than a plain `{ uri }`.
    const source = screen.getByTestId("link-thumbnail-image").props.source;
    expect((Array.isArray(source) ? source[0] : source)?.__packager_asset).toBe(true);
    expect(screen.queryByTestId("link-thumbnail-favicon")).toBeNull();
    expect(screen.queryByText("airbnb.co.kr")).toBeNull();
  });

  it("falls back to the domain only when the representative image fails", () => {
    render(
      <LinkThumbnail
        domain="brunch.co.kr"
        faviconUrl={FAVICON}
        thumbnailUrl={IMAGE}
      />,
    );
    failImage("link-thumbnail-image");
    expect(screen.queryByTestId("link-thumbnail-image")).toBeNull();
    expect(screen.getByText("brunch.co.kr")).toBeOnTheScreen();
    // The favicon only stands in for links that have no representative image at all.
    expect(screen.queryByTestId("link-thumbnail-favicon")).toBeNull();
  });

  it("shows the stored favicon and the domain when there is no representative image", () => {
    render(
      <LinkThumbnail
        domain="notion.so"
        faviconUrl={FAVICON}
      />,
    );
    expect(sourceUri("link-thumbnail-favicon")).toBe(FAVICON);
    expect(screen.getByText("notion.so")).toBeOnTheScreen();
  });

  it("shows the domain only when the favicon is missing or broken", () => {
    const { rerender } = render(<LinkThumbnail domain="ohou.se" />);
    expect(screen.getByText("ohou.se")).toBeOnTheScreen();
    expect(screen.queryByTestId("link-thumbnail-favicon")).toBeNull();

    rerender(
      <LinkThumbnail
        domain="ohou.se"
        faviconUrl={FAVICON}
      />,
    );
    failImage("link-thumbnail-favicon");
    expect(screen.queryByTestId("link-thumbnail-favicon")).toBeNull();
    expect(screen.getByText("ohou.se")).toBeOnTheScreen();
  });

  it("uses the domain-only fallback for the detail even when a favicon exists", () => {
    render(
      <LinkThumbnail
        domain="notion.so"
        fallback="domain"
        faviconUrl={FAVICON}
      />,
    );
    expect(screen.queryByTestId("link-thumbnail-favicon")).toBeNull();
    expect(screen.getByText("notion.so")).toBeOnTheScreen();
  });

  it("shows the video badge for video links only when asked", () => {
    const { rerender } = render(
      <LinkThumbnail
        domain="youtube.com"
        isVideo
        showVideoBadge
        thumbnailUrl={IMAGE}
      />,
    );
    expect(screen.getByText("영상")).toBeOnTheScreen();

    rerender(
      <LinkThumbnail
        domain="velog.io"
        showVideoBadge
        thumbnailUrl={IMAGE}
      />,
    );
    expect(screen.queryByText("영상")).toBeNull();
  });

  it("puts a play hint on video links and a pointer hint on the rest", () => {
    const { rerender } = render(
      <LinkThumbnail
        domain="youtube.com"
        isVideo
        showHint
        thumbnailUrl={IMAGE}
      />,
    );
    expect(screen.getByTestId("link-thumbnail-hint-play")).toBeOnTheScreen();

    rerender(
      <LinkThumbnail
        domain="notion.so"
        fallback="domain"
        showHint
      />,
    );
    expect(screen.getByTestId("link-thumbnail-hint-open")).toBeOnTheScreen();
  });

  it("fits a portrait image inside the frame when fit is auto", () => {
    render(
      <LinkThumbnail
        domain="instagram.com"
        fit="auto"
        thumbnailUrl={IMAGE}
      />,
    );
    loadImage("link-thumbnail-image", 900, 1600);
    expect(screen.getByTestId("link-thumbnail-image").props.contentFit).toBe("contain");
  });

  it("keeps the frame with a loading state while the caller is still fetching", () => {
    render(
      <LinkThumbnail
        domain="velog.io"
        loading
        thumbnailUrl={IMAGE}
      />,
    );
    expect(screen.getByTestId("link-thumbnail-loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("link-thumbnail-image")).toBeNull();
  });

  it("fills the small cell with the domain's first letter when there is no image", () => {
    render(
      <LinkThumbnail
        domain="notion.so"
        size="small"
      />,
    );
    expect(screen.getByText("N")).toBeOnTheScreen();
  });
});
