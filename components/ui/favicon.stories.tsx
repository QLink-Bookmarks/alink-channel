import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { Favicon } from "./favicon";

const meta = {
  title: "공통 UI/파비콘",
  component: Favicon,
  args: {
    fallback: "Q",
    size: "md",
    shape: "rounded",
    url: undefined,
  },
  argTypes: {
    fallback: { control: "text" },
    size: { control: "select", options: ["sm", "md", "lg"] },
    shape: { control: "select", options: ["rounded", "circle"] },
    url: { control: "text" },
  },
  decorators: [
    (Story) => (
      <View className="flex-row gap-3 p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Favicon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Gallery: Story = {
  name: "갤러리",
  render: () => (
    <>
      <Favicon fallback="Q" />
      <Favicon
        fallback="L"
        shape="circle"
      />
      <Favicon
        fallback="XL"
        size="lg"
      />
    </>
  ),
};

export const Broken: Story = {
  name: "깨진 이미지 (글자로 대체)",
  args: {
    url: "https://example.invalid/favicon.png",
    fallback: "N",
  },
};
