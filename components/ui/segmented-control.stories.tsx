import * as React from "react";
import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { SegmentedControl } from "./segmented-control";

type SegmentedControlStoryProps = {
  value: "all" | "open" | "done";
  variant: "pills" | "chips" | "chipsRound" | "chipsBadge" | "cells" | "track";
  block: boolean;
};

const options = [
  { label: "전체", value: "all" },
  { label: "진행 중", value: "open" },
  { label: "완료", value: "done" },
];

function SegmentedControlStory({ value, variant, block }: SegmentedControlStoryProps) {
  const [currentValue, setCurrentValue] = React.useState(value);

  React.useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  return (
    <SegmentedControl
      value={currentValue}
      variant={variant}
      block={block}
      options={options}
      onValueChange={(nextValue) =>
        setCurrentValue(nextValue as SegmentedControlStoryProps["value"])
      }
    />
  );
}

const meta = {
  title: "공통 UI/세그먼트 컨트롤",
  component: SegmentedControlStory,
  argTypes: {
    value: { control: "select", options: ["all", "open", "done"] },
    variant: {
      control: "select",
      options: ["pills", "chips", "chipsRound", "chipsBadge", "cells", "track"],
    },
    block: { control: "boolean" },
  },
  args: {
    value: "all",
    variant: "pills",
    block: false,
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof SegmentedControlStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Variants: Story = {
  name: "변형",
  render: ({ value }) => (
    <View className="gap-3">
      <SegmentedControlStory
        value={value}
        variant="pills"
        block={false}
      />
      <SegmentedControlStory
        value={value}
        variant="chips"
        block={false}
      />
      <SegmentedControlStory
        value={value}
        variant="chipsRound"
        block={false}
      />
      <SegmentedControlStory
        value={value}
        variant="chipsBadge"
        block={false}
      />
      <SegmentedControlStory
        value={value}
        variant="cells"
        block
      />
      <SegmentedControlStory
        value={value}
        variant="track"
        block
      />
    </View>
  ),
};
