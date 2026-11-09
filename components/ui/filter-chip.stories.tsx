import * as React from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { Meta, StoryObj } from "@storybook/react-native";

import { FilterChip } from "./filter-chip";
import { SegmentedControl } from "./segmented-control";

const STATUSES = [
  { value: "all", label: "전체", count: 12 },
  { value: "active", label: "진행 중", count: 7 },
  { value: "overdue", label: "기간지남", count: 2 },
  { value: "completed", label: "완료", count: 3 },
];

type FilterChipStoryProps = {
  withCount: boolean;
};

function FilterChipStory({ withCount }: FilterChipStoryProps) {
  const [value, setValue] = React.useState("all");
  return (
    <ScrollView
      horizontal
      className="grow-0"
      contentContainerClassName="items-center gap-1"
    >
      {STATUSES.map((status) => (
        <FilterChip
          key={status.value}
          count={withCount ? status.count : null}
          label={status.label}
          selected={value === status.value}
          onPress={() => setValue(status.value)}
        />
      ))}
    </ScrollView>
  );
}

const meta = {
  title: "공통 UI/필터 칩",
  component: FilterChipStory,
  argTypes: {
    withCount: { control: "boolean" },
  },
  args: {
    withCount: true,
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof FilterChipStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const WithoutCount: Story = {
  name: "개수 없음 (불러오는 중·실패)",
  args: { withCount: false },
};

// Side by side with SegmentedControl chipsBadge so the two chips do not drift apart.
export const CompareWithSegmentedControl: Story = {
  name: "SegmentedControl chipsBadge와 비교",
  render: () => {
    const options = STATUSES.map((status) => ({ label: status.label, value: status.value }));
    return (
      <View className="gap-3">
        <Text className="text-xs text-muted-foreground">FilterChip</Text>
        <FilterChipStory withCount={false} />
        <Text className="text-xs text-muted-foreground">SegmentedControl chipsBadge</Text>
        <SegmentedControl
          labelClassName="text-sm"
          options={options}
          selectionMode="single"
          value="all"
          variant="chipsBadge"
        />
      </View>
    );
  },
};
