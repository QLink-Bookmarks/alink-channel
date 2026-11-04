import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { NotificationCard } from "./notification-card";

const unreadNotification = {
  id: 1,
  title: "액션 알림",
  message: "자기소개서 초안 작성 시간이 다가왔어요. 링크 상세에서 액션을 확인해보세요.",
  firedAt: "2026-06-10T09:30:00Z",
  readAt: null,
  context: "TODO",
  contextId: 42,
} as const;

const readNotification = {
  ...unreadNotification,
  id: 2,
  title: "포트폴리오 제출 전 확인",
  message: "포트폴리오 PDF 첨부 액션을 확인할 시간이에요.",
  firedAt: "2026-06-09T15:10:00Z",
  readAt: "2026-06-09T15:20:00Z",
  contextId: 43,
} as const;

const meta = {
  title: "기능/알림/알림 카드",
  component: NotificationCard,
  args: {
    notification: unreadNotification,
  },
  decorators: [
    (Story) => (
      <View className="w-full max-w-2xl p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof NotificationCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unread: Story = {
  name: "안읽음",
};

export const Read: Story = {
  name: "읽음",
  args: {
    notification: readNotification,
  },
};

export const States: Story = {
  name: "상태",
  render: () => (
    <View className="gap-3">
      <NotificationCard notification={unreadNotification} />
      <NotificationCard notification={readNotification} />
    </View>
  ),
};
