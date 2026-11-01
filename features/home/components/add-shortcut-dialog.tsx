import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Emoji } from "@/components/ui/emoji";
import { EmptyState } from "@/components/ui/empty-state";
import { Favicon } from "@/components/ui/favicon";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useSetLinkFavoriteMutation } from "@/features/links/mutations";
import { useLinksQuery } from "@/features/links/queries";
import type { LinkListItem } from "@/features/links/types";
import { useQueryClient } from "@tanstack/react-query";

import { getDomainFromUrl } from "../lib/link-card-mapper";

import { Star } from "lucide-react-native";

function AddShortcutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const linksQuery = useLinksQuery({ isFavorite: false, order: "latest", size: 50 });
  const setFavorite = useSetLinkFavoriteMutation();

  const links = React.useMemo<LinkListItem[]>(
    () => (linksQuery.data?.contents ?? []).filter((link) => !link.isFavorite),
    [linksQuery.data?.contents],
  );

  const handleAdd = React.useCallback(
    (link: LinkListItem) => {
      setFavorite.mutate(
        { linkId: link.id, payload: { isFavorite: true } },
        {
          onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["links"] });
          },
        },
      );
    },
    [queryClient, setFavorite],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[80vh] w-[560px] max-w-[90vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[90vw]">
        <View className="flex-row items-center gap-2 border-b border-border px-5 py-4 pr-12">
          <Emoji className="text-xl">⭐</Emoji>
          <DialogTitle className="text-lg">바로가기 추가</DialogTitle>
        </View>

        <ScrollView
          className="max-h-[60vh]"
          showsVerticalScrollIndicator={false}
        >
          {linksQuery.isLoading ? (
            <ActivityIndicator
              size="large"
              className="py-16"
            />
          ) : links.length === 0 ? (
            <EmptyState
              emoji="🔗"
              title="추가할 링크가 없어요"
              description="저장한 링크를 바로가기로 고정할 수 있어요."
              className="py-12"
            />
          ) : (
            <View>
              {links.map((link) => {
                const domain = getDomainFromUrl(link.url);
                return (
                  <Pressable
                    key={link.id}
                    className="flex-row items-center gap-3 border-b border-border-soft px-5 py-3 active:bg-muted web:transition-colors web:hover:bg-muted"
                    onPress={() => handleAdd(link)}
                  >
                    <Favicon
                      size="lg"
                      url={link.faviconUrl ?? undefined}
                      fallback={domain.slice(0, 1).toUpperCase()}
                    />
                    <View className="min-w-0 flex-1">
                      <Text
                        numberOfLines={1}
                        className="text-base font-semibold text-foreground"
                      >
                        {link.title || domain}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="text-sm text-muted-foreground"
                      >
                        {domain}
                      </Text>
                    </View>
                    <Icon
                      as={Star}
                      className="size-5 text-muted-foreground"
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View className="border-t border-border px-5 py-3">
          <Text className="text-center text-sm text-muted-foreground">
            새 탭에서 한 번에 열 수 있도록 즐겨찾기에 고정합니다 (최대 8개)
          </Text>
        </View>
      </DialogContent>
    </Dialog>
  );
}

export { AddShortcutDialog };
