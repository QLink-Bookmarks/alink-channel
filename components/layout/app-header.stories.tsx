import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { Meta, StoryObj } from "@storybook/react-native";

import { AppHeader, type AppHeaderTitleAlign } from "./app-header";

type AppHeaderStoryProps = {
  title: string;
  back: boolean;
  transparent: boolean;
  showLeftSlot: boolean;
  showRightSlot: boolean;
  titleAlign: AppHeaderTitleAlign;
};

function AppHeaderStory({
  title,
  back,
  transparent,
  showLeftSlot,
  showRightSlot,
  titleAlign,
}: AppHeaderStoryProps) {
  return (
    <AppHeader
      title={title}
      back={back}
      transparent={transparent}
      titleAlign={titleAlign}
      leftSlot={showLeftSlot ? <Text className="font-semibold">ALINK</Text> : undefined}
      rightSlot={
        showRightSlot ? (
          <Button size="sm">
            <Text>저장</Text>
          </Button>
        ) : undefined
      }
      onBack={() => {}}
    />
  );
}

const meta = {
  title: "레이아웃/앱 헤더",
  component: AppHeaderStory,
  parameters: {
    docs: {
      description: {
        component: "반응형 헤더다. md 미만은 좁은 뷰, md 이상은 와이드뷰 기준으로 확인한다.",
      },
    },
  },
  args: {
    title: "ALINK",
    back: true,
    transparent: false,
    showLeftSlot: false,
    showRightSlot: true,
    titleAlign: "center",
  },
  argTypes: {
    title: { control: "text" },
    back: { control: "boolean" },
    transparent: { control: "boolean" },
    showLeftSlot: { control: "boolean" },
    showRightSlot: { control: "boolean" },
    titleAlign: { control: "inline-radio", options: ["center", "start"] },
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof AppHeaderStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BackButton: Story = {
  name: "뒤로가기",
};

export const Slots: Story = {
  name: "슬롯",
  args: {
    title: "저장한 링크",
    back: false,
    showLeftSlot: true,
    showRightSlot: true,
  },
};

export const TitleStart: Story = {
  name: "제목 왼쪽 정렬",
  args: {
    title: "아주 긴 폴더 이름이 오른쪽 아이콘 앞에서 말줄임되는지 확인하는 예시",
    titleAlign: "start",
  },
};
