import * as React from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type ListSort, type SortCriterion, getSortCriterionLabel } from "@/lib/list-sort";
import type { Meta, StoryObj } from "@storybook/react-native";

import { FilterChip } from "./filter-chip";
import { FilterCoverPart, FilterCoverRow, type FilterPill } from "./filter-cover-row";
import { SortCriterionChips, SortDirectionArrow } from "./sort-criterion-chips";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Star } from "lucide-react-native/icons";

type SortKey = "created_at" | "title";

const CRITERIA: SortCriterion<SortKey>[] = [
  { key: "created_at", label: "저장일", firstDirection: "desc" },
  { key: "title", label: "제목", firstDirection: "asc" },
];

const DEFAULT_SORT: ListSort<SortKey> = { key: "created_at", direction: "desc" };

const FOLDERS = ["전체", "🗂️ 미분류", "📚 공부", "☕ 가볼 곳", "🏕️ 캠핑 모음", "🍳 레시피"];

function buildPill(sort: ListSort<SortKey>, favoriteOnly: boolean): FilterPill | null {
  const isDefaultSort = sort.key === DEFAULT_SORT.key && sort.direction === DEFAULT_SORT.direction;
  const parts: FilterPill["parts"] = [];
  if (favoriteOnly) {
    const star = (
      <Icon
        as={Star}
        className="fill-warning text-warning-icon"
        size={13}
      />
    );
    parts.push({ id: "star", text: star, mark: star });
  }
  if (!isDefaultSort) {
    const label = CRITERIA.find((criterion) => criterion.key === sort.key)?.label ?? "";
    parts.push({
      id: "sort",
      text: (
        <View className="flex-row items-center gap-0.5">
          <Text>{label}</Text>
          <SortDirectionArrow
            className="text-primary"
            direction={sort.direction}
          />
        </View>
      ),
      mark: (
        <Icon
          as={sort.direction === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow}
          className="text-primary"
          size={13}
        />
      ),
    });
  }
  return parts.length > 0 ? { parts } : null;
}

function buildAppliedLabel(sort: ListSort<SortKey>, favoriteOnly: boolean) {
  const words: string[] = [];
  if (sort.key !== DEFAULT_SORT.key || sort.direction !== DEFAULT_SORT.direction) {
    const label = CRITERIA.find((criterion) => criterion.key === sort.key)?.label ?? "";
    words.push(getSortCriterionLabel(label, sort.direction).replace(", ", " "));
  }
  if (favoriteOnly) {
    words.push("바로가기만");
  }
  return words.length > 0 ? words.join(", ") : null;
}

type FilterCoverRowStoryProps = {
  withPrimaryChips: boolean;
  coverMode: "fill" | "content";
  favoriteOnly: boolean;
  sortKey: SortKey;
};

function FilterCoverRowStory({
  withPrimaryChips,
  coverMode,
  favoriteOnly: initialFavoriteOnly,
  sortKey,
}: FilterCoverRowStoryProps) {
  const [folder, setFolder] = React.useState(FOLDERS[0]);
  const [favoriteOnly, setFavoriteOnly] = React.useState(initialFavoriteOnly);
  const [sort, setSort] = React.useState<ListSort<SortKey>>(
    sortKey === "title" ? { key: "title", direction: "asc" } : DEFAULT_SORT,
  );

  return (
    <FilterCoverRow
      appliedLabel={buildAppliedLabel(sort, favoriteOnly)}
      coverLabel="정렬·필터"
      coverMode={coverMode}
      pill={buildPill(sort, favoriteOnly)}
      primaryLabel={withPrimaryChips ? "폴더" : undefined}
      primary={
        withPrimaryChips ? (
          FOLDERS.map((name) => (
            <FilterChip
              key={name}
              label={name}
              selected={folder === name}
              onPress={() => setFolder(name)}
            />
          ))
        ) : (
          <Text className="text-sm text-muted-foreground">12개 링크</Text>
        )
      }
      cover={
        <>
          <FilterCoverPart id="star">
            <Pressable
              accessibilityLabel="바로가기만 보기"
              accessibilityRole="switch"
              accessibilityState={{ checked: favoriteOnly }}
              className="size-8 items-center justify-center rounded-full border border-border bg-card"
              onPress={() => setFavoriteOnly((current) => !current)}
            >
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
            criteria={CRITERIA}
            value={sort}
            onValueChange={setSort}
          />
        </>
      }
    />
  );
}

const meta = {
  title: "공통 UI/필터 칩 줄",
  component: FilterCoverRowStory,
  argTypes: {
    withPrimaryChips: { control: "boolean" },
    coverMode: { control: "select", options: ["fill", "content"] },
    favoriteOnly: { control: "boolean" },
    sortKey: { control: "select", options: ["created_at", "title"] },
  },
  args: {
    withPrimaryChips: true,
    coverMode: "fill",
    favoriteOnly: false,
    sortKey: "created_at",
  },
  decorators: [
    (Story) => (
      <View className="w-full max-w-[390px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof FilterCoverRowStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본 (아이콘만)",
};

export const Applied: Story = {
  name: "적용 중 (알약)",
  args: { favoriteOnly: true, sortKey: "title" },
};

export const WithoutPrimaryChips: Story = {
  name: "1차 없음 (개수 + 버튼)",
  args: { withPrimaryChips: false },
};

export const Narrow: Story = {
  name: "320 폭",
  args: { favoriteOnly: true, sortKey: "title" },
  decorators: [
    (Story) => (
      <View className="w-[320px]">
        <Story />
      </View>
    ),
  ],
};
