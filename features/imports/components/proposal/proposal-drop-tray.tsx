import * as React from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Portal } from "@rn-primitives/portal";

import {
  useDragScrollContainer,
  useDropTarget,
  useIsDropOver,
  useLinkDragStore,
} from "../../hooks/use-link-drag";
import { toLinkTitle } from "../../lib/build-import-candidates";
import type { ProposalTarget } from "../../lib/proposal-state";
import { FolderEmoji, PlusBadge } from "./proposal-folder-list";
import type { ProposalFolderEntries } from "./proposal-folders";

import { Inbox } from "lucide-react-native/icons";

const FIXED_FILL = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 60,
} as unknown as React.ComponentProps<typeof View>["style"];
const TRAY_HEIGHT_RATIO = 0.55;
const DRAG_LAYER_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483000,
} as unknown as React.ComponentProps<typeof View>["style"];

function getDropText(name: string) {
  const code = name.trim().codePointAt(name.trim().length - 1) ?? 0;
  const final = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : -1;
  return `${name}${final > 0 && final !== 8 ? "으로" : "로"} 옮겨요`;
}

function DragCard() {
  const link = useLinkDragStore((state) => state.link);
  const x = useLinkDragStore((state) => state.x);
  const y = useLinkDragStore((state) => state.y);
  const over = useLinkDragStore((state) => state.over);
  if (!link) {
    return null;
  }
  const isBlocked = over?.kind === "shared";
  const hint = isBlocked
    ? "공유 폴더에는 넣을 수 없어요"
    : over && over.target !== link.target
      ? getDropText(over.name)
      : "옮길 폴더 위에 놓아 주세요";
  return (
    <View
      pointerEvents="none"
      style={
        {
          position: "fixed",
          left: x + 12,
          top: y + 10,
          zIndex: 70,
          maxWidth: 280,
        } as unknown as React.ComponentProps<typeof View>["style"]
      }
    >
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg"
        testID="import-drag-card"
      >
        <PlusBadge />
        <View className="min-w-0 shrink gap-0.5">
          <Text
            className="text-sm font-semibold text-foreground"
            numberOfLines={1}
          >
            {toLinkTitle(link.title, link.url)}
          </Text>
          <Text
            className={cn(
              "text-xs font-medium",
              isBlocked ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {hint}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TrayTile({
  target,
  name,
  leading,
}: {
  target: ProposalTarget;
  name: string;
  leading: React.ReactNode;
}) {
  const ref = useDropTarget({ id: `tray:${target}`, kind: "folder", target, name });
  const isOver = useIsDropOver(`tray:${target}`);
  return (
    <View
      ref={ref}
      accessibilityLabel={name}
      className={cn(
        "min-h-12 w-[48%] flex-row items-center gap-2 rounded-xl border bg-card px-3",
        isOver ? "border-primary bg-accent" : "border-border",
      )}
    >
      {leading}
      <Text
        className="min-w-0 flex-1 text-sm text-foreground"
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

function TraySection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
      <View className="flex-row flex-wrap justify-between gap-y-2">{children}</View>
    </View>
  );
}

function ProposalDropTray({ entries }: { entries: ProposalFolderEntries }) {
  const link = useLinkDragStore((state) => state.link);
  const scrollRef = useDragScrollContainer();
  const { height } = useWindowDimensions();
  if (!link) {
    return null;
  }
  return (
    <View
      className="rounded-t-3xl border-t border-border bg-background shadow-lg"
      style={[FIXED_FILL, { maxHeight: Math.round(height * TRAY_HEIGHT_RATIO) }]}
      testID="import-drop-tray"
    >
      <View className="px-4 pb-2 pt-4">
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={1}
          testID="import-drop-tray-title"
        >
          {toLinkTitle(link.title, link.url)}
        </Text>
      </View>
      <ScrollView
        ref={scrollRef}
        className="min-h-0"
        contentContainerClassName="gap-4 px-4 pb-8 pt-2"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="flex-row">
          <TrayTile
            leading={
              <Icon
                as={Inbox}
                className="size-[18px] text-muted-foreground"
              />
            }
            name="미분류"
            target={entries.unfiled.target}
          />
        </View>
        {entries.mine.length > 0 ? (
          <TraySection label="내 폴더">
            {entries.mine.map((entry) => (
              <TrayTile
                key={entry.target}
                leading={<FolderEmoji emoji={entry.folder.emoji} />}
                name={entry.folder.name}
                target={entry.target}
              />
            ))}
          </TraySection>
        ) : null}
        {entries.added.length > 0 ? (
          <TraySection label="새 폴더">
            {entries.added.map((entry) => (
              <TrayTile
                key={entry.target}
                leading={<PlusBadge />}
                name={entry.folder.name}
                target={entry.target}
              />
            ))}
          </TraySection>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ProposalDragLayer({
  entries,
  isWide,
}: {
  entries: ProposalFolderEntries;
  isWide: boolean;
}) {
  const isActive = useLinkDragStore((state) => state.link != null);
  if (!isActive) {
    return null;
  }
  const layer = (
    <View
      pointerEvents="box-none"
      style={DRAG_LAYER_STYLE}
    >
      {isWide ? null : <ProposalDropTray entries={entries} />}
      <DragCard />
    </View>
  );
  return isWide ? layer : <Portal name="import-link-drag">{layer}</Portal>;
}

export { ProposalDragLayer };
