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
import { formatNumber } from "../../lib/split-import-ranges";
import { getRoParticle } from "./proposal-copy";
import { FolderEmoji, PlusBadge, UNFILED_EMOJI } from "./proposal-folder-list";
import type { ProposalFolderEntries } from "./proposal-folders";

import { Clock } from "lucide-react-native/icons";

const FIXED_FILL = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 60,
} as unknown as React.ComponentProps<typeof View>["style"];
const TRAY_HEIGHT_RATIO = 0.55;
const DRAG_CARD_MAX_WIDTH = 280;
const DRAG_CARD_EDGE = 8;
const DRAG_LAYER_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483000,
} as unknown as React.ComponentProps<typeof View>["style"];

function getDropText(name: string) {
  return `${name}${getRoParticle(name)} 옮겨요`;
}

function DragCard() {
  const link = useLinkDragStore((state) => state.link);
  const x = useLinkDragStore((state) => state.x);
  const y = useLinkDragStore((state) => state.y);
  const over = useLinkDragStore((state) => state.over);
  const { width } = useWindowDimensions();
  if (!link) {
    return null;
  }
  const cardWidth = Math.min(DRAG_CARD_MAX_WIDTH, width - DRAG_CARD_EDGE * 2);
  const left = Math.max(DRAG_CARD_EDGE, Math.min(x + 12, width - DRAG_CARD_EDGE - cardWidth));
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
          left,
          top: y + 10,
          zIndex: 70,
          maxWidth: cardWidth,
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
  id,
  target,
  name,
  leading,
  isCurrent,
}: {
  id: string;
  target: ProposalTarget;
  name: string;
  leading: React.ReactNode;
  isCurrent: boolean;
}) {
  const ref = useDropTarget({ id, kind: "folder", target, name });
  const isOver = useIsDropOver(id);
  return (
    <View
      ref={ref}
      accessibilityLabel={name}
      className={cn(
        "h-10 w-[48.5%] flex-row items-center gap-2 rounded-xl border bg-card px-2.5",
        isOver ? "border-primary bg-accent" : "border-border",
        isCurrent && !isOver && "opacity-50",
      )}
      testID="import-drop-tray-tile"
    >
      {leading}
      <Text
        className={cn("min-w-0 flex-1 text-sm text-foreground", isOver && "font-semibold")}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

function TraySection({
  label,
  count,
  icon,
  children,
}: {
  label: string;
  count?: number;
  icon?: React.ComponentProps<typeof Icon>["as"];
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        {icon ? (
          <Icon
            as={icon}
            className="size-3.5 text-muted-foreground"
          />
        ) : null}
        <Text
          accessibilityRole="header"
          className="flex-1 text-xs font-semibold text-muted-foreground"
        >
          {label}
        </Text>
        {count != null ? (
          <Text className="text-xs text-muted-foreground">{formatNumber(count)}개</Text>
        ) : null}
      </View>
      <View className="flex-row flex-wrap justify-between gap-y-1.5">{children}</View>
    </View>
  );
}

type TrayProps = {
  entries: ProposalFolderEntries;
  recentTargets: readonly ProposalTarget[];
  nameOf: (target: ProposalTarget) => string;
};

function ProposalDropTray({ entries, recentTargets, nameOf }: TrayProps) {
  const link = useLinkDragStore((state) => state.link);
  const scrollRef = useDragScrollContainer();
  const { height } = useWindowDimensions();
  if (!link) {
    return null;
  }
  const leadingOf = (target: ProposalTarget) => {
    if (target === entries.unfiled.target) {
      return <FolderEmoji emoji={UNFILED_EMOJI} />;
    }
    const mine = entries.mine.find((entry) => entry.target === target);
    return <FolderEmoji emoji={mine?.folder.emoji} />;
  };
  const recent = recentTargets.filter((target) => target !== link.target).slice(0, 2);
  return (
    <View
      className="rounded-t-3xl border-t border-border bg-background shadow-lg"
      style={[FIXED_FILL, { maxHeight: Math.round(height * TRAY_HEIGHT_RATIO) }]}
      testID="import-drop-tray"
    >
      <View className="px-4 pb-1 pt-4">
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={1}
          testID="import-drop-tray-title"
        >
          ‘{toLinkTitle(link.title, link.url)}’ 옮기기
        </Text>
      </View>
      <ScrollView
        ref={scrollRef}
        className="min-h-0"
        contentContainerClassName="gap-4 px-4 pb-8 pt-2"
        contentInsetAdjustmentBehavior="automatic"
      >
        {recent.length > 0 ? (
          <TraySection
            icon={Clock}
            label="최근 옮긴 곳"
          >
            {recent.map((target) => (
              <TrayTile
                key={target}
                id={`tray-recent:${target}`}
                isCurrent={false}
                leading={leadingOf(target)}
                name={nameOf(target)}
                target={target}
              />
            ))}
          </TraySection>
        ) : null}
        <TraySection label={entries.mine.length > 0 ? "미분류 · 내 폴더" : "미분류"}>
          <TrayTile
            id={`tray:${entries.unfiled.target}`}
            isCurrent={link.target === entries.unfiled.target}
            leading={leadingOf(entries.unfiled.target)}
            name="미분류"
            target={entries.unfiled.target}
          />
          {entries.mine.map((entry) => (
            <TrayTile
              key={entry.target}
              id={`tray:${entry.target}`}
              isCurrent={link.target === entry.target}
              leading={leadingOf(entry.target)}
              name={entry.folder.name}
              target={entry.target}
            />
          ))}
        </TraySection>
        {entries.added.length > 0 ? (
          <TraySection
            count={entries.added.length}
            label="새 폴더"
          >
            {entries.added.map((entry) => (
              <TrayTile
                key={entry.target}
                id={`tray:${entry.target}`}
                isCurrent={link.target === entry.target}
                leading={leadingOf(entry.target)}
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
  recentTargets,
  nameOf,
  isWide,
}: TrayProps & { isWide: boolean }) {
  const isActive = useLinkDragStore((state) => state.link != null);
  if (!isActive) {
    return null;
  }
  const layer = (
    <View
      pointerEvents="box-none"
      style={DRAG_LAYER_STYLE}
    >
      {isWide ? null : (
        <ProposalDropTray
          entries={entries}
          nameOf={nameOf}
          recentTargets={recentTargets}
        />
      )}
      <DragCard />
    </View>
  );
  return isWide ? layer : <Portal name="import-link-drag">{layer}</Portal>;
}

export { ProposalDragLayer };
