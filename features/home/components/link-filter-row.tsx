import * as React from "react";
import { Pressable, View } from "react-native";

import {
  type FilterCoverMode,
  FilterCoverPart,
  FilterCoverRow,
  type FilterPill,
} from "@/components/ui/filter-cover-row";
import { Icon } from "@/components/ui/icon";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { SortCriterionChips, SortDirectionArrow } from "@/components/ui/sort-criterion-chips";
import { Text } from "@/components/ui/text";
import {
  LINK_SORT_CRITERIA,
  type LinkPillPart,
  type LinkSort,
  getLinkAppliedLabel,
  getLinkPill,
} from "@/features/links/lib/link-sort";
import { cn } from "@/lib/utils";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Star } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";

// The toggle is 32px; its press area reaches 6px past every side (44 × 44).
const STAR_HIT_SLOP = { top: 6, right: 6, bottom: 6, left: 6 };

type LinkFilterRowProps = {
  // The 1st set: folder chips on the mobile home, "N개 링크" elsewhere.
  children: React.ReactNode;
  // Accessible name of the 1st chips; leave it out when the 1st set is a label.
  primaryLabel?: string;
  sort: LinkSort;
  onSortChange: (next: LinkSort) => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (next: boolean) => void;
  coverMode: FilterCoverMode;
  className?: string;
  testID?: string;
};

function StarMark() {
  return (
    <Icon
      as={Star}
      className="fill-warning text-warning-icon"
      size={13}
    />
  );
}

function toFilterPill(parts: LinkPillPart[] | null): FilterPill | null {
  if (!parts) {
    return null;
  }
  return {
    parts: parts.map((part) =>
      part.id === "star"
        ? { id: "star", text: <StarMark />, mark: <StarMark /> }
        : {
            id: "sort",
            text: (
              <View className="flex-row items-center gap-0.5">
                <Text>{part.label}</Text>
                <SortDirectionArrow
                  className="text-primary"
                  direction={part.direction}
                />
              </View>
            ),
            mark: (
              <Icon
                as={part.direction === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow}
                className="text-primary"
                size={13}
              />
            ),
          },
    ),
  };
}

/** The filter row of a link list: ★ 바로가기 and 저장일·제목 sort behind the cover button. */
function LinkFilterRow({
  children,
  primaryLabel,
  sort,
  onSortChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  coverMode,
  className,
  testID,
}: LinkFilterRowProps) {
  const pill = React.useMemo(
    () => toFilterPill(getLinkPill(sort, favoriteOnly)),
    [sort, favoriteOnly],
  );
  const handleFavoritePress = () => onFavoriteOnlyChange(!favoriteOnly);
  // react-native-web presses on Space only for buttons; a switch toggles on Space as well.
  const favoriteKeyProps = isWeb
    ? ({
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (event.key === " " || event.key === "Spacebar") {
            event.preventDefault();
            handleFavoritePress();
          }
        },
      } as Record<string, unknown>)
    : {};

  return (
    <FilterCoverRow
      appliedLabel={getLinkAppliedLabel(sort, favoriteOnly)}
      className={className}
      coverLabel="정렬·필터"
      coverMode={coverMode}
      pill={pill}
      primary={children}
      primaryLabel={primaryLabel}
      testID={testID}
      cover={
        <>
          <FilterCoverPart id="star">
            <Pressable
              accessibilityLabel="바로가기만 보기"
              accessibilityRole="switch"
              accessibilityState={{ checked: favoriteOnly }}
              aria-checked={favoriteOnly}
              className={cn(
                "size-8 items-center justify-center rounded-full border",
                favoriteOnly ? "border-warning bg-warning/15" : "border-border bg-card",
                isWeb &&
                  "outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
              )}
              hitSlop={STAR_HIT_SLOP}
              testID={testID ? `${testID}-favorite` : undefined}
              onPress={handleFavoritePress}
              {...favoriteKeyProps}
            >
              <PressableHitSlopArea hitSlop={STAR_HIT_SLOP} />
              <Icon
                as={Star}
                className={
                  favoriteOnly ? "fill-warning text-warning-icon" : "text-muted-foreground"
                }
                size={16}
              />
            </Pressable>
          </FilterCoverPart>
          <SortCriterionChips
            criteria={LINK_SORT_CRITERIA}
            value={sort}
            onValueChange={onSortChange}
          />
        </>
      }
    />
  );
}

export { LinkFilterRow };
export type { LinkFilterRowProps };
