import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LinkShareSurface } from "./link-share-surface";

const queryClient = new QueryClient();

const meta = {
  title: "링크/내 링크 페이지 공유",
  component: LinkShareSurface,
  args: {
    mode: "panel",
    linkId: 137,
    folderId: null,
    url: "https://example.org/articles/jeju",
    isOwner: true,
    isPublic: false,
    pending: false,
    failed: false,
    onChange: async () => {},
    onShare: () => {},
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <View className="min-h-72 p-4">
          <Story />
        </View>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof LinkShareSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Restricted: Story = {};
export const UnknownVisibility: Story = { args: { isPublic: undefined } };
export const AnotherOwner: Story = { args: { isOwner: false } };
