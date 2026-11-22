import { ScrollView, View } from "react-native";

import { AppHeader } from "@/components/layout/app-header";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ReadOnlyLinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import type { LinkCardSize } from "@/features/links/lib/link-card-size";
import { TodoItem } from "@/features/todos/components/todo-item/todo-item";

import type { usePublicFolderListQuery } from "../public-queries";
import type { PublicFolder } from "../types";

import { useRouter } from "expo-router";

type ListState = Pick<
  ReturnType<typeof usePublicFolderListQuery>,
  | "isFetching"
  | "isPending"
  | "isError"
  | "isFetchNextPageError"
  | "hasNextPage"
  | "refetch"
  | "fetchNextPage"
>;

function FolderListStatus({
  label,
  state,
  hasRows,
}: {
  label: "링크" | "할 일";
  state: ListState;
  hasRows: boolean;
}) {
  const handleLoadMore = () => void state.fetchNextPage({ cancelRefetch: false });
  const object = label === "링크" ? "링크를" : "할 일을";
  const subject = label === "링크" ? "링크가" : "할 일이";
  const message = state.isFetchNextPageError
    ? `다음 ${object} 불러오지 못했어요.`
    : `${object} 불러오지 못했어요.`;

  if (state.isFetching)
    return <Text className="text-sm text-muted-foreground">{object} 불러오는 중이에요.</Text>;
  if (state.isError) {
    return (
      <View className="items-start gap-2">
        <Text className="text-sm text-muted-foreground">{message}</Text>
        <Button
          variant="outline"
          onPress={state.isFetchNextPageError ? handleLoadMore : () => void state.refetch()}
        >
          <Text>{label} 다시 불러오기</Text>
        </Button>
      </View>
    );
  }
  if (!state.isPending && !hasRows) {
    return <Text className="text-sm text-muted-foreground">아직 공개한 {subject} 없어요.</Text>;
  }
  return state.hasNextPage ? (
    <Button
      className="self-start"
      variant="outline"
      onPress={handleLoadMore}
    >
      <Text>{label} 더 보기</Text>
    </Button>
  ) : null;
}

function ReadOnlyFolderScreen({
  folder,
  links,
  todos,
  headerAction,
  linkCardSize,
}: {
  folder: PublicFolder;
  links: ReturnType<typeof usePublicFolderListQuery<"links">>;
  todos: ReturnType<typeof usePublicFolderListQuery<"todos">>;
  headerAction?: React.ReactNode;
  linkCardSize?: LinkCardSize;
}) {
  const router = useRouter();
  const linkRows = links.data?.pages.flatMap((page) => page.contents) ?? [];
  const todoRows = todos.data?.pages.flatMap((page) => page.contents) ?? [];
  const isEmpty = links.isSuccess && todos.isSuccess && !linkRows.length && !todoRows.length;
  const handleBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <AppHeader
        back
        className="md:hidden"
        onBack={handleBack}
        rightSlot={headerAction}
        title={[folder.emoji, folder.name].filter(Boolean).join(" ")}
        titleAccessibilityRole="header"
        titleAlign="start"
      />
      <PageHeader
        title={folder.name}
        emoji={folder.emoji ?? undefined}
        titleAccessibilityRole="header"
      />
      <View
        role="main"
        className="gap-5 px-6 pb-24 pt-4 md:pb-6 md:pt-0"
      >
        {isEmpty ? (
          <Text className="text-sm text-muted-foreground">아직 공개한 항목이 없어요.</Text>
        ) : (
          <>
            <ReadOnlyLinkCardGrid
              links={linkRows}
              size={linkCardSize}
            />
            <FolderListStatus
              label="링크"
              state={links}
              hasRows={linkRows.length > 0}
            />
            {todoRows.length ? (
              <Text className="text-sm font-semibold text-foreground">액션</Text>
            ) : null}
            {todoRows.map(({ linkId, title, isCompleted }, index) => (
              <TodoItem
                key={`${linkId}:${index}`}
                variant="display"
                text={title}
                done={isCompleted}
                readOnly
              />
            ))}
            <FolderListStatus
              label="할 일"
              state={todos}
              hasRows={todoRows.length > 0}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

export { ReadOnlyFolderScreen };
