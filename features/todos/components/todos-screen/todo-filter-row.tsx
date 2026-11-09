import * as React from "react";
import { View } from "react-native";

import { FilterChip } from "@/components/ui/filter-chip";
import {
  type FilterCoverMode,
  FilterCoverRow,
  type FilterPill,
} from "@/components/ui/filter-cover-row";
import { Icon } from "@/components/ui/icon";
import { SortCriterionChips, SortDirectionArrow } from "@/components/ui/sort-criterion-chips";
import { Text } from "@/components/ui/text";

import {
  TODO_STATUS_FILTERS,
  type TodoSort,
  type TodoStatusFilter,
  getTodoAppliedLabel,
  getTodoPill,
  getTodoSortCriteria,
} from "../../lib/todo-status";
import type { TodoCounts } from "../../types";

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react-native/icons";

type TodoFilterRowProps = {
  status: TodoStatusFilter;
  onStatusChange: (next: TodoStatusFilter) => void;
  // Null while the counts load or when they failed: the chips then show names only.
  counts: TodoCounts | null;
  sort: TodoSort;
  onSortChange: (next: TodoSort) => void;
  coverMode: FilterCoverMode;
  className?: string;
  testID?: string;
};

function toFilterPill(status: TodoStatusFilter, sort: TodoSort): FilterPill | null {
  const piece = getTodoPill(status, sort);
  if (!piece) {
    return null;
  }
  return {
    parts: [
      {
        id: "sort",
        text: (
          <View className="flex-row items-center gap-0.5">
            <Text>{piece.label}</Text>
            <SortDirectionArrow
              className="text-primary"
              direction={piece.direction}
            />
          </View>
        ),
        mark: (
          <Icon
            as={piece.direction === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow}
            className="text-primary"
            size={13}
          />
        ),
      },
    ],
  };
}

/** The filter row of the actions tab: status chips with counts, and date sort behind the button. */
function TodoFilterRow({
  status,
  onStatusChange,
  counts,
  sort,
  onSortChange,
  coverMode,
  className,
  testID,
}: TodoFilterRowProps) {
  const pill = React.useMemo(() => toFilterPill(status, sort), [status, sort]);

  return (
    <FilterCoverRow
      appliedLabel={getTodoAppliedLabel(status, sort)}
      className={className}
      coverLabel="정렬·필터"
      coverMode={coverMode}
      pill={pill}
      primaryLabel="액션 상태"
      testID={testID}
      primary={TODO_STATUS_FILTERS.map((filter) => (
        <FilterChip
          key={filter.value}
          count={counts ? counts[filter.value] : null}
          label={filter.label}
          selected={status === filter.value}
          testID={testID ? `${testID}-status-${filter.value}` : undefined}
          onPress={() => onStatusChange(filter.value)}
        />
      ))}
      cover={
        <SortCriterionChips
          criteria={getTodoSortCriteria(status)}
          value={sort}
          onValueChange={onSortChange}
        />
      }
    />
  );
}

export { TodoFilterRow };
export type { TodoFilterRowProps };
