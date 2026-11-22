import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { BottomTabs } from "./bottom-tabs";

import { Folder, House, ListTodo, Settings } from "lucide-react-native/icons";

const meta = {
  title: "레이아웃/하단 탭",
  component: BottomTabs,
  parameters: {
    docs: {
      description: {
        component: "모바일 전용 하단 내비게이션이다. md 이상에서는 사용하지 않는다.",
      },
    },
  },
  args: {
    value: "home",
    items: [
      { key: "home", label: "홈", icon: House },
      { key: "folders", label: "폴더", icon: Folder },
      { key: "todos", label: "액션", icon: ListTodo },
      { key: "settings", label: "설정", icon: Settings },
    ],
  },
  decorators: [
    (Story) => (
      <View className="h-[300px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof BottomTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const FolderActive: Story = {
  name: "폴더 활성",
  args: { value: "folders" },
};
