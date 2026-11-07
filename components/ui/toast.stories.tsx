import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { Toast } from "./toast";

type ToastStoryProps = {
  variant: "default" | "success" | "error" | "warning" | "gradient";
  title: string;
  description?: string;
  dismissible: boolean;
  showProgress: boolean;
  actionLabel?: string;
};

function ToastStory({
  variant,
  title,
  description,
  dismissible,
  showProgress,
  actionLabel,
}: ToastStoryProps) {
  return (
    <Toast
      actionLabel={actionLabel}
      showProgress={showProgress}
      variant={variant}
      title={title}
      description={description}
      onAction={actionLabel ? () => {} : undefined}
      onDismiss={dismissible ? () => {} : undefined}
    />
  );
}

const meta = {
  title: "공통 UI/토스트",
  component: ToastStory,
  args: {
    variant: "default",
    title: "저장됨",
    description: "링크가 저장되었다.",
    dismissible: true,
    showProgress: false,
    actionLabel: "",
  },
  argTypes: {
    variant: { control: "select", options: ["default", "success", "error", "warning", "gradient"] },
    title: { control: "text" },
    description: { control: "text" },
    dismissible: { control: "boolean" },
    showProgress: { control: "boolean" },
    actionLabel: { control: "text" },
  },
  decorators: [
    (Story) => (
      <View className="gap-3 p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ToastStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  name: "변형",
  render: (args) => <ToastStory {...args} />,
};

export const DefaultOnForeground: Story = {
  name: "기본 (짙은 면 위 밝은 글자)",
  args: {
    variant: "default",
    title: "저장에 실패했어요. 잠시 후 다시 시도해주세요",
    description: "",
    dismissible: false,
  },
  render: (args) => <ToastStory {...args} />,
};

export const DefaultWithActions: Story = {
  name: "기본 + 설명·액션·닫기·진행",
  args: {
    variant: "default",
    title: "저장에 실패했어요",
    description: "잠시 후 다시 시도해주세요",
    dismissible: true,
    showProgress: true,
    actionLabel: "다시 시도",
  },
  render: (args) => <ToastStory {...args} />,
};

export const AllVariants: Story = {
  name: "모든 변형",
  render: (args) => (
    <View className="gap-3">
      {(["default", "success", "error", "warning", "gradient"] as const).map((variant) => (
        <ToastStory
          key={variant}
          {...args}
          title={`${variant} 제목`}
          description="설명 줄"
          variant={variant}
        />
      ))}
    </View>
  ),
};
