import * as React from "react";
import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import type { DateValue } from "./date-picker";
import { DateTimePickerButton } from "./date-time-picker-button";
import type { TimeValue } from "./time-picker";

const meta = {
  title: "공통 UI/날짜·시간 버튼",
  decorators: [
    (Story) => (
      <View className="w-80 p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function DateTimeFields({
  initialDate,
  initialTime,
}: {
  initialDate: DateValue | null;
  initialTime: TimeValue | null;
}) {
  const [date, setDate] = React.useState<DateValue | null>(initialDate);
  const [time, setTime] = React.useState<TimeValue | null>(initialTime);

  return (
    <View className="h-10 flex-row gap-2.5">
      <DateTimePickerButton
        kind="date"
        mode="wide"
        placeholder="날짜 선택"
        value={date}
        onChange={setDate}
      />
      <DateTimePickerButton
        kind="time"
        mode="wide"
        placeholder="시간 선택"
        value={time}
        onChange={setTime}
      />
    </View>
  );
}

export const Empty: Story = {
  name: "빈 칸",
  render: () => (
    <DateTimeFields
      initialDate={null}
      initialTime={null}
    />
  ),
};

export const Picked: Story = {
  name: "고른 값",
  render: () => (
    <DateTimeFields
      initialDate={{ year: 2026, month: 11, day: 20 }}
      initialTime={{ hour: 9, minute: 0 }}
    />
  ),
};
