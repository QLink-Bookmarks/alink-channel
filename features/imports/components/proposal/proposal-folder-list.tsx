import * as React from "react";
import { Pressable, View } from "react-native";

import { Emoji } from "@/components/ui/emoji";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useUncategorizedCount } from "@/features/folders/hooks/use-uncategorized-count";
import { cn } from "@/lib/utils";

import {
  type DropTargetInfo,
  useDropTarget,
  useIsDropOver,
  useIsLinkDragActive,
} from "../../hooks/use-link-drag";
import { formatNumber } from "../../lib/split-import-ranges";
import type { ProposalFolderEntries, ProposalSelection } from "./proposal-folders";
import { isSameSelection } from "./proposal-folders";

import {
  Ban,
  ChevronRight,
  CircleSlash,
  Folder as FolderIcon,
  Link2,
  ListX,
  Pencil,
  Plus,
  Users,
} from "lucide-react-native/icons";

const UNFILED_EMOJI = "🗂️";
const SOFT_TEXT = "text-foreground/70";

type ProposalFolderListProps = {
  entries: ProposalFolderEntries;
  selection: ProposalSelection | null;
  skipCount: number;
  unsupportedCount: number;
  removedCount: number;
  isWide: boolean;
  onSelect: (selection: ProposalSelection) => void;
  onRename: (target: string) => void;
};

function PlusBadge({ isMuted = false }: { isMuted?: boolean }) {
  return (
    <View
      className={cn(
        "size-5 items-center justify-center rounded-md bg-success/15",
        isMuted && "opacity-40",
      )}
    >
      <Icon
        as={Plus}
        className="size-3 text-success"
        strokeWidth={3}
      />
    </View>
  );
}

function formatExistingCount(count: number | string) {
  if (typeof count === "number") {
    return `${formatNumber(count)}개`;
  }
  return count.endsWith("+") ? `${count.slice(0, -1)}개+` : `${count}개`;
}

function ExistingCount({ count }: { count: number | string | null | undefined }) {
  if (count == null) {
    return null;
  }
  return (
    <Text className={cn("text-xs tabular-nums", SOFT_TEXT)}>{formatExistingCount(count)}</Text>
  );
}

function AddCount({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }
  return (
    <Text className="text-[13px] font-bold tabular-nums text-success">+{formatNumber(count)}</Text>
  );
}

type FolderRowProps = {
  accessibilityLabel: string;
  leading: React.ReactNode;
  label: string;
  trailing: React.ReactNode;
  action?: React.ReactNode;
  isSelected: boolean;
  isMuted?: boolean;
  isWide: boolean;
  drop: DropTargetInfo | null;
  onPress: () => void;
};

function FolderRow({
  accessibilityLabel,
  leading,
  label,
  trailing,
  action,
  isSelected,
  isMuted = false,
  isWide,
  drop,
  onPress,
}: FolderRowProps) {
  const dropRef = useDropTarget(isWide ? drop : null);
  const isOver = useIsDropOver(drop?.id ?? "");
  const isDragActive = useIsLinkDragActive();
  const isTarget = isWide && isDragActive && drop?.kind === "folder";
  const isRefused = isOver && drop?.kind === "shared";
  const rowRef = React.useRef<View | null>(null);

  React.useEffect(() => {
    if (!isSelected || !isWide) {
      return;
    }
    const node = rowRef.current as unknown as HTMLElement | null;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected, isWide]);

  const setRefs = React.useCallback(
    (node: View | null) => {
      rowRef.current = node;
      dropRef(node);
    },
    [dropRef],
  );

  return (
    <View
      ref={setRefs}
      className={cn(
        "flex-row items-center rounded-xl border web:transition-colors web:motion-reduce:transition-none",
        isSelected && isWide ? "border-border bg-card" : "border-transparent",
        isTarget && "border-border bg-card",
        isOver && !isRefused && "border-primary bg-accent",
        isRefused && "border-dashed border-destructive/60 bg-destructive/5",
      )}
      testID={isRefused ? "import-folder-row-refused" : undefined}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        aria-selected={isSelected}
        className={cn(
          "min-h-11 min-w-0 flex-1 flex-row items-center gap-2.5 rounded-xl px-2.5 py-2",
          isWide ? "" : "min-h-14 px-3",
          action ? "pr-1" : "",
          !isSelected && !isOver && "active:bg-muted web:hover:bg-muted",
        )}
        onPress={onPress}
      >
        <View className="w-[52px] flex-row items-center justify-end gap-2">{leading}</View>
        <Text
          className={cn(
            "min-w-0 flex-1 text-sm text-foreground",
            isSelected && "font-semibold",
            isMuted && SOFT_TEXT,
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View className="shrink-0 flex-row items-center gap-1.5">
          {isRefused ? (
            <>
              <Icon
                as={Ban}
                className="size-3.5 text-destructive"
              />
              <Text className="text-xs font-medium text-destructive">넣을 수 없어요</Text>
            </>
          ) : (
            trailing
          )}
        </View>
        {isWide ? null : (
          <Icon
            as={ChevronRight}
            className="size-4 text-muted-foreground"
          />
        )}
      </Pressable>
      {action ? <View className="pr-1.5">{action}</View> : null}
    </View>
  );
}

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <View className="flex-row items-center justify-between px-2.5 pb-1 pt-3">
      <Text
        accessibilityRole="header"
        className={cn("text-xs font-semibold", SOFT_TEXT)}
      >
        {label}
      </Text>
      <Text className={cn("text-xs", SOFT_TEXT)}>{formatNumber(count)}개</Text>
    </View>
  );
}

function FolderEmoji({ emoji }: { emoji?: string | null }) {
  if (emoji) {
    return <Emoji className="text-[17px]">{emoji}</Emoji>;
  }
  return (
    <Icon
      as={FolderIcon}
      className="size-[18px] text-muted-foreground"
    />
  );
}

function ProposalFolderList({
  entries,
  selection,
  skipCount,
  unsupportedCount,
  removedCount,
  isWide,
  onSelect,
  onRename,
}: ProposalFolderListProps) {
  const uncategorizedCount = useUncategorizedCount();
  const includedNewCount = entries.added.filter((entry) => entry.addCount > 0).length;

  const isSelected = (next: ProposalSelection) => isWide && isSameSelection(selection, next);

  return (
    <View className="gap-0.5">
      <FolderRow
        accessibilityLabel="미분류"
        drop={{
          id: entries.unfiled.target,
          kind: "folder",
          target: entries.unfiled.target,
          name: "미분류",
        }}
        isSelected={isSelected({ kind: "target", target: entries.unfiled.target })}
        isWide={isWide}
        label="미분류"
        leading={<FolderEmoji emoji={UNFILED_EMOJI} />}
        trailing={
          <>
            <ExistingCount count={uncategorizedCount} />
            <AddCount count={entries.unfiled.addCount} />
          </>
        }
        onPress={() => onSelect({ kind: "target", target: entries.unfiled.target })}
      />

      <SectionTitle
        count={entries.mine.length}
        label="내 폴더"
      />
      {entries.mine.map((entry) => (
        <FolderRow
          key={entry.target}
          accessibilityLabel={entry.folder.name}
          drop={{ id: entry.target, kind: "folder", target: entry.target, name: entry.folder.name }}
          isSelected={isSelected({ kind: "target", target: entry.target })}
          isWide={isWide}
          label={entry.folder.name}
          leading={<FolderEmoji emoji={entry.folder.emoji} />}
          trailing={
            <>
              <ExistingCount count={entry.folder.linkCounts} />
              <AddCount count={entry.addCount} />
            </>
          }
          onPress={() => onSelect({ kind: "target", target: entry.target })}
        />
      ))}

      {entries.shared.length > 0 ? (
        <>
          <SectionTitle
            count={entries.shared.length}
            label="공유 폴더"
          />
          {entries.shared.map((entry) => (
            <FolderRow
              key={entry.folder.id}
              isMuted
              accessibilityLabel={`${entry.folder.name}, 공유 중인 폴더라 가져오기 대상이 아니에요`}
              drop={{
                id: `shared:${entry.folder.id}`,
                kind: "shared",
                target: null,
                name: entry.folder.name,
              }}
              isSelected={isSelected({ kind: "shared", folderId: entry.folder.id })}
              isWide={isWide}
              label={entry.folder.name}
              leading={<FolderEmoji emoji={entry.folder.emoji} />}
              trailing={
                <View className="flex-row items-center gap-1">
                  <Icon
                    as={Users}
                    className="size-3.5 text-muted-foreground"
                  />
                  <Text className={cn("text-xs", SOFT_TEXT)}>공유 중</Text>
                </View>
              }
              onPress={() => onSelect({ kind: "shared", folderId: entry.folder.id })}
            />
          ))}
        </>
      ) : null}

      {entries.added.length > 0 ? (
        <>
          <SectionTitle
            count={includedNewCount}
            label="새 폴더"
          />
          {entries.added.map((entry) => {
            const isExcluded = entry.addCount === 0;
            const selected = isSelected({ kind: "target", target: entry.target });
            return (
              <FolderRow
                key={entry.target}
                accessibilityLabel={
                  isExcluded
                    ? `새 폴더 ${entry.folder.name}, 옮겨지는 링크가 없어 가져오기에서 제외돼요`
                    : `새 폴더 ${entry.folder.name}`
                }
                drop={{
                  id: entry.target,
                  kind: "folder",
                  target: entry.target,
                  name: entry.folder.name,
                }}
                isMuted={isExcluded}
                isSelected={selected}
                isWide={isWide}
                label={entry.folder.name}
                leading={
                  <>
                    <PlusBadge isMuted={isExcluded} />
                    <Icon
                      as={FolderIcon}
                      className="size-[18px] text-muted-foreground"
                    />
                  </>
                }
                trailing={
                  isExcluded ? (
                    <Text className={cn("text-xs", SOFT_TEXT)}>제외돼요</Text>
                  ) : (
                    <AddCount count={entry.addCount} />
                  )
                }
                action={
                  selected ? (
                    <Pressable
                      accessibilityLabel={`${entry.folder.name} 이름 바꾸기`}
                      accessibilityRole="button"
                      className="size-8 items-center justify-center rounded-lg active:bg-muted web:hover:bg-muted"
                      hitSlop={4}
                      onPress={() => onRename(entry.target)}
                    >
                      <Icon
                        as={Pencil}
                        className="size-3.5 text-muted-foreground"
                      />
                    </Pressable>
                  ) : undefined
                }
                onPress={() => onSelect({ kind: "target", target: entry.target })}
              />
            );
          })}
        </>
      ) : null}

      {skipCount > 0 || unsupportedCount > 0 || removedCount > 0 ? (
        <View className="mx-2.5 my-2 h-px bg-border" />
      ) : null}
      {removedCount > 0 ? (
        <FolderRow
          accessibilityLabel={`뺀 링크 ${removedCount}개`}
          drop={null}
          isSelected={isSelected({ kind: "removed" })}
          isWide={isWide}
          label="뺀 링크"
          leading={
            <Icon
              as={ListX}
              className="size-[18px] text-muted-foreground"
            />
          }
          trailing={<ExistingCount count={removedCount} />}
          onPress={() => onSelect({ kind: "removed" })}
        />
      ) : null}
      {skipCount > 0 ? (
        <FolderRow
          accessibilityLabel={`건너뛸 링크 ${skipCount}개`}
          drop={null}
          isSelected={isSelected({ kind: "skipped" })}
          isWide={isWide}
          label="건너뛸 링크"
          leading={
            <Icon
              as={Link2}
              className="size-[18px] text-muted-foreground"
            />
          }
          trailing={<ExistingCount count={skipCount} />}
          onPress={() => onSelect({ kind: "skipped" })}
        />
      ) : null}
      {unsupportedCount > 0 ? (
        <FolderRow
          accessibilityLabel={`가져오기 불가 링크 ${unsupportedCount}개`}
          drop={null}
          isSelected={isSelected({ kind: "unsupported" })}
          isWide={isWide}
          label="가져오기 불가 링크"
          leading={
            <Icon
              as={CircleSlash}
              className="size-[18px] text-muted-foreground"
            />
          }
          trailing={<ExistingCount count={unsupportedCount} />}
          onPress={() => onSelect({ kind: "unsupported" })}
        />
      ) : null}
    </View>
  );
}

export { FolderEmoji, PlusBadge, ProposalFolderList, UNFILED_EMOJI };
