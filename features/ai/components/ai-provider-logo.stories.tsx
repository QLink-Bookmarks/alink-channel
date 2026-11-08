import { View } from "react-native";

import { Text } from "@/components/ui/text";
import type { Meta, StoryObj } from "@storybook/react-native";

import type { AiProviderKind } from "../lib/provider-kind";
import { AiProviderLogo } from "./ai-provider-logo";

const KINDS: AiProviderKind[] = ["gemini", "claude", "openai"];

const meta = {
  title: "AI/제공자 로고",
  component: AiProviderLogo,
  args: {
    kind: "gemini",
    size: "md",
  },
  argTypes: {
    kind: { control: "select", options: KINDS },
    size: { control: "select", options: ["sm", "md"] },
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof AiProviderLogo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const AllProviders: Story = {
  name: "제공자 모음",
  render: () => (
    <View className="gap-3">
      {KINDS.map((kind) => (
        <AiProviderLogo
          key={kind}
          kind={kind}
        />
      ))}
    </View>
  ),
};

export const WithDefaultTag: Story = {
  name: "기본 제공자 표시",
  render: () => (
    <AiProviderLogo kind="gemini">
      <Text className="text-xs text-muted-foreground">기본</Text>
    </AiProviderLogo>
  ),
};

export const WithModel: Story = {
  name: "모델 이름과 함께 (작게)",
  render: () => (
    <View className="gap-3">
      {(
        [
          ["gemini", "gemini-2.5-flash"],
          ["claude", "claude-sonnet-4-5"],
          ["openai", "gpt-4o-mini"],
        ] as const
      ).map(([kind, model]) => (
        <AiProviderLogo
          key={kind}
          kind={kind}
          nameClassName="text-xs text-muted-foreground"
          size="sm"
        >
          <Text
            className="min-w-0 shrink text-xs text-muted-foreground"
            numberOfLines={1}
          >
            {`· ${model}`}
          </Text>
        </AiProviderLogo>
      ))}
    </View>
  ),
};
