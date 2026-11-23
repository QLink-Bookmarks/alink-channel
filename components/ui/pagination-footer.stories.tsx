import { useState } from "react";
import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { PaginationFooter } from "./pagination-footer";

const meta = {
  title: "공통 UI/페이지 이어서 불러오기",
  component: PaginationFooter,
  args: {
    isLoading: false,
    isError: false,
    errorTitle: "링크를 불러오지 못했어요",
    onRetry: () => {},
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof PaginationFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "다음 묶음 불러오는 중",
  args: { isLoading: true },
};

export const Retry: Story = {
  name: "다음 묶음 오류와 재시도",
  args: { isError: true },
  render: function Render(args) {
    const [isRetrying, setIsRetrying] = useState(false);

    return (
      <PaginationFooter
        {...args}
        isLoading={args.isLoading || isRetrying}
        onRetry={() => {
          setIsRetrying(true);
          args.onRetry();
        }}
      />
    );
  },
};
