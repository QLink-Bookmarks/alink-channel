import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { getImportRowMeta } from "../../lib/import-status-copy";
import type { ImportSummary } from "../../types";
import { ImportStatusBadge } from "./import-status-badge";

import { ChevronRight, FileText, Undo2 } from "lucide-react-native";

type ImportHistoryRowProps = {
  summary: ImportSummary;
  isWide: boolean;
  isFirst?: boolean;
  onOpenDetail: (summary: ImportSummary) => void;
  onReverse: (summary: ImportSummary) => void;
};

function ImportHistoryRow({
  summary,
  isWide,
  isFirst,
  onOpenDetail,
  onReverse,
}: ImportHistoryRowProps) {
  const isFillingThumbnails = summary.progress < 1;
  const handleOpenDetail = () => onOpenDetail(summary);
  const handleReverse = () => onReverse(summary);

  return (
    <View
      className={cn("flex-row items-center gap-2 px-4 py-3", !isFirst && "border-t border-border")}
      testID={`import-row-${summary.id}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${summary.fileName} 기록 상세`}
        className="min-w-0 flex-1 flex-row items-start gap-3 rounded-xl py-1 active:opacity-80"
        onPress={handleOpenDetail}
      >
        <View className="size-9 items-center justify-center rounded-xl bg-muted">
          <Icon
            as={FileText}
            size={16}
            className="text-muted-foreground"
          />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="min-w-0 flex-1 text-sm font-semibold text-foreground"
              numberOfLines={1}
            >
              {summary.fileName}
            </Text>
            {isWide ? <ImportStatusBadge status={summary.status} /> : null}
          </View>
          <Text className="text-xs text-muted-foreground">{getImportRowMeta(summary)}</Text>
          {isWide ? null : (
            <View className="flex-row">
              <ImportStatusBadge status={summary.status} />
            </View>
          )}
          {isFillingThumbnails ? (
            <View
              className="gap-1 pt-1"
              testID={`import-progress-${summary.id}`}
            >
              <Progress
                size="sm"
                value={Math.round(summary.progress * 100)}
                className="bg-muted"
                indicatorClassName="bg-muted-foreground"
              />
              <Text className="text-[11px] text-muted-foreground">썸네일 채우는 중</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View className="flex-row items-center gap-1">
        {summary.isReversible ? (
          isWide ? (
            <Button
              variant="ghost"
              size="sm"
              accessibilityLabel={`${summary.fileName} 되돌리기`}
              onPress={handleReverse}
            >
              <Icon
                as={Undo2}
                size={16}
                className="text-foreground"
              />
              <Text>되돌리기</Text>
            </Button>
          ) : (
            <IconButton
              accessibilityLabel={`${summary.fileName} 되돌리기`}
              icon={Undo2}
              size="md"
              variant="ghost"
              onPress={handleReverse}
            />
          )
        ) : null}
        <IconButton
          accessibilityLabel={`${summary.fileName} 상세 보기`}
          icon={ChevronRight}
          size={isWide ? "sm" : "md"}
          variant="ghost"
          onPress={handleOpenDetail}
        />
      </View>
    </View>
  );
}

export { ImportHistoryRow };
