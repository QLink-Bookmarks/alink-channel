import * as React from "react";
import { View } from "react-native";

import type { FolderSection } from "@/stores/folder-navigation";
import type { Meta, StoryObj } from "@storybook/react-native";

import { FolderSectionHeader } from "./folder-section-header";

const meta = {
  title: "기능/폴더/섹션 제목줄",
  component: FolderSectionHeader,
  args: {
    section: "mine",
    isOpen: true,
    size: "compact",
    shadow: null,
    hasDivider: false,
    onToggle: () => {},
    onAddPress: () => {},
  },
  argTypes: {
    section: { control: "select", options: ["mine", "shared"] },
    size: { control: "select", options: ["compact", "large"] },
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
        section="mine"
        shadow={openSection === "mine" ? "top" : null}
        onAddPress={() => {}}
        onToggle={handleToggle}
      />
      <FolderSectionHeader
        hasDivider
        isOpen={openSection === "shared"}
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

export const Large: Story = {
  name: "모바일 크기",
  args: { size: "large", section: "shared", isOpen: false },
};
