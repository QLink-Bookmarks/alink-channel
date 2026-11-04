import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { ProposalSummary as Summary } from "../../lib/proposal-state";
import { formatNumber } from "../../lib/split-import-ranges";

type ProposalSummaryProps = {
  summary: Summary;
  isWide: boolean;
  onShowSkipped: () => void;
  onShowUnsupported: () => void;
};

function SummaryCell({
  label,
  value,
  isAdded,
  isLast,
  isWide,
  onPress,
}: {
  label: string;
  value: number;
  isAdded?: boolean;
  isLast?: boolean;
  isWide: boolean;
  onPress?: () => void;
}) {
  const text = isAdded && value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
  const content = (
    <>
      <Text
        className={cn(
          "text-[13px] text-muted-foreground",
          onPress && value > 0 && "underline decoration-dotted underline-offset-4",
        )}
      >
        {label}
      </Text>
      <Text
        className={cn(
          "text-base font-bold tabular-nums",
          isAdded && value > 0 ? "text-success" : "text-foreground",
        )}
      >
        {text}
      </Text>
    </>
  );
  const className = cn(
    "min-w-0 flex-row items-center justify-between gap-2 px-3.5 py-3",
    isWide ? "flex-1" : "w-1/2",
    !isLast && isWide && "border-r border-border",
  );
  if (onPress && value > 0) {
    return (
      <Pressable
        accessibilityLabel={`${label} ${value}개 보기`}
        accessibilityRole="button"
        className={cn(className, "active:bg-muted web:hover:bg-muted")}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View
      accessibilityLabel={`${label} ${text}`}
      className={className}
    >
      {content}
    </View>
  );
}

function ProposalSummary({
  summary,
  isWide,
  onShowSkipped,
  onShowUnsupported,
}: ProposalSummaryProps) {
  return (
    <View
      accessibilityLabel="가져오기 요약"
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        isWide ? "flex-row" : "flex-row flex-wrap",
      )}
    >
      <SummaryCell
        isAdded
        isWide={isWide}
        label="추가할 링크"
        value={summary.addCount}
      />
      <SummaryCell
        isAdded
        isWide={isWide}
        label="새 폴더"
        value={summary.newFolderCount}
      />
      <SummaryCell
        isWide={isWide}
        label="건너뛸 링크"
        value={summary.skipCount}
        onPress={onShowSkipped}
      />
      <SummaryCell
        isLast
        isWide={isWide}
        label="가져오기 불가 링크"
        value={summary.unsupportedCount}
        onPress={onShowUnsupported}
      />
    </View>
  );
}

export { ProposalSummary };
