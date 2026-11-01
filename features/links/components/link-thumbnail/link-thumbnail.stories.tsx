import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { LinkThumbnail } from "./link-thumbnail";

const meta = {
  title: "기능/링크/링크 이미지 칸",
  component: LinkThumbnail,
  args: {
    domain: "velog.io",
    thumbnailUrl: "https://picsum.photos/seed/alink-thumb/640/360",
  },
  decorators: [
    (Story) => (
      <View className="w-[320px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof LinkThumbnail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "대표 이미지",
};

export const VideoCard: Story = {
  name: "영상 (카드)",
  args: { domain: "youtube.com", isVideo: true, showVideoBadge: true },
};

export const VideoDetail: Story = {
  name: "영상 (상세, 재생 아이콘)",
  args: { domain: "youtube.com", isVideo: true, showHint: true, fallback: "domain" },
};

export const TallDetail: Story = {
  name: "세로 이미지 (상세, 칸에 맞춤)",
  args: {
    domain: "instagram.com",
    thumbnailUrl: "https://picsum.photos/seed/alink-tall/360/640",
    isVideo: true,
    showHint: true,
    fallback: "domain",
    fit: "auto",
  },
};

export const Favicon: Story = {
  name: "이미지 없음, 파비콘",
  args: { thumbnailUrl: null, faviconUrl: "https://picsum.photos/seed/alink-fav/64/64" },
};

export const DomainOnly: Story = {
  name: "이미지·파비콘 없음",
  args: { thumbnailUrl: null, faviconUrl: null },
};

export const DetailNoImage: Story = {
  name: "상세 이미지 없음 (도메인만)",
  args: { thumbnailUrl: null, showHint: true, fallback: "domain" },
};

export const Broken: Story = {
  name: "깨진 이미지",
  args: { thumbnailUrl: "https://example.invalid/broken.jpg" },
};

export const Loading: Story = {
  name: "불러오는 중",
  args: { loading: true },
};

export const Small: Story = {
  name: "작은 칸 (할 일 카드)",
  render: () => (
    <View className="flex-row gap-3">
      <LinkThumbnail
        domain="velog.io"
        size="small"
        thumbnailUrl="https://picsum.photos/seed/alink-small/64/64"
      />
      <LinkThumbnail
        domain="velog.io"
        faviconUrl="https://picsum.photos/seed/alink-fav/64/64"
        size="small"
      />
      <LinkThumbnail
        domain="velog.io"
        size="small"
      />
    </View>
  ),
};
