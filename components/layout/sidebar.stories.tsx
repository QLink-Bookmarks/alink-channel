import { View } from "react-native";

import { BrandHeader } from "@/components/layout/brand-header";
import { Text } from "@/components/ui/text";
import type { Meta, StoryObj } from "@storybook/react-native";

import {
  Sidebar,
  SidebarCTA,
  SidebarItem,
  SidebarProfile,
  SidebarRail,
  SidebarRailCTA,
  SidebarRailItem,
  SidebarRailSeparator,
  SidebarRailTooltip,
  SidebarSection,
} from "./sidebar";

import {
  BookCopy,
  Folder,
  House,
  Link,
  Menu,
  Palette,
  Plus,
  SquareCheck,
  Users,
} from "lucide-react-native/icons";
import { useArgs } from "storybook/preview-api";

type SidebarStoryArgs = {
  activeItem: "home" | "links" | "design";
};

function SidebarContent({
  activeItem,
  onActiveItemChange,
}: SidebarStoryArgs & {
  onActiveItemChange: (activeItem: SidebarStoryArgs["activeItem"]) => void;
}) {
  return (
    <Sidebar className="flex">
      <BrandHeader />
      <SidebarCTA
        label="링크 추가"
        className="mt-3"
      />
      <View className="mt-4 gap-1">
        <SidebarItem
          icon={House}
          label="홈"
          active={activeItem === "home"}
          onPress={() => onActiveItemChange("home")}
        />
        <SidebarItem
          icon={Link}
          label="링크"
          count={12}
          active={activeItem === "links"}
          onPress={() => onActiveItemChange("links")}
        />
      </View>
      <SidebarSection
        title="폴더"
        actionLabel="새로 만들기"
      >
        <SidebarItem
          icon={Folder}
          label="디자인"
          active={activeItem === "design"}
          onPress={() => onActiveItemChange("design")}
        />
        <View className="rounded-xl border border-sidebar-border bg-sidebar-accent p-3">
          <Text className="text-xs font-semibold text-sidebar-accent-foreground">
            토큰 accent 확인
          </Text>
          <Text className="text-xs text-sidebar-foreground">
            Storybook toolbar의 강조 색상을 바꾸면 sidebar token이 함께 바뀐다.
          </Text>
        </View>
      </SidebarSection>
      <View className="mt-auto">
        <SidebarProfile
          name="Injae Song"
          email="injae@example.com"
        />
      </View>
    </Sidebar>
  );
}

const meta = {
  title: "레이아웃/사이드바",
  parameters: {
    docs: {
      description: {
        component: "와이드뷰 전용 사이드 내비게이션이다. md 이상에서 사용한다.",
      },
    },
  },
  args: {
    activeItem: "home",
  },
  argTypes: {
    activeItem: { control: "select", options: ["home", "links", "design"] },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    return (
      <SidebarContent
        activeItem={args.activeItem}
        onActiveItemChange={(activeItem) => updateArgs({ activeItem })}
      />
    );
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<SidebarStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

export const FolderRows: Story = {
  name: "폴더 행",
  render: () => (
    <Sidebar className="flex gap-1">
      <SidebarItem
        accessibilityLabel="읽을거리, 링크 12개"
        count={12}
        emoji="📚"
        label="읽을거리"
      />
      <SidebarItem
        active
        accessibilityLabel="2027 교토·오사카 여행 준비 체크리스트와 숙소 후보, 링크 8개"
        count={8}
        emoji="✈️"
        label="2027 교토·오사카 여행 준비 체크리스트와 숙소 후보"
      />
      <SidebarItem
        accessibilityLabel="가족 여행 2026 여름 제주 일정과 맛집 지도, 링크 31개, 6명 참여"
        count={31}
        emoji="🏖️"
        label="가족 여행 2026 여름 제주 일정과 맛집 지도"
        meta="6명 참여"
      />
      <SidebarItem
        accessibilityLabel="미분류, 링크 100+개"
        count="100+"
        emoji="🗂️"
        label="미분류"
      />
    </Sidebar>
  ),
};

export const Rail: Story = {
  name: "줄인 상태",
  render: () => (
    <View className="h-[640px]">
      <SidebarRail className="flex">
        <View className="flex-1 items-center gap-1.5 px-2 py-3">
          <SidebarRailItem
            aria-expanded={false}
            icon={Menu}
            label="사이드바 펼치기"
          />
          <SidebarRailTooltip
            label="새 링크"
            shortcut="⌥N"
          >
            <SidebarRailCTA
              accessibilityLabel="새 링크, 단축키 ⌥N"
              icon={Plus}
            />
          </SidebarRailTooltip>
          <SidebarRailItem
            active
            icon={House}
            label="홈"
          />
          <SidebarRailItem
            icon={BookCopy}
            label="전체"
          />
          <SidebarRailItem
            icon={SquareCheck}
            label="할일"
          />
          <SidebarRailSeparator />
          <SidebarRailItem
            accessibilityLabel="내 폴더 목록"
            icon={Folder}
            label="내 폴더"
          />
          <SidebarRailItem
            accessibilityLabel="공유 폴더 목록"
            icon={Users}
            label="공유 폴더"
          />
          <SidebarRailSeparator />
          <SidebarRailItem
            accessibilityLabel="미분류, 링크 12개"
            emoji="🗂️"
            label="미분류"
            shortcut="12"
          />
          <SidebarRailItem
            active
            accessibilityLabel="2027 교토·오사카 여행 준비 체크리스트와 숙소 후보, 선택된 폴더"
            emoji="✈️"
            label="2027 교토·오사카 여행 준비 체크리스트와 숙소 후보"
          />
          <View className="flex-1" />
          <SidebarRailItem
            accessibilityLabel="모드와 강조색"
            icon={Palette}
            label="모드 · 강조색"
          />
        </View>
      </SidebarRail>
    </View>
  ),
};
