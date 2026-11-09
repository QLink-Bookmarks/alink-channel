import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { Fab } from "./fab";

import { Plus } from "lucide-react-native/icons";

const meta = {
  title: "레이아웃/FAB",
  component: Fab,
  parameters: {
    docs: {
      description: {
        component:
          "모바일 전용 주요 액션 버튼이다. md 이상에서는 사용하지 않는다. 자리는 부르는 쪽이 className으로 정한다. 라이트에서는 바깥에 흰 고리를 두고, 다크에서는 고리 없이 그림자만 둔다(툴바의 모드로 확인).",
      },
    },
  },
  args: {
    icon: Plus,
    label: "추가",
  },
  decorators: [
    (Story) => (
      <View className="h-[400px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Fab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Inline: Story = {
  name: "줄 안에 놓기",
  args: { label: "새 링크" },
  render: (args) => (
    <View className="h-[72px] flex-row border-t border-border bg-background">
      <View className="flex-1 px-5" />
      <View className="w-[88px] items-end justify-end pb-2 pr-6">
        <Fab {...args} />
      </View>
    </View>
  ),
};

export const AboveTabs: Story = {
  name: "하단 탭 위 (셸 배치)",
  args: { label: "새 링크" },
  render: (args) => (
    <View className="h-[240px] justify-end bg-background">
      <View className="relative flex-1">
        <Fab
          {...args}
          className="absolute bottom-2 right-6"
        />
      </View>
      <View className="h-16 border-t border-border" />
    </View>
  ),
};
