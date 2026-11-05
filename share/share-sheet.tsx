import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import type { AiProviderWithModels } from "@/features/ai/types";
import type { Folder } from "@/features/folders/types";
import {
  getThumbnailCandidatesFromMeta,
  parseLinkPreviewHtml,
} from "@/features/links/lib/link-preview/parse-link-preview-html";
import {
  LINK_PREVIEW_TIME_LIMIT_MS,
  storeLinkPreviewImages,
} from "@/features/links/lib/link-preview/store-link-preview-images";

import {
  createSharedLink,
  extractErrorMessage,
  fetchFolders,
  fetchProviderModels,
  hasAuth,
  requestSharedAiSummary,
  uploadSharedPreviewImage,
} from "./share-api";

import { close, openHostApp } from "expo-share-extension";

type ShareSheetProps = {
  url?: string;
  text?: string;
  preprocessingResults?: unknown;
};

type ModelOption = {
  key: string;
  userProviderId: number;
  modelId: number;
  label: string;
};

type Phase = "loading" | "unauthenticated" | "invalid" | "ready";

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

type FetchedPage = {
  title: string | null;
  thumbnailCandidates: string[];
};

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

// 제공자 단위로만 고르게 한다. 실제 모델/userProviderId는 isMine=true 응답에서만
// 나오므로, priority가 앞서면서 userProviderId가 있는 항목을 기본값으로 붙인다.
function toModelOptions(providers: AiProviderWithModels[]): ModelOption[] {
  return providers.flatMap((provider) => {
    const model = [...provider.models]
      .sort((a, b) => a.priority - b.priority)
      .find((entry) => entry.userProviderId != null);
    if (!model?.userProviderId) {
      return [];
    }
    return [
      {
        key: String(provider.providerId),
        userProviderId: model.userProviderId,
        modelId: model.id,
        label: provider.providerType,
      },
    ];
  });
}

function ShareSheet({ url, text, preprocessingResults }: ShareSheetProps) {
  const sharedUrl = getSharedUrl(url, text, preprocessingResults);
  // Title from the in-page preprocessing if present; otherwise fetch the page
  // <title>. URL is only the last-resort fallback.
  const preprocessedTitle = getSharedTitle(preprocessingResults, "");
  // Main image candidates come from the preprocessing meta tags when there are
  // any; otherwise from the page HTML fetched below.
  const preprocessedMeta = getPreprocessedMeta(preprocessingResults);
  const hasPreprocessedMeta = preprocessedMeta !== null;
  const metaThumbnailCandidates = React.useMemo(
    () => getThumbnailCandidatesFromMeta(preprocessedMeta, sharedUrl),
    [preprocessedMeta, sharedUrl],
  );
  const [fetchedTitle, setFetchedTitle] = React.useState<string | null>(null);
  const fetchedPageRef = React.useRef<Promise<FetchedPage | null> | null>(null);
  const title = preprocessedTitle || fetchedTitle || sharedUrl;

  React.useEffect(() => {
    fetchedPageRef.current = null;
    if ((preprocessedTitle && hasPreprocessedMeta) || !isHttpUrl(sharedUrl)) {
      return;
    }
    let active = true;
    const pagePromise = fetchPage(sharedUrl);
    fetchedPageRef.current = pagePromise;
    void pagePromise.then((page) => {
      if (active && page?.title) {
        setFetchedTitle(page.title);
      }
    });
    return () => {
      active = false;
    };
  }, [hasPreprocessedMeta, preprocessedTitle, sharedUrl]);

  const getThumbnailCandidates = React.useCallback(async () => {
    if (hasPreprocessedMeta) return metaThumbnailCandidates;
    const page = await fetchedPageRef.current;
    return page?.thumbnailCandidates ?? [];
  }, [hasPreprocessedMeta, metaThumbnailCandidates]);

  const [phase, setPhase] = React.useState<Phase>("loading");
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [folderId, setFolderId] = React.useState<number | null>(null);
  const [model, setModel] = React.useState<ModelOption | null>(null);
  const [generateTodo, setGenerateTodo] = React.useState(false);
  const [submitting, setSubmitting] = React.useState<null | "save" | "ai">(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!isHttpUrl(sharedUrl)) {
        if (active) setPhase("invalid");
        return;
      }
      if (!(await hasAuth())) {
        if (active) setPhase("unauthenticated");
        return;
      }
      const [folderList, providerModels] = await Promise.all([
        fetchFolders().catch(() => [] as Folder[]),
        fetchProviderModels().catch(() => [] as AiProviderWithModels[]),
      ]);
      if (!active) return;
      const modelOptions = toModelOptions(providerModels);
      setFolders(folderList);
      setModels(modelOptions);
      setModel(modelOptions[0] ?? null);
      setPhase("ready");
    })();
    return () => {
      active = false;
    };
  }, [sharedUrl]);

  const handleSave = React.useCallback(async () => {
    setErrorMessage(null);
    setSubmitting("save");
    try {
      const thumbnailUrl = await storeSharedThumbnail(sharedUrl, await getThumbnailCandidates());
      await createSharedLink({ url: sharedUrl, title, folderId, thumbnailUrl });
      close();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setSubmitting(null);
    }
  }, [folderId, getThumbnailCandidates, sharedUrl, title]);

  const handleAiSave = React.useCallback(async () => {
    if (!model) {
      setErrorMessage("AI 제공자를 먼저 선택해주세요.");
      return;
    }
    setErrorMessage(null);
    setSubmitting("ai");
    try {
      const thumbnailUrl = await storeSharedThumbnail(sharedUrl, await getThumbnailCandidates());
      await requestSharedAiSummary({
        url: sharedUrl,
        // Drop a URL-shaped title so the AI generates a real one; keep a genuine
        // web/OG title.
        title: isUrlLikeTitle(title, sharedUrl) ? "" : title,
        folderId,
        userProviderId: model.userProviderId,
        modelId: model.modelId,
        generateTodo,
        thumbnailUrl,
      });
      close();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setSubmitting(null);
    }
  }, [folderId, generateTodo, getThumbnailCandidates, model, sharedUrl, title]);

  const handleGoToLogin = React.useCallback(() => {
    // Deep-link straight to /login. An empty path crashes the extension's URL
    // builder ("".split("?") is empty, so pathComponents[0] is out of range),
    // which is why "로그인 하러가기" opened nothing. /login is a real route now.
    openHostApp("login");
    close();
  }, []);

  if (phase === "loading") {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }

  if (phase === "invalid") {
    return (
      <Centered>
        <Text className="text-center text-base font-semibold text-foreground">
          북마크 가능한 웹페이지 url이 아니에요
        </Text>
        <Button
          className="mt-5 h-11 self-center px-6"
          variant="outline"
          onPress={() => close()}
        >
          <Text>닫기</Text>
        </Button>
      </Centered>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <Centered>
        <Text className="text-center text-base font-semibold text-foreground">
          로그인을 먼저 해주세요
        </Text>
        <Button
          className="mt-5 h-11 self-center px-6"
          onPress={handleGoToLogin}
        >
          <Text>로그인 하러가기</Text>
        </Button>
      </Centered>
    );
  }

  const isBusy = submitting !== null;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Text
            className="text-lg font-bold text-foreground"
            numberOfLines={2}
          >
            {title || "링크 저장"}
          </Text>
          <Text
            className="text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {sharedUrl}
          </Text>
        </View>

        <ChipSection label="폴더">
          <Chip
            label="✨ AI 자동 분류"
            selected={folderId === null}
            onPress={() => setFolderId(null)}
          />
          {folders.map((folder) => (
            <Chip
              key={folder.id}
              label={folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name}
              selected={folderId === folder.id}
              onPress={() => setFolderId(folder.id)}
            />
          ))}
        </ChipSection>

        {models.length > 0 ? (
          <ChipSection label="AI 제공자">
            {models.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                selected={model?.key === option.key}
                onPress={() => setModel(option)}
              />
            ))}
          </ChipSection>
        ) : null}

        {models.length > 0 ? (
          <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-sm font-semibold text-foreground">액션 생성</Text>
              <Text className="text-xs leading-4 text-muted-foreground">
                AI 요약 시 링크에 데드라인이 있으면 액션을 자동으로 생성해줘요
              </Text>
            </View>
            <Switch
              checked={generateTodo}
              onCheckedChange={setGenerateTodo}
            />
          </View>
        ) : null}

        {errorMessage ? (
          <Text className="text-center text-sm font-medium text-destructive">{errorMessage}</Text>
        ) : null}

        <View className="flex-row gap-3 pt-1">
          <Button
            className="h-12 flex-1"
            variant="outline"
            disabled={isBusy}
            onPress={handleSave}
          >
            {submitting === "save" ? <ActivityIndicator /> : <Text>저장</Text>}
          </Button>
          <Button
            className="h-12 flex-1"
            variant="gradient"
            disabled={isBusy || models.length === 0}
            onPress={handleAiSave}
          >
            {submitting === "ai" ? <ActivityIndicator /> : <Text>AI 요약 저장</Text>}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-background p-6">{children}</View>
  );
}

function ChipSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-muted-foreground">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View className="flex-row gap-2">{children}</View>
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`rounded-full border px-4 py-2 ${
        selected ? "border-primary bg-primary" : "border-border bg-background"
      }`}
      onPress={onPress}
    >
      <Text
        className={`text-sm font-medium ${selected ? "text-primary-foreground" : "text-foreground"}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export { ShareSheet };
