import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { LoadErrorState } from "./load-error-state";

const meta = {
  title: "공통 UI/불러오기 오류",
  component: LoadErrorState,
  args: {
    title: "링크를 불러오지 못했어요",
    isRetrying: false,
    onRetry: () => {},
  },
  argTypes: {
    title: { control: "text" },
    isRetrying: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof LoadErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Retrying: Story = {
  name: "다시 시도 중",
  args: { isRetrying: true },
};

export const Todos: Story = {
  name: "액션",
  args: { title: "액션을 불러오지 못했어요" },
};
