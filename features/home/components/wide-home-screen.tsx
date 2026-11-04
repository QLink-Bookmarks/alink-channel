import * as React from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";

import { BrandHeader } from "@/components/layout/brand-header";
import { TopbarSearchField } from "@/components/layout/topbar-search-field";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Kbd } from "@/components/ui/kbd";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { useMyProfileQuery } from "@/features/account/queries";
import { HomeEmptyState } from "@/features/imports/components/flow/home-empty-state";
import { LinkCardGrid } from "@/features/links/components/link-card-grid/link-card-grid";
import { ShortcutTile } from "@/features/links/components/shortcut-tile/shortcut-tile";
import { useLinksQuery } from "@/features/links/queries";
import { useNewLinkShortcutLabel } from "@/features/navigation/hooks/use-new-link-shortcut-label";
import { TodoItem } from "@/features/todos/components/todo-item/todo-item";
import { formatReminderLabel, isOverdue } from "@/features/todos/lib/todo-list-helpers";
import { useToggleTodoCompletedMutation } from "@/features/todos/mutations";
import { useTodosQuery } from "@/features/todos/queries";
import type { TodoListItem } from "@/features/todos/types";
import { useGridColumns } from "@/lib/hooks/use-grid-columns";
import { useDisplaySettings } from "@/stores/display-settings";
import { useSearchDialog } from "@/stores/search-dialog";
import { useQueryClient } from "@tanstack/react-query";

import { formatFullDateLabel, getGreetingMessage } from "../lib/greeting";
import { getDomainFromUrl } from "../lib/link-card-mapper";
import { AddShortcutDialog } from "./add-shortcut-dialog";

import { type Href, useRouter } from "expo-router";
import { Search } from "lucide-react-native";

const SEARCH_SCOPES = [
  { label: "🔀 통합", value: "all" },
  { label: "⊕ 내 링크", value: "links" },
  { label: "🌐 웹", value: "web" },
];

const TODO_PREVIEW_COUNT = 6;
const RECENT_PREVIEW_COUNT = 6;
const SHORTCUT_PREVIEW_COUNT = 9;
const TODO_GRID_GAP = 12;
const TODO_MIN_CARD_WIDTH = 240;

function dispatchWideShortcut(key: "search" | "new-link") {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }
  const event =
    key === "search"
      ? new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      : new KeyboardEvent("keydown", { code: "KeyN", key: "n", altKey: true, bubbles: true });
  window.dispatchEvent(event);
}

function SectionHeader({
  emoji,
  title,
  count,
  onSeeAll,
}: {
  emoji: string;
  title: string;
  count?: number;
  onSeeAll?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Text className="text-base font-semibold text-foreground">
          {emoji} {title}
        </Text>
        {count != null ? (
          <Badge variant="secondary">
            <Text className="text-xs">{count}</Text>
          </Badge>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable
          className="active:opacity-60"
          onPress={onSeeAll}
        >
          <Text className="text-sm text-muted-foreground">전체 →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActionPill({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      className="h-9 min-w-20 flex-row items-center justify-center gap-2 rounded-full border border-border bg-card px-4 active:opacity-70 web:transition-colors web:hover:border-primary"
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

function openExternalUrl(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function WideHomeScreen() {
  const router = useRouter();
  const shortcutLabel = useNewLinkShortcutLabel();
  const queryClient = useQueryClient();
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const avatarEmojiOverride = useDisplaySettings((state) => state.profile.avatarEmoji);

  const myProfileQuery = useMyProfileQuery();
  const nickname = myProfileQuery.data?.nickname ?? "사용자";
  const avatarEmoji = avatarEmojiOverride ?? myProfileQuery.data?.avatarEmoji ?? "🌸";

  const now = React.useMemo(() => new Date(), []);
  const greeting = getGreetingMessage(now);
  const dateLabel = formatFullDateLabel(now);
  const nowMs = now.getTime();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchScope, setSearchScope] = React.useState("all");
  const [isAddShortcutOpen, setIsAddShortcutOpen] = React.useState(false);
  const openSearchDialog = useSearchDialog((state) => state.open);

  const handleWideSearch = React.useCallback(() => {
    const query = searchQuery.trim();
    if (searchScope === "web") {
      if (query) {
        openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
        return;
      }
      openSearchDialog({ mode: "web" });
      return;
    }
    openSearchDialog({ mode: searchScope === "links" ? "link" : "both", query });
  }, [openSearchDialog, searchQuery, searchScope]);

  const favoritesQuery = useLinksQuery({ isFavorite: true, size: SHORTCUT_PREVIEW_COUNT });
  const todosQuery = useTodosQuery({ isCompleted: false, size: 30 });
  const recentLinksQuery = useLinksQuery({ order: "latest", size: RECENT_PREVIEW_COUNT });
  const toggleTodo = useToggleTodoCompletedMutation();
  const todoGrid = useGridColumns({ gap: TODO_GRID_GAP, minItemWidth: TODO_MIN_CARD_WIDTH });

  const shortcuts = favoritesQuery.data?.contents ?? [];
  const todos = React.useMemo(() => todosQuery.data?.contents ?? [], [todosQuery.data?.contents]);
  const previewTodos = React.useMemo(() => {
    return [...todos]
      .sort((a, b) => {
        const aTime = a.reminderAt ? new Date(a.reminderAt).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.reminderAt ? new Date(b.reminderAt).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })
      .slice(0, TODO_PREVIEW_COUNT);
  }, [todos]);
  const recentLinks = recentLinksQuery.data?.contents.slice(0, RECENT_PREVIEW_COUNT) ?? [];

  const handleToggleTodo = React.useCallback(
    (todo: TodoListItem, next: boolean) => {
      toggleTodo.mutate(
        { todoId: todo.id, payload: { isCompleted: next } },
        {
          onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["todos"] });
            // Link cards show todo counts, so the link lists change with the todo.
            void queryClient.invalidateQueries({ queryKey: ["links", "list"] });
          },
        },
      );
    },
    [queryClient, toggleTodo],
  );

  if (!recentLinksQuery.isLoading && !recentLinksQuery.isError && recentLinks.length === 0) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow"
        contentInsetAdjustmentBehavior="automatic"
      >
        <HomeEmptyState
          className="flex-1"
          onAddLink={() => dispatchWideShortcut("new-link")}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-[980px] gap-8 self-center px-6 pb-16 pt-24">
        <View className="items-center gap-2">
          <BrandHeader
            accent={accent}
            mode={theme}
            size="2xl"
            align="center"
            className="mb-4 px-0 pt-0"
          />
          <Text className="text-xl font-bold text-foreground">
            안녕 {nickname}, {greeting} {avatarEmoji}
          </Text>
          <Text className="text-sm text-muted-foreground">{dateLabel}</Text>
        </View>

        <View className="items-center gap-4">
          <TopbarSearchField
            className="min-h-12 w-full max-w-[640px]"
            value={searchQuery}
            placeholder="웹 검색 또는 내 링크 검색…"
            leftSlot={
              <Icon
                as={Search}
                className="size-5 text-muted-foreground"
              />
            }
            action={{ label: "검색", onPress: handleWideSearch }}
            onChange={setSearchQuery}
            onSubmit={handleWideSearch}
          />
          <SegmentedControl
            labelClassName="text-sm"
            options={SEARCH_SCOPES}
            selectionMode="single"
            value={searchScope}
            variant="chipsBadge"
            onValueChange={(next) => {
              if (typeof next === "string") {
                setSearchScope(next);
              }
            }}
          />
        </View>

        <View className="flex-row flex-wrap items-start justify-center gap-3">
          {shortcuts.map((link) => (
            <ShortcutTile
              key={link.id}
              label={link.title || getDomainFromUrl(link.url)}
              faviconUrl={link.faviconUrl ?? undefined}
              onPress={() => openExternalUrl(link.url)}
            />
          ))}
          <ShortcutTile
            add
            label="바로가기 추가"
            onPress={() => setIsAddShortcutOpen(true)}
          />
        </View>

        <View className="flex-row flex-wrap items-center justify-center gap-4">
          <ActionPill onPress={() => dispatchWideShortcut("new-link")}>
            <Text className="text-sm font-medium text-foreground">새 링크</Text>
            {shortcutLabel ? <Kbd size="sm">{shortcutLabel}</Kbd> : null}
          </ActionPill>
          <ActionPill onPress={() => router.push("/todos" as Href)}>
            <Text className="text-sm font-medium text-foreground">✅ 할일 {todos.length}</Text>
          </ActionPill>
          <ActionPill onPress={() => router.push("/links" as Href)}>
            <Text className="text-sm font-medium text-foreground">📚 전체 보기</Text>
          </ActionPill>
        </View>

        <View className="gap-3">
          <SectionHeader
            emoji="📌"
            title="오늘 할 일"
            count={todos.length}
            onSeeAll={() => router.push("/todos" as Href)}
          />
          {todosQuery.isLoading ? (
            <ActivityIndicator className="py-8" />
          ) : previewTodos.length === 0 ? (
            <EmptyState
              emoji="🎶"
              title="오늘 할 일이 없어요"
            />
          ) : (
            <View
              className="w-full flex-row flex-wrap"
              style={{ gap: TODO_GRID_GAP }}
              onLayout={todoGrid.onLayout}
            >
              {previewTodos.map((todo) => (
                <View
                  key={todo.id}
                  style={todoGrid.itemStyle}
                >
                  <TodoItem
                    className="grow"
                    variant="display"
                    text={todo.title}
                    done={Boolean(todo.completedAt)}
                    reminderLabel={formatReminderLabel(todo.reminderAt, {
                      withOverdueSuffix: true,
                    })}
                    overdue={isOverdue(todo, nowMs)}
                    linkUrl={todo.linkUrl}
                    linkTitle={todo.linkTitle}
                    linkThumbnailUrl={todo.linkThumbnailUrl}
                    linkFaviconUrl={todo.linkFaviconUrl}
                    onToggle={(next) => handleToggleTodo(todo, next)}
                    onPress={() => router.push(`/links/${todo.linkId}` as Href)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="gap-3">
          <SectionHeader
            emoji="🔖"
            title="최근 저장"
            count={recentLinks.length}
            onSeeAll={() => router.push("/links" as Href)}
          />
          {!recentLinksQuery.isLoading && recentLinks.length === 0 ? (
            <EmptyState
              emoji="⛓️‍💥"
              title="최근 저장 링크가 없어요"
            />
          ) : (
            <LinkCardGrid
              isLoading={recentLinksQuery.isLoading}
              links={recentLinks}
              skeletonCount={RECENT_PREVIEW_COUNT}
              onCardPress={(item) => router.push(`/links/${item.id}` as Href)}
            />
          )}
        </View>
      </View>

      <AddShortcutDialog
        open={isAddShortcutOpen}
        onOpenChange={setIsAddShortcutOpen}
      />
    </ScrollView>
  );
}

export { WideHomeScreen };
