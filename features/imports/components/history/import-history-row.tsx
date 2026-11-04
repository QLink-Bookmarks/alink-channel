import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { getImportRowMetaParts, isFillingThumbnails } from "../../lib/import-status-copy";
import type { ImportSummary } from "../../types";
import { ImportRowMeta } from "./import-row-meta";
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
  const isFilling = isFillingThumbnails(summary);
  const handleOpenDetail = () => onOpenDetail(summary);
  const handleReverse = () => onReverse(summary);
  const badge = (
    <ImportStatusBadge
      status={summary.status}
      isFillingThumbnails={isFilling}
    />
  );

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
            {isWide ? badge : null}
          </View>
          <ImportRowMeta parts={getImportRowMetaParts(summary)} />
          {isWide ? null : <View className="flex-row pt-0.5">{badge}</View>}
        </View>
      </Pressable>

      <View className={cn("flex-row items-center", isWide ? "gap-1" : "gap-2")}>
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
            <Button
              variant="ghost"
              className="h-11 min-w-0 px-2.5 sm:h-11"
              accessibilityLabel={`${summary.fileName} 되돌리기`}
              onPress={handleReverse}
            >
              <Text className="text-base font-medium">되돌리기</Text>
            </Button>
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
