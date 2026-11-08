import * as React from "react";
import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { Checkbox } from "./checkbox";
import { Text } from "./text";

import { useArgs } from "storybook/preview-api";

type CheckboxStoryProps = {
  label: string;
  checked: boolean;
  disabled: boolean;
  shape: "square" | "round";
};

function CheckboxDemo({
  label,
  checked: initialChecked = true,
  disabled = false,
  shape = "square",
}: CheckboxStoryProps) {
  const [checked, setChecked] = React.useState(initialChecked);

  const handleCheckedChange = (nextChecked: boolean) => {
    setChecked(nextChecked);
  };

  return (
    <View className="flex-row items-center gap-3 p-4">
      <Checkbox
        checked={checked}
        disabled={disabled}
        shape={shape}
        onCheckedChange={handleCheckedChange}
      />
      <Text>{label}</Text>
    </View>
  );
}

const meta = {
  title: "공통 UI/체크박스",
  component: CheckboxDemo,
  args: {
    label: "알림 받기",
    checked: true,
    disabled: false,
    shape: "square",
  },
  argTypes: {
    label: { control: "text" },
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
    shape: { control: "select", options: ["square", "round"] },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    return (
      <View className="flex-row items-center gap-3 p-4">
        <Checkbox
          checked={args.checked}
          disabled={args.disabled}
          shape={args.shape}
          onCheckedChange={(nextChecked) => updateArgs({ checked: nextChecked })}
        />
        <Text>{args.label}</Text>
      </View>
    );
  },
} satisfies Meta<typeof CheckboxDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Disabled: Story = {
  name: "비활성",
  args: {
    disabled: true,
  },
};

export const Unchecked: Story = {
  name: "선택 안 됨",
  args: {
    checked: false,
  },
};

export const Round: Story = {
  name: "둥근 모양",
  args: {
    label: "액션 완료",
    checked: false,
    shape: "round",
  },
};

export const States: Story = {
  name: "상태 모음",
  render: () => (
    <View className="gap-3 p-4">
      {(["square", "round"] as const).map((shape) => (
        <View
          key={shape}
          className="flex-row items-center gap-6 rounded-[14px] border border-border bg-card p-4"
        >
          <Checkbox
            checked={false}
            shape={shape}
            onCheckedChange={() => {}}
          />
          <Checkbox
            checked
            shape={shape}
            onCheckedChange={() => {}}
          />
          <Checkbox
            checked={false}
            disabled
            shape={shape}
            onCheckedChange={() => {}}
          />
          <Checkbox
            checked={false}
            shape={shape}
            size="sm"
            onCheckedChange={() => {}}
          />
        </View>
      ))}
    </View>
  ),
};

export const WebHitSlop: Story = {
  name: "웹 누르는 영역 넓힘",
  render: () => (
    <View className="flex-row items-center gap-3 p-4">
      <Checkbox
        accessibilityLabel="완료 표시, 렌터카 예약 확인"
        checked={false}
        shape="round"
        webHitSlop={12}
        onCheckedChange={() => {}}
      />
      <Text className="text-sm text-muted-foreground">
        웹에서 보이는 16px 둘레 12px까지(40×40) 눌러도 바뀐다.
      </Text>
    </View>
  ),
};
