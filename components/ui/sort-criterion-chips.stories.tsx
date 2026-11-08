import * as React from "react";
import { View } from "react-native";

import type { ListSort, SortCriterion } from "@/lib/list-sort";
import type { Meta, StoryObj } from "@storybook/react-native";

import { SortCriterionChips } from "./sort-criterion-chips";

type TodoSortKey = "reminder_at" | "created_at" | "completed_at";

const LINK_CRITERIA: SortCriterion<string>[] = [
  { key: "created_at", label: "저장일", firstDirection: "desc" },
  { key: "title", label: "제목", firstDirection: "asc" },
];

const TODO_CRITERIA: SortCriterion<TodoSortKey>[] = [
  { key: "reminder_at", label: "알림일", firstDirection: "asc" },
  { key: "created_at", label: "만든 날", firstDirection: "desc" },
  { key: "completed_at", label: "완료일", firstDirection: "desc" },
];

type SortCriterionChipsStoryProps = {
  kind: "links" | "todos";
};

function SortCriterionChipsStory({ kind }: SortCriterionChipsStoryProps) {
  const criteria = kind === "links" ? LINK_CRITERIA : TODO_CRITERIA;
  const [value, setValue] = React.useState<ListSort<string>>({
    key: criteria[0].key,
    direction: criteria[0].firstDirection,
  });

  React.useEffect(() => {
    setValue({ key: criteria[0].key, direction: criteria[0].firstDirection });
  }, [criteria]);

  return (
    <SortCriterionChips
      criteria={criteria}
      value={value}
      onValueChange={setValue}
    />
  );
}

const meta = {
  title: "공통 UI/정렬 기준 칩",
  component: SortCriterionChipsStory,
  argTypes: {
    kind: { control: "select", options: ["links", "todos"] },
  },
  args: {
    kind: "links",
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof SortCriterionChipsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Links: Story = {
  name: "링크 (저장일·제목)",
};

export const Todos: Story = {
  name: "액션 (알림일·만든 날·완료일)",
  args: { kind: "todos" },
};
