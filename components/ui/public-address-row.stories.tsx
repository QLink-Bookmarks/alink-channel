import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { PublicAddressRow } from "./public-address-row";
import { ToastViewport } from "./toast-viewport";

const meta = {
  title: "공통 UI/공개 주소 줄",
  component: PublicAddressRow,
  decorators: [
    (Story) => (
      <View className="min-h-52 items-center p-4">
        <View className="w-64">
          <Story />
        </View>
        <ToastViewport />
      </View>
    ),
  ],
} satisfies Meta<typeof PublicAddressRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Folder: Story = { args: { path: "/folders/12345678" } };
export const Link: Story = { args: { path: "/links/12345678" } };
