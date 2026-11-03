import * as React from "react";
import { View } from "react-native";

import type { FolderSection } from "@/stores/folder-navigation";
import type { Meta, StoryObj } from "@storybook/react-native";

import { FOLDER_SECTION_LABELS, FolderSectionHeader } from "./folder-section-header";

const meta = {
  title: "기능/폴더/섹션 제목줄",
  component: FolderSectionHeader,
  args: {
    section: "mine",
    label: FOLDER_SECTION_LABELS.mine,
    isOpen: true,
    canAdd: true,
    size: "compact",
    shadow: null,
    hasDivider: false,
    onToggle: () => {},
    onAddPress: () => {},
  },
  argTypes: {
    section: { control: "select", options: ["mine", "shared"] },
    canAdd: { control: "boolean" },
    size: { control: "select", options: ["compact", "large"] },
    tone: { control: "select", options: ["sidebar", "surface"] },
    shadow: { control: "select", options: [null, "top", "bottom"] },
  },
  decorators: [
    (Story) => (
      <View className="w-72 bg-sidebar p-3">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof FolderSectionHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
};

function AccordionPreview() {
  const [openSection, setOpenSection] = React.useState<FolderSection | null>("mine");
  const handleToggle = (section: FolderSection) =>
    setOpenSection((current) => (current === section ? null : section));
  return (
    <View>
      <FolderSectionHeader
        isOpen={openSection === "mine"}
        label={FOLDER_SECTION_LABELS.mine}
        section="mine"
        shadow={openSection === "mine" ? "top" : null}
        onAddPress={() => {}}
        onToggle={handleToggle}
      />
      <FolderSectionHeader
        hasDivider
        isOpen={openSection === "shared"}
        label={FOLDER_SECTION_LABELS.shared}
        section="shared"
        shadow={openSection === "mine" ? "bottom" : null}
        onAddPress={() => {}}
        onToggle={handleToggle}
      />
    </View>
  );
}

export const Accordion: Story = {
  name: "한 섹션만 열림",
  render: () => <AccordionPreview />,
};

function CurrentFolderPathPreview() {
  const [openSection, setOpenSection] = React.useState<FolderSection | null>("shared");
  const handleToggle = (section: FolderSection) =>
    setOpenSection((current) => (current === section ? null : section));
  return (
    <View>
      <FolderSectionHeader
        currentFolder={{
          name: "2027 교토·오사카 여행 준비 체크리스트와 숙소 후보",
          emoji: "🧳",
        }}
        isOpen={openSection === "mine"}
        label={FOLDER_SECTION_LABELS.mine}
        section="mine"
        onAddPress={() => {}}
        onToggle={handleToggle}
      />
      <FolderSectionHeader
        hasDivider
        isOpen={openSection === "shared"}
        label={FOLDER_SECTION_LABELS.shared}
        section="shared"
        onAddPress={() => {}}
        onToggle={handleToggle}
      />
    </View>
  );
}

export const CurrentFolderPath: Story = {
  name: "접힌 섹션의 현재 폴더 경로",
  render: () => <CurrentFolderPathPreview />,
};

export const Large: Story = {
  name: "모바일 크기",
  args: { size: "large", section: "shared", label: FOLDER_SECTION_LABELS.shared, isOpen: false },
};

export const Surface: Story = {
  name: "폴더 선택 목록",
  args: { tone: "surface", section: "mine", label: FOLDER_SECTION_LABELS.mine, isOpen: true },
  decorators: [
    (Story) => (
      <View className="w-80 rounded-2xl bg-popover p-3">
        <Story />
      </View>
    ),
  ],
};

export const LargeSurface: Story = {
  name: "폴더 선택 시트",
  args: {
    size: "large",
    tone: "surface",
    section: "mine",
    label: FOLDER_SECTION_LABELS.mine,
    isOpen: true,
    hasDivider: true,
  },
  decorators: [
    (Story) => (
      <View className="w-[390px] bg-card p-3">
        <Story />
      </View>
    ),
  ],
};

export const WithoutAdd: Story = {
  name: "추가 버튼 없는 섹션",
  args: { tone: "surface", section: "existing", label: "내 폴더", isOpen: true, canAdd: false },
  decorators: [
    (Story) => (
      <View className="w-80 rounded-2xl bg-popover p-3">
        <Story />
      </View>
    ),
  ],
};
