import * as React from "react";
import { ScrollView, View, type ViewStyle } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getNativeThemeVars } from "@/lib/theme-vars";

import { usePublicFolderListQuery, usePublicFolderQuery } from "../public-queries";

import { isAxiosError } from "axios";
import { Link, useIsFocused } from "expo-router";
import { Check, Circle, ExternalLink } from "lucide-react-native";

const DARK_COLOR_SCHEME = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onChange: () => void) {
  if (process.env.EXPO_OS !== "web") return () => {};
  const preference = window.matchMedia(DARK_COLOR_SCHEME);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

function prefersDarkColorScheme() {
  return process.env.EXPO_OS === "web" && window.matchMedia(DARK_COLOR_SCHEME).matches;
}

function isUnavailable(error: unknown) {
  return isAxiosError(error) && error.response?.status === 404;
}

function isWebLink(url: string) {
  try {
    return ["https:", "http:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function PublicFolderMessage({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      className="text-sm text-muted-foreground"
    >
      {children}
    </Text>
  );
}

function PublicFolderList({
  label,
  state,
  children,
}: {
  label: "링크" | "할 일";
  state: {
    isFetching: boolean;
    isPending: boolean;
    isError: boolean;
    isFetchNextPageError: boolean;
    hasNextPage: boolean;
    refetch: () => unknown;
    fetchNextPage: (options: { cancelRefetch: boolean }) => unknown;
  };
  children: React.ReactNode[];
}) {
  const loadMore = () => void state.fetchNextPage({ cancelRefetch: false });
  const object = label === "링크" ? "링크를" : "할 일을";
  const subject = label === "링크" ? "링크가" : "할 일이";
  const message = state.isFetchNextPageError
    ? `다음 ${object} 불러오지 못했어요.`
    : `${object} 불러오지 못했어요.`;

  return (
    <View className="gap-3">
      <Text
        accessibilityRole="header"
        aria-level={2}
        className="text-lg font-semibold"
      >
        {label}
      </Text>
      {children.length ? (
        <View
          accessibilityRole="list"
          className="divide-y divide-border rounded-xl border border-border bg-card"
        >
          {children}
        </View>
      ) : null}
      {state.isFetching ? (
        <PublicFolderMessage>{object} 불러오는 중이에요.</PublicFolderMessage>
      ) : state.isError ? (
        <View className="items-start gap-2">
          <PublicFolderMessage>{message}</PublicFolderMessage>
          <Button
            variant="outline"
            onPress={state.isFetchNextPageError ? loadMore : () => void state.refetch()}
          >
            <Text>{label} 다시 불러오기</Text>
          </Button>
        </View>
      ) : !state.isPending && !children.length ? (
        <PublicFolderMessage>아직 공개한 {subject} 없어요.</PublicFolderMessage>
      ) : null}
      {state.hasNextPage && !state.isError ? (
        <Button
          className="self-start"
          disabled={state.isFetching}
          variant="outline"
          onPress={loadMore}
        >
          <Text>{label} 더 보기</Text>
        </Button>
      ) : null}
    </View>
  );
}

function PublicFolderContent({ publicId }: { publicId: string }) {
  const visit = React.useId();
  const folder = usePublicFolderQuery(publicId, visit);
  const links = usePublicFolderListQuery(publicId, visit, "links", folder.isSuccess);
  const todos = usePublicFolderListQuery(publicId, visit, "todos", folder.isSuccess);

  if ([folder.error, links.error, todos.error].some(isUnavailable)) {
    return <PublicFolderMessage>이 주소로 폴더를 열 수 없어요.</PublicFolderMessage>;
  }
  if (folder.isPending) {
    return <PublicFolderMessage>폴더를 불러오는 중이에요.</PublicFolderMessage>;
  }
  if (folder.isError) {
    return (
      <View className="items-start gap-3">
        <PublicFolderMessage>폴더를 불러오지 못했어요.</PublicFolderMessage>
        <Button
          variant="outline"
          disabled={folder.isFetching}
          onPress={() => void folder.refetch()}
        >
          <Text>다시 시도</Text>
        </Button>
      </View>
    );
  }

  const linkRows = links.data?.pages.flatMap((page) => page.contents) ?? [];
  const todoRows = todos.data?.pages.flatMap((page) => page.contents) ?? [];
  const isEmpty = links.isSuccess && todos.isSuccess && !linkRows.length && !todoRows.length;

  return (
    <>
      <View className="gap-2 border-b border-border pb-5">
        <Text
          accessibilityRole="header"
          aria-level={1}
          className="text-2xl font-semibold"
        >
          {[folder.data.emoji, folder.data.name].filter(Boolean).join(" ")}
        </Text>
        <Text className="text-sm text-muted-foreground">
          읽기 전용 · 주소를 아는 누구나 볼 수 있어요.
        </Text>
      </View>
      {isEmpty ? (
        <PublicFolderMessage>아직 공개한 항목이 없어요.</PublicFolderMessage>
      ) : (
        <>
          <PublicFolderList
            label="링크"
            state={links}
          >
            {linkRows.map(({ title, url }, index) => (
              <View
                key={index}
                role="listitem"
                className="gap-1 p-3"
              >
                {isWebLink(url) ? (
                  <Link
                    className="self-start rounded text-base font-medium text-foreground underline web:[overflow-wrap:anywhere] web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-ring"
                    href={url as `https://${string}` | `http://${string}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {title}{" "}
                    <Icon
                      as={ExternalLink}
                      size={14}
                      className="text-muted-foreground"
                    />
                  </Link>
                ) : (
                  <Text className="text-base font-medium">{title}</Text>
                )}
                <Text
                  selectable
                  className="text-sm text-muted-foreground web:[overflow-wrap:anywhere]"
                >
                  {url}
                </Text>
              </View>
            ))}
          </PublicFolderList>
          <PublicFolderList
            label="할 일"
            state={todos}
          >
            {todoRows.map(({ title, isCompleted }, index) => (
              <View
                key={index}
                role="listitem"
                className="flex-row items-start gap-2 p-3"
              >
                <Icon
                  as={isCompleted ? Check : Circle}
                  size={16}
                  className="mt-0.5 text-muted-foreground"
                />
                <Text className="min-w-0 flex-1 web:[overflow-wrap:anywhere]">{title}</Text>
                <Text className="shrink-0 text-sm text-muted-foreground">
                  {isCompleted ? "완료" : "미완료"}
                </Text>
              </View>
            ))}
          </PublicFolderList>
        </>
      )}
    </>
  );
}

function PublicFolderScreen({ publicId }: { publicId?: string }) {
  const focused = useIsFocused();
  const [restore, setRestore] = React.useState(0);
  const prefersDark = React.useSyncExternalStore(
    subscribeToColorScheme,
    prefersDarkColorScheme,
    () => false,
  );
  const themeVars = React.useMemo(
    () => getNativeThemeVars(prefersDark ? "dark" : "light", "gray"),
    [prefersDark],
  );

  React.useEffect(() => {
    if (process.env.EXPO_OS !== "web" || !focused) return;
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setRestore((current) => current + 1);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [focused]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      style={process.env.EXPO_OS === "web" ? (themeVars as ViewStyle) : undefined}
    >
      <View
        role="main"
        className="mx-auto w-full max-w-3xl gap-6 px-5 py-8 md:px-8 md:py-12"
      >
        {focused && publicId ? (
          <PublicFolderContent
            key={`${publicId}:${restore}`}
            publicId={publicId}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

export { PublicFolderScreen };
