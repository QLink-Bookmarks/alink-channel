import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { TodoItem } from "./todo-item";

import { useArgs } from "storybook/preview-api";

const meta = {
  title: "기능/할 일/할 일 항목",
  component: TodoItem,
  args: {
    text: "ALINK 테마 토큰 검토",
    badge: "오늘",
    visibility: "public",
    done: false,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    return (
      <TodoItem
        {...args}
        onToggle={(done) => updateArgs({ done })}
      />
    );
  },
  decorators: [
    (Story) => (
      <View className="max-w-md gap-3 p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof TodoItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Display: Story = {
  name: "할 일 카드",
  render: (args) => (
    <>
      <TodoItem
        {...args}
        variant="display"
        text="useInfiniteQuery 적용 범위 정리"
        reminderLabel="10/29 23:00"
        linkUrl="https://velog.io/@devkim/tanstack-query-v5"
        linkTitle="TanStack Query v5 마이그레이션 정리"
        linkThumbnailUrl="https://picsum.photos/seed/alink-todo/64/64"
      />
      <TodoItem
        {...args}
        variant="display"
        overdue
        text="토요일 2시 방문"
        reminderLabel="10/25 14:00 (지남)"
        linkUrl="https://www.instagram.com/reel/C9seongsu"
        linkTitle="성수동 카페 투어 5곳"
      />
      <TodoItem
        {...args}
        variant="display"
        done
        text="queryKey 규칙 팀에 공유"
        linkUrl="https://velog.io/@devkim/tanstack-query-v5"
        linkTitle="TanStack Query v5 마이그레이션 정리"
      />
    </>
  ),
};

export const States: Story = {
  name: "상태",
  render: (args) => (
    <>
      <TodoItem {...args} />
      <TodoItem
        {...args}
        done
        text="완료된 할 일"
      />
      <TodoItem
        {...args}
        overdue
        badge="기한 초과"
        text="기한이 지난 할 일"
      />
    </>
  ),
};
