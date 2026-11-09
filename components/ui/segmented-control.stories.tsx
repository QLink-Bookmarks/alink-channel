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

const sizeOptions = [
  { label: "작게", value: "small" },
  { label: "크게", value: "large" },
];

const weekdayOptions = [
  { label: "월", value: "mon" },
  { label: "화", value: "tue" },
  { label: "수", value: "wed" },
  { label: "목", value: "thu" },
  { label: "금", value: "fri" },
];

function TwoOptionTrackStory() {
  const [size, setSize] = React.useState("large");
  return (
    <View className="min-h-11 flex-row items-center">
      <SegmentedControl
        accessibilityLabel="링크 카드 크기"
        value={size}
        variant="track"
        options={sizeOptions}
        onValueChange={(next) => setSize(next as string)}
      />
    </View>
  );
}

function MultipleSelectionStory() {
  const [days, setDays] = React.useState<string[]>(["mon", "wed"]);
  return (
    <SegmentedControl
      accessibilityLabel="요일"
      value={days}
      block
      selectionMode="multiple"
      variant="chips"
      options={weekdayOptions}
      onValueChange={(next) => setDays(next as string[])}
    />
  );
}

/**
 * Two options in the track style, as the link card size row in settings. Each item is a radio
 * announced with its checked state and is at least 44pt tall to touch on iOS without changing
 * the layout, inside a 44pt-tall row.
 */
export const TwoOptionTrack: Story = {
  name: "두 칸 트랙 (링크 카드 크기)",
  render: () => <TwoOptionTrackStory />,
};

/** Several selected at once: each item is a checkbox announced with its checked state. */
export const MultipleSelection: Story = {
  name: "여러 개 선택",
  render: () => <MultipleSelectionStory />,
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

export const Disabled: Story = {
  name: "잠금",
  render: ({ value }) => (
    <View className="opacity-50">
      <SegmentedControl
        disabled
        value={value}
        variant="track"
        block
        options={options}
      />
    </View>
  ),
};
