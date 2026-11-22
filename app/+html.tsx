import * as React from "react";

import { ACCENT_VALUES, SETTINGS_STORAGE_KEY } from "@/lib/theme-storage";

import { ScrollViewStyleReset } from "expo-router/html";

const STORED_THEME_SCRIPT = `(function () {
  try {
    var raw = window.sessionStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)});
    if (!raw) return;
    var display = JSON.parse(raw).display || {};
    var root = document.documentElement;
    if (display.theme === "dark") root.classList.add("dark");
    if (${JSON.stringify(ACCENT_VALUES)}.indexOf(display.accent) !== -1) {
      root.setAttribute("data-accent", display.accent);
    }
  } catch (error) {}
})();`;

export default function Root({ children }: { children: React.ReactNode }) {
  // OG tags must be absolute URLs (KakaoTalk/Facebook won't resolve relative
  // paths). The image filename is versioned so social/CDN caches fetch fresh
  // instead of serving the previously-cached bytes at the same URL.
  const webHost = process.env.EXPO_PUBLIC_WEB_APP_HOST || "dev.archivelink.app";
  const siteUrl = `https://${webHost}/`;
  const ogImage = `https://${webHost}/og-image-v2.png`;
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta
          httpEquiv="X-UA-Compatible"
          content="IE=edge"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <script dangerouslySetInnerHTML={{ __html: STORED_THEME_SCRIPT }} />
        <title>에이링크 ALink — AI가 도와주는 북마크 아카이브</title>
        <meta
          name="description"
          content="저장은 간편하게, 정리는 스마트하게 🧐 AI가 도와주는 북마크 아카이브"
        />
        <meta
          name="theme-color"
          content="#6B7280"
        />
        {/* Safari's own banner: "열기" when the app is installed, "받기" when it is not. */}
        <meta
          name="apple-itunes-app"
          content="app-id=6788230955"
        />
        <meta
          property="og:type"
          content="website"
        />
        <meta
          property="og:url"
          content={siteUrl}
        />
        <meta
          property="og:title"
          content="에이링크 ALink — AI가 도와주는 북마크 아카이브"
        />
        <meta
          property="og:description"
          content="저장은 간편하게, 정리는 스마트하게 🧐 AI가 도와주는 북마크 아카이브"
        />
        <meta
          property="og:image"
          content={ogImage}
        />
        <meta
          property="og:image:width"
          content="1200"
        />
        <meta
          property="og:image:height"
          content="630"
        />
        <meta
          name="twitter:card"
          content="summary_large_image"
        />
        <meta
          name="twitter:image"
          content={ogImage}
        />
        <script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.9/kakao.min.js"
          integrity="sha384-JpLApTkB8lPskhVMhT+m5Ln8aHlnS0bsIexhaak0jOhAkMYedQoVghPfSpjNi9K1"
          crossOrigin="anonymous"
        />
        <script
          src="https://accounts.google.com/gsi/client"
          async
        />
        <script
          src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
          async
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
