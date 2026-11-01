import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";
import { isLinkNotFound } from "@/features/links/lib/is-link-not-found";
import { useLinkDetailQuery } from "@/features/links/queries";

import { LinkDetailView } from "./link-detail-view";

import { type Href, useRouter } from "expo-router";

function LinkDetailScreen({ linkId }: { linkId?: string }) {
  const router = useRouter();
  const linkDetailQuery = useLinkDetailQuery(linkId);

  if (!linkId) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          description="유효한 링크 ID가 필요하다."
          title="상세 링크를 찾을 수 없음"
        />
      </View>
    );
  }

  if (linkDetailQuery.isLoading) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          description="링크 상세 정보를 불러오는 중이다."
          title="불러오는 중"
        />
      </View>
    );
  }

  // A failed refresh keeps the loaded detail on screen; the view shows the failure itself.
  const isNotFound = linkDetailQuery.isError && isLinkNotFound(linkDetailQuery.error);
  if (isNotFound || !linkDetailQuery.data) {
    if (isNotFound) {
      return (
        <View className="flex-1 bg-background">
          <EmptyState
            className="flex-1"
            emoji="🔍"
            title="찾으시는 링크가 없어요"
            description="이미 삭제됐거나 잘못된 주소일 수 있어요."
            actions={
              <Button
                variant="outline"
                onPress={() => router.replace("/home" as Href)}
              >
                <Text>홈으로</Text>
              </Button>
            }
          />
        </View>
      );
    }
    return (
      <View className="flex-1 bg-background px-4 py-6">
        <View className="rounded-[24px] border border-border bg-card px-5 py-6">
          <Text className="text-lg font-semibold text-foreground">
            링크 상세를 불러오지 못했어요
          </Text>
          <Text className="mt-2 text-sm leading-6 text-muted-foreground">
            잠시 후 다시 시도해주세요.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <LinkDetailView
      detail={linkDetailQuery.data}
      mode="screen"
      onDeleted={() => router.replace("/home")}
    />
  );
}

export { LinkDetailScreen };
