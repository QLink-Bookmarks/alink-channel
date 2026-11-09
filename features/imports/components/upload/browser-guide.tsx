import * as React from "react";
import { View } from "react-native";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";

type GuidePart = string | { menu: string };

type GuideBrowser = "chrome" | "edge";

const GUIDE_STEPS: Record<GuideBrowser, GuidePart[][]> = {
  chrome: [
    [
      "주소창 오른쪽 ",
      { menu: "⋮" },
      " 메뉴에서 ",
      { menu: "북마크 및 목록" },
      " → ",
      { menu: "북마크 관리자" },
      "를 열어요.",
    ],
    ["북마크 관리자 오른쪽 위 ", { menu: "⋮" }, " → ", { menu: "북마크 내보내기" }, "를 눌러요."],
    ["저장된 ", { menu: "bookmarks_날짜.html" }, " 파일을 아래에 올려요."],
  ],
  edge: [
    ["주소창 오른쪽 ", { menu: "☆≡" }, " 즐겨찾기 버튼을 눌러요."],
    [{ menu: "⋯" }, " → ", { menu: "즐겨찾기 내보내기" }, "를 눌러요."],
    ["저장된 ", { menu: "즐겨찾기_날짜.html" }, " 파일을 아래에 올려요."],
  ],
};

function GuideSteps({ browser }: { browser: GuideBrowser }) {
  return (
    <View
      accessibilityRole="list"
      className="gap-2"
    >
      {GUIDE_STEPS[browser].map((parts, index) => (
        <View
          key={index}
          className="flex-row items-start gap-2.5"
        >
          <View className="mt-px size-5 items-center justify-center rounded-full bg-muted">
            <Text className="text-[11px] font-semibold text-muted-foreground">{index + 1}</Text>
          </View>
          <Text className="min-w-0 flex-1 text-sm leading-6 text-foreground">
            {parts.map((part, partIndex) =>
              typeof part === "string" ? (
                part
              ) : (
                <Text
                  key={partIndex}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
                >
                  {part.menu}
                </Text>
              ),
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BrowserGuide() {
  const [browser, setBrowser] = React.useState<GuideBrowser>("chrome");

  return (
    <Tabs
      className="gap-3"
      value={browser}
      onValueChange={(value) => setBrowser(value as GuideBrowser)}
    >
      <TabsList className="h-10 self-start rounded-xl">
        <TabsTrigger
          className="h-full rounded-lg px-3"
          value="chrome"
        >
          <Text>Chrome · Whale</Text>
        </TabsTrigger>
        <TabsTrigger
          className="h-full rounded-lg px-3"
          value="edge"
        >
          <Text>Edge</Text>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="chrome">
        <GuideSteps browser="chrome" />
      </TabsContent>
      <TabsContent value="edge">
        <GuideSteps browser="edge" />
      </TabsContent>
    </Tabs>
  );
}

export { BrowserGuide };
