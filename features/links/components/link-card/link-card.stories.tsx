import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { mapTodoCounts } from "@/features/home/lib/link-card-mapper";
import type { Meta, StoryObj } from "@storybook/react-native";

import { LinkCard } from "./link-card";
import { LinkCardSkeleton } from "./link-card-skeleton";

import { ExternalLink, FolderOpen, Star, Trash2 } from "lucide-react-native/icons";

const SAMPLE_IMAGE = "https://picsum.photos/seed/alink-card/640/360";

function HoverIconButton({
  icon,
  destructive,
}: {
  icon: typeof ExternalLink;
  destructive?: boolean;
}) {
  return (
    <Pressable className="size-7 items-center justify-center rounded-lg web:hover:bg-accent">
      <Icon
        as={icon}
        size={13}
        className={destructive ? "text-destructive" : "text-foreground"}
      />
    </Pressable>
  );
}

function StarBadge({ on }: { on: boolean }) {
  return (
    <View className="size-6 items-center justify-center rounded-full border border-border bg-card">
      <Icon
        as={Star}
        size={12}
        fill={on ? "currentColor" : "none"}
        className={on ? "text-warning" : "text-muted-foreground"}
      />
    </View>
  );
}

const meta = {
  title: "기능/링크/링크 카드",
  component: LinkCard,
  args: {
    domain: "velog.io",
    title: "TanStack Query v5 마이그레이션 정리",
    tags: ["React Query", "프론트엔드"],
    thumbnailUrl: SAMPLE_IMAGE,
    todoCounts: mapTodoCounts({ open: 3, dueSoon: 1, overdue: 1, completed: 1 }),
  },
  decorators: [
    (Story) => (
      <View className="w-[260px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof LinkCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const Video: Story = {
  name: "영상",
  args: {
    domain: "youtube.com",
    title: "Reanimated 3로 만드는 60fps 제스처 애니메이션",
    isVideo: true,
    bookmarkPinned: true,
    bookmarkHoverAction: <StarBadge on />,
  },
};

export const NoImage: Story = {
  name: "이미지 없음 (파비콘·도메인)",
  args: {
    thumbnailUrl: null,
    faviconUrl: "https://picsum.photos/seed/alink-favicon/64/64",
    todoCounts: null,
  },
};

export const DomainOnly: Story = {
  name: "이미지·파비콘 없음",
  args: {
    domain: "notion.so",
    title: "2026 하반기 팀 온보딩 문서",
    thumbnailUrl: null,
    statusLabel: "AI 생성 중...",
    statusVariant: "progress",
    todoCounts: mapTodoCounts({ open: 0, dueSoon: 0, overdue: 0, completed: 2 }),
  },
};

export const BrokenImage: Story = {
  name: "깨진 이미지",
  args: {
    domain: "brunch.co.kr",
    title: "기록하는 습관이 바꾼 것들",
    thumbnailUrl: "https://example.invalid/broken.jpg",
    statusLabel: "gpt-4o-mini 생성 실패",
    statusVariant: "error",
  },
};

export const Hover: Story = {
  name: "와이드 호버 액션",
  args: {
    active: true,
    bookmarkHoverAction: <StarBadge on={false} />,
    trailingHoverActions: (
      <>
        <HoverIconButton icon={ExternalLink} />
        <HoverIconButton icon={FolderOpen} />
        <HoverIconButton
          destructive
          icon={Trash2}
        />
      </>
    ),
  },
};

export const LongContent: Story = {
  name: "긴 제목·많은 태그",
  args: {
    title:
      "expo/expo: An open-source framework for making universal native apps with React, which runs on Android, iOS, and the web",
    tags: ["Expo", "React Native", "크로스플랫폼", "오픈소스", "모바일", "웹"],
  },
};

export const Skeleton: Story = {
  name: "불러오는 중",
  render: () => <LinkCardSkeleton />,
};
