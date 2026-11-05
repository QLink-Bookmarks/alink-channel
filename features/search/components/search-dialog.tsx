import * as React from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import type { TextInput } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Favicon } from "@/components/ui/favicon";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { getCardSnippet, getDomainFromUrl } from "@/features/home/lib/link-card-mapper";
import { HighlightedText } from "@/features/links/components/snippet-text/highlighted-text";
import { SnippetText } from "@/features/links/components/snippet-text/snippet-text";
import type { LinkListItem } from "@/features/links/types";
import { cn } from "@/lib/utils";
import { useRecentSearches } from "@/stores/recent-searches";

import { useLinkSearchQuery, useWebSearchQuery } from "../queries";
import type { SearchMode, WebSearchResult } from "../types";

import { Clock, Globe, Search } from "lucide-react-native";

type SearchDialogProps = {
  open: boolean;
  mode?: SearchMode;
  initialQuery?: string;
  onOpenChange: (open: boolean) => void;
  onSelectLink: (linkId: number) => void;
};

function openExternalUrl(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// True for a result that matched the page body alone (no metadata field). A response without
// `matchedFields` (before the server ships it) is never one.
function isBodyOnlyMatch(link: LinkListItem) {
  const matchedFields = link.matchedFields ?? [];
  return matchedFields.length > 0 && matchedFields.every((field) => field === "CONTENT");
}

function ResultRow({
  active,
  onPress,
  children,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center gap-3 rounded-xl px-3 py-2.5 web:transition-colors web:hover:bg-accent",
        active && "bg-accent",
      )}
      onPress={onPress}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text className="px-3 text-sm font-semibold text-muted-foreground">{children}</Text>;
}

function SearchDialog({
  open,
  mode = "both",
  initialQuery = "",
  onOpenChange,
  onSelectLink,
}: SearchDialogProps) {
  const includesLink = mode !== "web";
  const includesWeb = mode !== "link";

  const recents = useRecentSearches((state) => state.recents);
  const addRecent = useRecentSearches((state) => state.add);

  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setDebouncedQuery(initialQuery.trim());
      setActiveIndex(-1);
    }
  }, [initialQuery, open]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const hasQuery = debouncedQuery.length > 0;

  const linkSearchQuery = useLinkSearchQuery(debouncedQuery, open && includesLink);
  const webSearchQuery = useWebSearchQuery(debouncedQuery, open && includesWeb);

  const linkResults = React.useMemo<LinkListItem[]>(
    () => (includesLink && hasQuery ? (linkSearchQuery.data?.contents ?? []) : []),
    [hasQuery, includesLink, linkSearchQuery.data?.contents],
  );
  const webResults = React.useMemo<WebSearchResult[]>(
    () => (includesWeb && hasQuery ? (webSearchQuery.data ?? []) : []),
    [hasQuery, includesWeb, webSearchQuery.data],
  );

  // The server puts metadata matches first; a thin line goes before the first body-only match.
  const firstBodyOnlyIndex = React.useMemo(
    () => linkResults.findIndex(isBodyOnlyMatch),
    [linkResults],
  );

  const linkLoading = includesLink && hasQuery && linkSearchQuery.isLoading;
  const webLoading = includesWeb && hasQuery && webSearchQuery.isLoading;

  const handleSelectLink = React.useCallback(
    (link: LinkListItem) => {
      addRecent(debouncedQuery);
      onOpenChange(false);
      onSelectLink(link.id);
    },
    [addRecent, debouncedQuery, onOpenChange, onSelectLink],
  );

  const handleSelectWeb = React.useCallback(
    (result: WebSearchResult) => {
      addRecent(debouncedQuery);
      onOpenChange(false);
      openExternalUrl(result.url);
    },
    [addRecent, debouncedQuery, onOpenChange],
  );

  const handleSelectRecent = React.useCallback((term: string) => {
    setQuery(term);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, []);

  const activations = React.useMemo<(() => void)[]>(() => {
    if (!hasQuery) {
      return recents.map((term) => () => handleSelectRecent(term));
    }
    return [
      ...linkResults.map((link) => () => handleSelectLink(link)),
      ...webResults.map((result) => () => handleSelectWeb(result)),
    ];
  }, [
    handleSelectLink,
    handleSelectRecent,
    handleSelectWeb,
    hasQuery,
    linkResults,
    recents,
    webResults,
  ]);

  const activationsRef = React.useRef(activations);
  activationsRef.current = activations;
  const activeIndexRef = React.useRef(activeIndex);
  React.useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery, mode]);

  React.useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      // Keys that confirm a Hangul syllable are not navigation. Safari ends the composition
      // before the keydown, which then reports keyCode 229 instead of isComposing.
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      const items = activationsRef.current;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(items.length - 1, index + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
      } else if (event.key === "Enter") {
        const activate = items[activeIndexRef.current];
        if (activate) {
          event.preventDefault();
          activate();
        }
      }
    };
    // Capture phase: the focused search input (react-native-web TextInput) stops every
    // keydown from bubbling, so a bubbling listener never sees ↑↓ or Enter.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open]);

  const showEmptyRecents = !hasQuery && recents.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[80vh] w-[500px] max-w-[90vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[90vw]">
        <DialogTitle className="sr-only">검색</DialogTitle>

        <View className="flex-row items-center gap-3 border-b border-border px-5 py-4 pr-12">
          <Icon
            as={Search}
            className="size-5 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            autoFocus
            className="h-auto flex-1 border-0 bg-transparent px-0 text-base shadow-none"
            placeholder="링크 · 요약 · 태그 · 폴더 검색…"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView
          className="max-h-[60vh]"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-4 p-3">
            {!hasQuery ? (
              showEmptyRecents ? (
                <EmptyState
                  emoji="👀"
                  title="최신 검색어가 없어요"
                />
              ) : (
                <View className="gap-1">
                  <SectionHeader>최근 검색어</SectionHeader>
                  {recents.map((term, index) => (
                    <ResultRow
                      key={term}
                      active={index === activeIndex}
                      onPress={() => handleSelectRecent(term)}
                    >
                      <Icon
                        as={Clock}
                        className="size-4 text-muted-foreground"
                      />
                      <Text className="flex-1 text-base text-foreground">{term}</Text>
                    </ResultRow>
                  ))}
                </View>
              )
            ) : (
              <>
                {includesLink ? (
                  <View className="gap-1">
                    <SectionHeader>📌 링크 ({linkResults.length})</SectionHeader>
                    {linkLoading ? (
                      <ActivityIndicator
                        size="small"
                        className="py-4"
                      />
                    ) : linkResults.length === 0 ? (
                      <EmptyState
                        title="최신 검색어가 없어요"
                        className="px-6 py-6"
                      />
                    ) : (
                      linkResults.map((link, index) => {
                        const domain = getDomainFromUrl(link.url);
                        // Context only for a body match whose title did not match.
                        const snippet = getCardSnippet(link);
                        return (
                          <React.Fragment key={link.id}>
                            {index > 0 && index === firstBodyOnlyIndex ? (
                              <View
                                className="mx-3 my-1 border-t border-border-soft"
                                testID="search-link-group-divider"
                              />
                            ) : null}
                            <ResultRow
                              active={index === activeIndex}
                              onPress={() => handleSelectLink(link)}
                              testID="search-link-result"
                            >
                              <Favicon
                                size="sm"
                                shape="circle"
                                url={link.faviconUrl ?? undefined}
                                fallback={domain.slice(0, 1).toUpperCase()}
                              />
                              <View className="flex-1 gap-0.5">
                                <Text
                                  numberOfLines={1}
                                  className="text-sm text-foreground"
                                  testID="search-link-title"
                                >
                                  <Text className="text-muted-foreground">{domain} — </Text>
                                  <HighlightedText
                                    text={link.title}
                                    query={debouncedQuery}
                                  />
                                </Text>
                                {snippet ? (
                                  <SnippetText
                                    text={snippet.text}
                                    highlights={snippet.highlights}
                                    numberOfLines={1}
                                    className="text-xs text-muted-foreground"
                                    testID="search-link-snippet"
                                  />
                                ) : null}
                              </View>
                            </ResultRow>
                          </React.Fragment>
                        );
                      })
                    )}
                  </View>
                ) : null}

                {includesWeb ? (
                  <View className="gap-1">
                    <SectionHeader>🌐 웹</SectionHeader>
                    {webLoading ? (
                      <ActivityIndicator
                        size="small"
                        className="py-4"
                      />
                    ) : webResults.length === 0 ? (
                      <EmptyState
                        title="최신 검색어가 없어요"
                        className="px-6 py-6"
                      />
                    ) : (
                      webResults.map((result, index) => (
                        <ResultRow
                          key={result.id}
                          active={index + linkResults.length === activeIndex}
                          onPress={() => handleSelectWeb(result)}
                        >
                          <View className="size-6 items-center justify-center rounded-full border border-border-soft bg-muted">
                            <Icon
                              as={Globe}
                              className="size-3.5 text-muted-foreground"
                            />
                          </View>
                          <View className="flex-1">
                            <HighlightedText
                              text={result.title}
                              query={debouncedQuery}
                              className="text-sm text-foreground"
                            />
                            <Text
                              numberOfLines={1}
                              className="text-xs text-muted-foreground"
                            >
                              {result.displayUrl}
                            </Text>
                          </View>
                        </ResultRow>
                      ))
                    )}
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>

        <View className="flex-row items-center gap-4 border-t border-border px-5 py-3">
          <View className="flex-row items-center gap-2">
            <Kbd size="sm">↑↓</Kbd>
            <Text className="text-xs text-muted-foreground">이동</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Kbd size="sm">Enter</Kbd>
            <Text className="text-xs text-muted-foreground">열기</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Kbd size="sm">Esc</Kbd>
            <Text className="text-xs text-muted-foreground">닫기</Text>
          </View>
        </View>
      </DialogContent>
    </Dialog>
  );
}

export { SearchDialog };
