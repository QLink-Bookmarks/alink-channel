import * as React from "react";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import { usePublicFolderListQuery } from "../public-queries";
import type { PublicFolder } from "../types";

import { isAxiosError } from "axios";
import { Link } from "expo-router";
import { Check, Circle } from "lucide-react-native";

function isUnavailable(error: unknown) {
  return isAxiosError(error) && error.response?.status === 404;
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

function ReadOnlyFolderScreen({
  folder,
  authToken,
}: {
  folder: PublicFolder;
  authToken: string | null;
}) {
  const visit = React.useId();
  const links = usePublicFolderListQuery(folder.id, authToken, visit, "links");
  const todos = usePublicFolderListQuery(folder.id, authToken, visit, "todos");
  if ([links.error, todos.error].some(isUnavailable)) {
    return <PublicFolderMessage>이 주소로 폴더를 열 수 없어요.</PublicFolderMessage>;
  }

  const linkRows = links.data?.pages.flatMap((page) => page.contents) ?? [];
  const todoRows = todos.data?.pages.flatMap((page) => page.contents) ?? [];
  const isEmpty = links.isSuccess && todos.isSuccess && !linkRows.length && !todoRows.length;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View
        role="main"
        className="gap-6 px-6 pb-24 pt-4 md:pb-6 md:pt-5"
      >
        <Text
          role="heading"
          aria-level={1}
          className="text-xl font-bold md:text-3xl"
        >
          {[folder.emoji, folder.name].filter(Boolean).join(" ")}
        </Text>
        {isEmpty ? (
          <PublicFolderMessage>아직 공개한 항목이 없어요.</PublicFolderMessage>
        ) : (
          <>
            <PublicFolderList
              label="링크"
              state={links}
            >
              {linkRows.map(({ id, title, url }) => (
                <View
                  key={id}
                  role="listitem"
                  className="gap-1 p-3"
                >
                  <Link
                    className="self-start rounded text-base font-medium text-foreground underline web:[overflow-wrap:anywhere] web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-ring"
                    href={`/links/${id}`}
                  >
                    {title}
                  </Link>
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
      </View>
    </ScrollView>
  );
}

export { ReadOnlyFolderScreen };
