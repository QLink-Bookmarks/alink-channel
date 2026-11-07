import * as React from "react";
import { View } from "react-native";
import { Easing, useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { type AccentName, type ThemeMode } from "@/lib/theme";
import type { Meta, StoryObj } from "@storybook/react-native";

import { Sheet, SheetFooter, SheetHeader, useSheetMotion } from "./sheet";

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

/** SheetHeader: 제목·뒤로·닫기가 머리에 고정되고 본문만 스크롤된다 (#88) */
export const WithHeader: Story = {
  name: "고정 머리",
  args: {
    fitContent: true,
    title: "",
  },
  render: ({ open }, context) => (
    <Sheet
      open={open}
      fitContent
      maxDynamicContentSize={420}
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
      onOpenChange={() => {}}
    >
      <SheetHeader
        title="새 링크 추가"
        onBack={() => {}}
      />
      <LongContent />
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

function ContentFooterStory({ accent, mode }: Pick<SheetStoryProps, "accent" | "mode">) {
  const [step, setStep] = React.useState<"form" | "picker">("form");
  const [count, setCount] = React.useState(0);
  return (
    <Sheet
      open
      fitContent
      accent={accent}
      mode={mode}
      onOpenChange={() => {}}
    >
      {step === "form" ? (
        <>
          <Text className="text-base text-foreground">
            내용이 하단 줄을 채운다. 하위 단계로 가면 줄이 사라진다.
          </Text>
          <Button
            className="h-12"
            variant="outline"
            onPress={() => setStep("picker")}
          >
            <Text>하위 단계로</Text>
          </Button>
          <SheetFooter>
            <View className="flex-row gap-2">
              <Button
                className="h-12 flex-1 rounded-xl"
                variant="outline"
                onPress={() => setCount((value) => value + 1)}
              >
                <Text>저장 {count}</Text>
              </Button>
              <Button
                className="h-12 flex-[2] rounded-xl"
                variant="gradient"
              >
                <Text>AI 정리</Text>
              </Button>
            </View>
          </SheetFooter>
        </>
      ) : (
        <Button
          className="h-12"
          variant="outline"
          onPress={() => setStep("form")}
        >
          <Text>뒤로</Text>
        </Button>
      )}
    </Sheet>
  );
}

export const ContentFooter: Story = {
  name: "내용이 채우는 하단 줄",
  render: (_args, context) => (
    <ContentFooterStory
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
    />
  ),
};

function ClosedByCallerStory({ accent, mode }: Pick<SheetStoryProps, "accent" | "mode">) {
  const [open, setOpen] = React.useState(false);
  const [closeReports, setCloseReports] = React.useState(0);

  return (
    <View className="gap-3">
      <Button onPress={() => setOpen(true)}>
        <Text>시트 열기</Text>
      </Button>
      <Text className="text-muted-foreground">시트가 닫혔다고 알려준 횟수: {closeReports}</Text>
      <Sheet
        open={open}
        title="저장 버튼으로 닫는 시트"
        fitContent
        accent={accent}
        mode={mode}
        footer={
          <Button
            className="h-12"
            onPress={() => setOpen(false)}
          >
            <Text>저장</Text>
          </Button>
        }
        onOpenChange={(next) => {
          if (!next) {
            setCloseReports((count) => count + 1);
            setOpen(false);
          }
        }}
      >
        <Text className="text-muted-foreground">
          저장으로 닫으면 횟수가 그대로고, X·바깥 누르기·아래로 내리기로 닫으면 늘어난다.
        </Text>
      </Sheet>
    </View>
  );
}

export const ClosedByCaller: Story = {
  name: "코드로 닫기",
  render: (_args, context) => (
    <ClosedByCallerStory
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
    />
  ),
};

const RESIZE_TIMING = { duration: 240, easing: Easing.bezier(0.4, 0, 0.2, 1) };

function SheetMotionReadout() {
  const motion = useSheetMotion();
  const [label, setLabel] = React.useState("멈춰 있음");
  useAnimatedReaction(
    () => motion?.target.value ?? null,
    (target) => {
      scheduleOnRN(setLabel, target == null ? "멈춰 있음" : `${Math.round(target)}px로 바뀌는 중`);
    },
    [motion],
  );
  return <Text className="text-sm text-muted-foreground">시트: {label}</Text>;
}

function ResizeTimingStory({ accent, mode }: Pick<SheetStoryProps, "accent" | "mode">) {
  const [isLong, setIsLong] = React.useState(false);

  return (
    <Sheet
      open
      title="240ms로 크기를 바꾸는 시트"
      fitContent
      resizeTiming={RESIZE_TIMING}
      accent={accent}
      mode={mode}
      onOpenChange={() => {}}
    >
      <SheetMotionReadout />
      <Button
        variant="outline"
        onPress={() => setIsLong((value) => !value)}
      >
        <Text>{isLong ? "짧게" : "길게"}</Text>
      </Button>
      {isLong ? <LongContent /> : <ShortContent />}
    </Sheet>
  );
}

/** resizeTiming: 콘텐츠 높이가 바뀔 때 스프링 대신 240ms 타이밍으로 크기를 바꾼다. 안쪽에서는 useSheetMotion으로 시트가 향하는 위치를 읽는다. */
export const ResizeTiming: Story = {
  name: "크기 전환 타이밍",
  render: (_args, context) => (
    <ResizeTimingStory
      accent={(context.globals.accent ?? "gray") as AccentName}
      mode={(context.globals.mode ?? "light") as ThemeMode}
    />
  ),
};
