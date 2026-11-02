import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { type AccentName, type ThemeMode } from "@/lib/theme";
import type { Meta, StoryObj } from "@storybook/react-native";

import { Sheet } from "./sheet";

type SheetStoryProps = {
  open: boolean;
  title: string;
  dismissible: boolean;
  fitContent: boolean;
  defaultSize: "30%" | "50%" | "80%";
  maxSize: "50%" | "80%" | "95%";
  accent: AccentName;
  mode: ThemeMode;
};

const meta = {
  title: "레이아웃/시트",
  component: SheetStory,
  parameters: {
    docs: {
      description: {
        component: "모바일 전용 바텀시트다. md 이상에서는 사용하지 않는다.",
      },
    },
  },
  args: {
    open: true,
    title: "시트 제목",
    dismissible: true,
    fitContent: true,
    defaultSize: "30%",
    maxSize: "80%",
    accent: "gray",
    mode: "light",
  },
  argTypes: {
    open: { control: "boolean" },
    dismissible: { control: "boolean" },
    fitContent: { control: "boolean" },
    title: { control: "text" },
    defaultSize: { control: "select", options: ["30%", "50%", "80%"] },
    maxSize: { control: "select", options: ["50%", "80%", "95%"] },
    accent: { table: { disable: true } },
    mode: { table: { disable: true } },
  },
  render: (args, context) => (
    <SheetStory
      {...args}
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
    />
  ),
  decorators: [
    (Story) => (
      <View className="h-[800px] p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof SheetStory>;

export default meta;

type Story = StoryObj<typeof meta>;

function ShortContent() {
  return (
    <Text className="text-muted-foreground">
      짧은 콘텐츠다. fitContent 모드에서는 이 높이에 딱 맞게 시트가 열린다.
    </Text>
  );
}

function LongContent() {
  return (
    <>
      <Text className="text-muted-foreground">
        긴 콘텐츠 예시다. 고정 크기 모드에서는 시트 안쪽에서 스크롤된다.
      </Text>
      {Array.from({ length: 8 }).map((_, index) => (
        <View
          key={index}
          className="rounded-xl border border-border-soft bg-surface-elevated p-3"
        >
          <Text className="font-medium">스크롤 콘텐츠 {index + 1}</Text>
          <Text className="text-sm text-muted-foreground">
            긴 콘텐츠에서도 패널 안쪽에서 스크롤되는지 확인하기 위한 항목이다.
          </Text>
        </View>
      ))}
    </>
  );
}

function SheetStory({
  open,
  title,
  dismissible,
  fitContent,
  defaultSize,
  maxSize,
  accent,
  mode,
}: SheetStoryProps) {
  return (
    <Sheet
      open={open}
      title={title}
      dismissible={dismissible}
      fitContent={fitContent}
      defaultSize={fitContent ? undefined : defaultSize}
      maxSize={fitContent ? undefined : maxSize}
      accent={accent}
      mode={mode}
      onOpenChange={() => {}}
    >
      <ShortContent />
    </Sheet>
  );
}

/** fitContent=true: 콘텐츠 높이에 맞게 자동 사이징 */
export const FitContent: Story = {
  name: "콘텐츠 맞춤",
  args: {
    fitContent: true,
    title: "콘텐츠 맞춤 시트",
  },
};

/** fitContent=false, defaultSize만: 단일 고정 스냅포인트 */
export const FixedSize: Story = {
  name: "고정 크기",
  args: {
    fitContent: false,
    defaultSize: "50%",
    maxSize: "50%",
    title: "고정 크기 시트",
  },
};

/** fitContent=false, defaultSize + maxSize: 두 스냅포인트 간 드래그 가능 */
export const FixedSizeWithMax: Story = {
  name: "고정 크기 (최대 포함)",
  args: {
    fitContent: false,
    defaultSize: "30%",
    maxSize: "80%",
    title: "스냅포인트 2개",
  },
};

/** fitContent=false, 큰 고정 크기 + 긴 콘텐츠: 내부 스크롤 확인 */
export const LongContentFixed: Story = {
  name: "긴 콘텐츠 (고정)",
  args: {
    fitContent: false,
    defaultSize: "50%",
    maxSize: "80%",
    title: "긴 콘텐츠 스크롤",
  },
  render: ({ open, title, dismissible, defaultSize, maxSize }, context) => (
    <Sheet
      open={open}
      title={title}
      dismissible={dismissible}
      fitContent={false}
      defaultSize={defaultSize}
      maxSize={maxSize}
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
      onOpenChange={() => {}}
    >
      <LongContent />
    </Sheet>
  ),
};

/** fitContent=true, dismissible=false: 배경 클릭해도 닫히지 않음 */
export const NotDismissible: Story = {
  name: "닫기 비활성",
  args: {
    fitContent: true,
    dismissible: false,
    title: "닫기 비활성 시트",
  },
  render: ({ open, title, dismissible }, context) => (
    <Sheet
      open={open}
      title={title}
      dismissible={dismissible}
      fitContent
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
      onOpenChange={() => {}}
    >
      <Text className="text-muted-foreground">이 상태에서는 배경을 눌러도 닫히지 않는다.</Text>
    </Sheet>
  ),
};

export const WithoutCloseButton: Story = {
  name: "닫기 버튼 없이",
  args: {
    fitContent: true,
    title: "아래 버튼으로 닫는 시트",
  },
  render: ({ open, title }, context) => (
    <Sheet
      open={open}
      title={title}
      fitContent
      hideCloseButton
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
      onOpenChange={() => {}}
    >
      <ShortContent />
    </Sheet>
  ),
};

export const WithFooter: Story = {
  name: "아래 고정 버튼 줄",
  args: {
    fitContent: true,
    title: "버튼 줄이 늘 보이는 시트",
  },
  render: ({ open, title }, context) => (
    <Sheet
      open={open}
      title={title}
      fitContent
      hideCloseButton
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
      footer={
        <View className="flex-row gap-2">
          <Button
            className="h-12 flex-1"
            variant="outline"
          >
            <Text>취소</Text>
          </Button>
          <Button className="h-12 flex-1">
            <Text>확인</Text>
          </Button>
        </View>
      }
      onOpenChange={() => {}}
    >
      <LongContent />
    </Sheet>
  ),
};
