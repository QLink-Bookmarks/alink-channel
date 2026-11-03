import { View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import type { ImportSummary } from "../../types";
import { ImportHistoryRow } from "./import-history-row";

import { History } from "lucide-react-native";

type ImportHistoryListProps = {
  summaries: ImportSummary[];
  isWide: boolean;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onOpenDetail: (summary: ImportSummary) => void;
  onReverse: (summary: ImportSummary) => void;
};

function ImportHistoryList({
  summaries,
  isWide,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onRetry,
  onLoadMore,
  onOpenDetail,
  onReverse,
}: ImportHistoryListProps) {
  if (isLoading) {
    return (
      <View className="items-center rounded-2xl border border-border bg-card py-12">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError && summaries.length === 0) {
    return (
      <View className="items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12">
        <Text className="text-base font-semibold text-foreground">
          가져오기 기록을 불러오지 못했어요
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          네트워크 연결을 확인한 뒤 다시 시도해 주세요.
        </Text>
        <Button
          variant="outline"
          onPress={onRetry}
        >
          <Text>다시 시도</Text>
        </Button>
      </View>
    );
  }

  if (summaries.length === 0) {
    return (
      <View className="items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12">
        <View className="size-12 items-center justify-center rounded-2xl bg-muted">
          <Icon
            as={History}
            size={22}
            className="text-muted-foreground"
          />
        </View>
        <Text className="text-base font-semibold text-foreground">아직 가져온 기록이 없어요</Text>
        <Text className="max-w-sm text-center text-sm text-muted-foreground">
          Chrome·Edge·Whale에서 내보낸 북마크 HTML 파일을 올리면 여기에 기록이 쌓여요.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View
        className="overflow-hidden rounded-2xl border border-border bg-card"
        role="list"
        aria-label="가져오기 기록"
      >
        {summaries.map((summary, index) => (
          <View
            key={summary.id}
            className="w-full"
            role="listitem"
          >
            <ImportHistoryRow
              summary={summary}
              isFirst={index === 0}
              isWide={isWide}
              onOpenDetail={onOpenDetail}
              onReverse={onReverse}
            />
          </View>
        ))}
      </View>
      {hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={isFetchingNextPage}
          onPress={onLoadMore}
        >
          <Text>{isFetchingNextPage ? "불러오는 중…" : "기록 더 보기"}</Text>
        </Button>
      ) : null}
    </View>
  );
}

export { ImportHistoryList };
