import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { Meta, StoryObj } from "@storybook/react-native";

import { PageHeader } from "./page-header";

const meta = {
  title: "레이아웃/페이지 헤더",
  component: PageHeader,
  parameters: {
    docs: {
      description: {
        component: "와이드뷰 전용 페이지 제목 영역이다. md 이상에서 사용한다.",
      },
    },
  },
  args: {
    title: "링크",
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
  args: {
    title: "링크",
  },
  render: () => (
    <PageHeader
      className="flex"
      title="링크"
      emoji="Q"
      meta="저장한 링크 12개"
      primaryAction={{ label: "추가" }}
      actions={
        <Button
          size="sm"
          variant="outline"
        >
          <Text>가져오기</Text>
        </Button>
      }
    />
  ),
};

export const FolderTitle: Story = {
  name: "폴더 제목",
  render: () => (
    <PageHeader
      className="flex"
      title="디자인 레퍼런스"
      emoji="📁"
      titleAccessibilityRole="header"
    />
  ),
};
