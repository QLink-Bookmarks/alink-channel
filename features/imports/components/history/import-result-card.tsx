import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  formatImportTime,
  getImportResultCopy,
  isFillingThumbnails,
} from "../../lib/import-status-copy";
import type { ImportSummary } from "../../types";
import { ImportStatusBadge } from "./import-status-badge";

import { ArrowRight, ChevronRight, CircleCheck, TriangleAlert, Undo2 } from "lucide-react-native";

const HIGHLIGHT_IN_MS = 240;

const TONE_TILE = {
  success: "bg-success/10",
  danger: "bg-destructive/10",
  muted: "bg-muted",
} as const;

const TONE_ICON = {
  success: "text-success",
  danger: "text-destructive",
  muted: "text-muted-foreground",
} as const;

type ImportResultCardProps = {
  summary: ImportSummary;
  isWide: boolean;
  isFirst?: boolean;
  isOpeningLinks?: boolean;
  onOpenLinks: (summary: ImportSummary) => void;
  onOpenDetail: (summary: ImportSummary) => void;
  onReverse: (summary: ImportSummary) => void;
};

function ImportResultCard({
  summary,
  isWide,
  isFirst,
  isOpeningLinks,
  onOpenLinks,
  onOpenDetail,
  onReverse,
}: ImportResultCardProps) {
  const copy = getImportResultCopy(summary);
  const badge = (
    <ImportStatusBadge
      status={summary.status}
      isFillingThumbnails={isFillingThumbnails(summary)}
    />
  );
  const time = formatImportTime(summary.createdAt);
  const handleOpenLinks = () => onOpenLinks(summary);
  const handleOpenDetail = () => onOpenDetail(summary);
  const handleReverse = () => onReverse(summary);
  const indent = isWide ? "pl-[38px]" : undefined;

  return (
    <View
      className={cn(!isFirst && "border-t border-border")}
      testID={`import-row-${summary.id}`}
    >
      <Animated.View entering={FadeIn.duration(HIGHLIGHT_IN_MS)}>
        <View
          className="gap-3 rounded-2xl border-2 border-primary/55 bg-primary/5 p-4"
          testID={`import-result-card-${summary.id}`}
        >
          <View className="flex-row items-center gap-2.5">
            <View
              className={cn(
                "size-7 items-center justify-center rounded-[9px]",
                TONE_TILE[copy.tone],
              )}
            >
              <Icon
                as={copy.tone === "danger" ? TriangleAlert : CircleCheck}
                size={16}
                className={TONE_ICON[copy.tone]}
              />
            </View>
            <Text
              role="heading"
              aria-level={3}
              className="min-w-0 flex-1 text-md font-bold text-foreground"
              numberOfLines={1}
            >
              {copy.title}
            </Text>
            {isWide ? (
              badge
            ) : (
              <IconButton
                accessibilityLabel={`${summary.fileName} 상세 보기`}
                icon={ChevronRight}
                size="md"
                variant="ghost"
                onPress={handleOpenDetail}
              />
            )}
          </View>
          <View className={cn("-mt-2 flex-row flex-wrap gap-x-1", indent)}>
            <Text
              className="min-w-0 shrink text-sm text-muted-foreground"
              numberOfLines={1}
            >
              {time ? `${summary.fileName} ·` : summary.fileName}
            </Text>
            {time ? (
              <Text className="text-sm text-muted-foreground web:whitespace-nowrap">{time}</Text>
            ) : null}
          </View>
          {isWide ? null : <View className="flex-row">{badge}</View>}
          <Text className={cn("text-base text-foreground", indent)}>{copy.sentence}</Text>
          <View className={cn("flex-row flex-wrap gap-2", indent)}>
            {copy.canOpenLinks ? (
              <Button
                size={isWide ? "sm" : "default"}
                className={cn(!isWide && "h-11 flex-1 sm:h-11")}
                disabled={isOpeningLinks}
                onPress={handleOpenLinks}
              >
                <Text>가져온 링크 보기</Text>
                <Icon
                  as={ArrowRight}
                  size={16}
                  className="text-primary-foreground"
                />
              </Button>
            ) : null}
            {isWide || !copy.canOpenLinks ? (
              <Button
                variant="outline"
                size={isWide ? "sm" : "default"}
                className={cn(!isWide && "h-11 sm:h-11")}
                onPress={handleOpenDetail}
              >
                <Text>상세 보기</Text>
              </Button>
            ) : null}
            {copy.canReverse ? (
              <Button
                variant={isWide ? "ghost" : "outline"}
                size={isWide ? "sm" : "default"}
                className={cn(!isWide && "h-11 sm:h-11")}
                accessibilityLabel={`${summary.fileName} 되돌리기`}
                onPress={handleReverse}
              >
                {isWide ? (
                  <Icon
                    as={Undo2}
                    size={16}
                    className="text-foreground"
                  />
                ) : null}
                <Text>되돌리기</Text>
              </Button>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export { ImportResultCard };
