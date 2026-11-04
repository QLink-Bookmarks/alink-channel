import * as React from "react";
import { Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Folder } from "@/features/folders/types";
import { cn } from "@/lib/utils";

import type { ImportProposal } from "../../hooks/use-import-proposal";
import { useLinkDragStore } from "../../hooks/use-link-drag";
import type { ImportUnsupportedLink } from "../../lib/build-import-candidates";
import {
  type ProposalLink,
  type ProposalNewFolder,
  type ProposalSkippedLink,
  type ProposalTarget,
  getActiveLinks,
  getExistingFolderId,
  getRemovedLinkCount,
  getTargetName,
} from "../../lib/proposal-state";
import { formatNumber } from "../../lib/split-import-ranges";
import { getConflictNote, withRo, withWa } from "./proposal-copy";
import { FolderEmoji, PlusBadge, UNFILED_EMOJI } from "./proposal-folder-list";
import type { ProposalSelection } from "./proposal-folders";
import { ProposalLinkRow, getHost } from "./proposal-link-row";
import { useLinkWindow } from "./proposal-link-window";
import { KEYBOARD_HINT, type NameHint, ProposalNameInput } from "./proposal-name-input";
import { PaneHeader, PaneTitle } from "./proposal-pane-header";
import { ProposalRemovedList } from "./proposal-removed-list";

import {
  CircleAlert,
  CircleMinus,
  CirclePlus,
  FileX,
  FolderOpen,
  Link2,
  ListX,
  Pencil,
  Users,
} from "lucide-react-native/icons";

type ProposalLinkPaneProps = {
  proposal: ImportProposal;
  selection: ProposalSelection;
  isWide: boolean;
  renamingTarget: string | null;
  onRenameStart: (target: string) => void;
  onRenameEnd: (target: string, value: string | null) => void;
  onBack?: () => void;
  onSelect: (selection: ProposalSelection) => void;
  onOpenPicker: (link: ProposalLink) => void;
};

const LINK_HINT = "손잡이를 누르거나 끌어서 폴더를 옮길 수 있어요.";

function EmptyPane({
  icon,
  title,
  description,
}: {
  icon: React.ComponentProps<typeof Icon>["as"];
  title: string;
  description: string;
}) {
  return (
    <View className="items-center gap-2 px-6 py-14">
      <View className="mb-2 size-12 items-center justify-center rounded-2xl bg-muted">
        <Icon
          as={icon}
          className="size-5 text-muted-foreground"
        />
      </View>
      <Text className="text-center text-base font-semibold text-foreground">{title}</Text>
      <Text className="text-center text-[13px] text-muted-foreground">{description}</Text>
    </View>
  );
}

function LinkList({
  links,
  isWide,
  proposal,
  windowKey,
  onOpenPicker,
}: {
  links: ProposalLink[];
  isWide: boolean;
  windowKey: string;
  proposal: ImportProposal;
  onOpenPicker: (link: ProposalLink) => void;
}) {
  const { removeLink } = proposal;
  const handleRemove = React.useCallback(
    (link: ProposalLink) => removeLink(link.key),
    [removeLink],
  );
  const { listRef, isWindowed, range, rowHeight } = useLinkWindow(links.length, windowKey);
  const draggingKey = useLinkDragStore((state) => (isWindowed ? (state.link?.key ?? null) : null));
  const draggingIndex = draggingKey ? links.findIndex((link) => link.key === draggingKey) : -1;
  const start = draggingIndex >= 0 ? Math.min(range.start, draggingIndex) : range.start;
  const end = draggingIndex >= 0 ? Math.max(range.end, draggingIndex + 1) : range.end;

  return (
    <View className={cn(isWide ? "px-2 pb-3" : "")}>
      <View
        ref={listRef}
        className="w-full"
      >
        {start > 0 ? (
          <View
            className="shrink-0"
            style={{ height: start * rowHeight }}
          />
        ) : null}
        {links.slice(start, end).map((link) => (
          <ProposalLinkRow
            key={link.key}
            isWide={isWide}
            link={link}
            onOpenPicker={onOpenPicker}
            onRemove={handleRemove}
          />
        ))}
        {end < links.length ? (
          <View
            className="shrink-0"
            style={{ height: (links.length - end) * rowHeight }}
          />
        ) : null}
      </View>
      <Text className="px-2 pt-3 text-[13px] text-muted-foreground">{LINK_HINT}</Text>
    </View>
  );
}

function SkippedList({ links }: { links: ProposalSkippedLink[] }) {
  return (
    <View>
      {links.map((link) => (
        <View
          key={link.key}
          className="flex-row items-center gap-3 border-b border-border-soft px-2 py-2.5"
        >
          <Icon
            as={Link2}
            className="size-4 text-muted-foreground"
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text
              className="text-sm text-foreground"
              numberOfLines={1}
            >
              {link.title}
            </Text>
            <Text
              className="text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {getHost(link.url)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function UnsupportedList({ links }: { links: ImportUnsupportedLink[] }) {
  return (
    <View>
      {links.map((link, index) => (
        <View
          key={`${link.url}-${index}`}
          className="flex-row items-start gap-3 border-b border-border-soft px-2 py-3"
          testID="import-unsupported-row"
        >
          <Icon
            as={FileX}
            className="mt-0.5 size-4 text-muted-foreground"
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text
              className="text-sm text-foreground"
              numberOfLines={1}
            >
              {link.title}
            </Text>
            <Text
              className="text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {link.url}
            </Text>
            <Text
              className="text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {link.path}
            </Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Icon
                as={CircleAlert}
                className="size-3.5 text-warning"
              />
              <Text className="text-xs font-medium text-foreground">
                웹 주소(http·https)가 아니에요
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function FolderActions({
  proposal,
  target,
  isWide,
}: {
  proposal: ImportProposal;
  target: ProposalTarget;
  isWide: boolean;
}) {
  const { state, removeAll, restoreAll } = proposal;
  const activeCount = getActiveLinks(state, target).length;
  const removedCount = getRemovedLinkCount(state, target);
  const name = getTargetName(state, target);
  if (activeCount === 0 && removedCount === 0) {
    return null;
  }
  const restoreLabel =
    removedCount === 1 ? "1개 다시 넣기" : `${formatNumber(removedCount)}개 모두 넣기`;
  return (
    <>
      {activeCount > 0 ? (
        <Button
          accessibilityLabel={`‘${name}’의 링크 모두 빼기`}
          className="h-9 flex-row gap-1.5 rounded-lg px-2.5"
          size="sm"
          variant="ghost"
          onPress={() => removeAll(target)}
        >
          <Icon
            as={CircleMinus}
            className="size-4 text-foreground"
          />
          <Text className="text-[13px] font-semibold text-foreground">모두 빼기</Text>
        </Button>
      ) : null}
      {removedCount > 0 ? (
        <Button
          accessibilityLabel={`‘${name}’에서 뺀 링크 ${restoreLabel}`}
          className="h-9 flex-row gap-1.5 rounded-lg px-2.5"
          size="sm"
          variant="outline"
          onPress={() => restoreAll(target)}
        >
          <Icon
            as={CirclePlus}
            className="size-4 text-foreground"
          />
          <Text className="text-[13px] font-semibold text-foreground">
            {isWide ? `뺀 링크 ${restoreLabel}` : restoreLabel}
          </Text>
        </Button>
      ) : null}
    </>
  );
}

function RemovedNote({
  count,
  isWide,
  onShow,
}: {
  count: number;
  isWide: boolean;
  onShow: () => void;
}) {
  if (count === 0) {
    return null;
  }
  return (
    <View
      className={cn(
        "mt-3 flex-row items-center gap-2 rounded-xl bg-muted py-1.5 pl-3 pr-1.5",
        isWide && "mx-3",
      )}
    >
      <Icon
        as={ListX}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <Text className="min-w-0 flex-1 text-[13px] text-foreground">
        이 폴더에서 뺀 링크 {formatNumber(count)}개는 ‘뺀 링크’에 모여 있어요.
      </Text>
      <Button
        accessibilityLabel="뺀 링크 보기"
        className="h-9 rounded-lg px-3"
        size="sm"
        variant="ghost"
        onPress={onShow}
      >
        <Text className="text-[13px] font-semibold text-foreground">보기</Text>
      </Button>
    </View>
  );
}

function getActiveMeta(count: number) {
  return count > 0 ? `가져올 링크 ${formatNumber(count)}개` : "가져올 링크가 없어요";
}

function getNewFolderNote(folder: ProposalNewFolder) {
  if (folder.conflictWith) {
    return getConflictNote(folder.name, folder.conflictWith);
  }
  if (folder.origin === "picker") {
    return "폴더 이동에서 새로 만든 폴더예요.";
  }
  return `${folder.sourcePath ?? folder.originalName}에서 온 폴더를 새로 만들어요.`;
}

function NewFolderHeader({
  folder,
  proposal,
  isWide,
  isRenaming,
  actions,
  meta,
  onBack,
  onRenameStart,
  onRenameEnd,
}: {
  folder: ProposalNewFolder;
  proposal: ImportProposal;
  isWide: boolean;
  isRenaming: boolean;
  actions: React.ReactNode;
  meta: string;
  onBack?: () => void;
  onRenameStart: (target: string) => void;
  onRenameEnd: (target: string, value: string | null) => void;
}) {
  const getHint = React.useCallback(
    (value: string): NameHint => {
      const check = proposal.checkName(folder.target, value);
      switch (check.type) {
        case "blank":
          return { text: `비워 두면 원래 이름 ${withRo(folder.name)} 돌아가요`, tone: "muted" };
        case "blocked":
          return { text: "공유 폴더와 같은 이름은 쓸 수 없어요", tone: "danger" };
        case "merge-existing":
          return { text: `기존 폴더 ${withRo(check.name)} 합쳐져요`, tone: "info" };
        case "merge-new":
          return { text: `새 폴더 ${withWa(check.name)} 합쳐져요`, tone: "info" };
        default:
          return KEYBOARD_HINT;
      }
    },
    [folder.name, folder.target, proposal],
  );

  if (isRenaming) {
    return (
      <PaneHeader
        description={getNewFolderNote(folder)}
        isWide={isWide}
        title={
          <>
            <PlusBadge />
            <ProposalNameInput
              accessibilityLabel="새 폴더 이름"
              className="min-w-0 flex-1"
              getHint={getHint}
              initialValue={folder.name}
              onCancel={() => onRenameEnd(folder.target, null)}
              onSubmit={(value) => onRenameEnd(folder.target, value)}
            />
          </>
        }
        onBack={onBack}
      />
    );
  }

  return (
    <PaneHeader
      actions={actions}
      description={getNewFolderNote(folder)}
      isWide={isWide}
      meta={meta}
      title={
        <>
          <PlusBadge isMuted={getActiveLinks(proposal.state, folder.target).length === 0} />
          <Pressable
            accessibilityLabel={`새 폴더 ${folder.name} 이름 바꾸기`}
            accessibilityRole="button"
            className="min-w-0 shrink flex-row items-center gap-1.5 rounded-lg py-1 web:hover:bg-muted"
            onPress={() => onRenameStart(folder.target)}
          >
            <PaneTitle>{folder.name}</PaneTitle>
            <Icon
              as={Pencil}
              className="size-4 text-muted-foreground"
            />
          </Pressable>
          <Badge variant="secondary">
            <Text>새 폴더</Text>
          </Badge>
        </>
      }
      onBack={onBack}
    />
  );
}

function SharedFolderPane({
  folder,
  conflictTarget,
  proposal,
  isWide,
  onBack,
  onSelect,
}: {
  folder: Folder;
  conflictTarget: string | null;
  proposal: ImportProposal;
  isWide: boolean;
  onBack?: () => void;
  onSelect: (selection: ProposalSelection) => void;
}) {
  const conflictName = conflictTarget ? proposal.nameOf(conflictTarget) : null;
  return (
    <>
      <PaneHeader
        description={
          conflictName
            ? `내가 공유하는 폴더라 가져온 링크를 넣지 않아요. 북마크의 ‘${folder.name}’ 폴더는 새 폴더로 따로 만들어요.`
            : undefined
        }
        isWide={isWide}
        title={
          <>
            <FolderEmoji emoji={folder.emoji} />
            <PaneTitle>{folder.name}</PaneTitle>
            <View className="flex-row items-center gap-1">
              <Icon
                as={Users}
                className="size-3.5 text-muted-foreground"
              />
              <Text className="text-xs text-muted-foreground">
                공유 중{folder.shareCounts > 0 ? ` · ${folder.shareCounts}명` : ""}
              </Text>
            </View>
          </>
        }
        onBack={onBack}
      />
      <View className="items-center gap-3 px-6 py-12">
        <Text className="text-center text-base font-semibold text-foreground">
          이 폴더에는 넣지 않아요
        </Text>
        <Text className="max-w-[360px] text-center text-[13px] text-muted-foreground">
          공유 폴더에 링크가 들어가면 함께 보는 사람들에게도 보여서, 가져오기는 공유 폴더를 건드리지
          않아요.
        </Text>
        {conflictTarget && conflictName ? (
          <Button
            className="mt-1 h-10 rounded-xl"
            variant="outline"
            onPress={() => onSelect({ kind: "target", target: conflictTarget })}
          >
            <Text className="text-sm font-semibold">‘{conflictName}’ 새 폴더 보기</Text>
          </Button>
        ) : null}
      </View>
    </>
  );
}

function ProposalLinkPane({
  proposal,
  selection,
  isWide,
  renamingTarget,
  onRenameStart,
  onRenameEnd,
  onBack,
  onSelect,
  onOpenPicker,
}: ProposalLinkPaneProps) {
  const { state, myFolders } = proposal;

  if (selection.kind === "skipped") {
    return (
      <>
        <PaneHeader
          description="같은 주소가 이미 저장되어 있어요."
          isWide={isWide}
          title={
            <PaneTitle>{`이미 저장된 링크 ${formatNumber(state.skipped.length)}개는 건너뛰어요`}</PaneTitle>
          }
          onBack={onBack}
        />
        <View className={isWide ? "px-3" : ""}>
          <SkippedList links={state.skipped} />
        </View>
      </>
    );
  }

  if (selection.kind === "removed") {
    return (
      <ProposalRemovedList
        isWide={isWide}
        proposal={proposal}
        onBack={onBack}
      />
    );
  }

  if (selection.kind === "unsupported") {
    return (
      <>
        <PaneHeader
          description="웹 주소가 아닌 링크는 가져올 수 없어요."
          isWide={isWide}
          title={
            <PaneTitle>{`가져오기 불가 링크 ${formatNumber(state.unsupported.length)}개`}</PaneTitle>
          }
          onBack={onBack}
        />
        <View className={isWide ? "px-3" : ""}>
          <UnsupportedList links={state.unsupported} />
        </View>
      </>
    );
  }

  if (selection.kind === "shared") {
    const folder = myFolders.find((item) => item.id === selection.folderId);
    if (!folder) {
      return null;
    }
    const conflictTarget =
      state.newFolders.find((item) => item.conflictWith === folder.name.trim())?.target ?? null;
    return (
      <SharedFolderPane
        conflictTarget={conflictTarget}
        folder={folder}
        isWide={isWide}
        proposal={proposal}
        onBack={onBack}
        onSelect={onSelect}
      />
    );
  }

  const { target } = selection;
  const links = getActiveLinks(state, target);
  const newFolder = state.newFolders.find((item) => item.target === target);
  const existingId = getExistingFolderId(target);
  const existingFolder =
    existingId == null ? null : myFolders.find((item) => item.id === existingId);
  const actions = (
    <FolderActions
      isWide={isWide}
      proposal={proposal}
      target={target}
    />
  );
  const meta = getActiveMeta(links.length);
  const removedNote = (
    <RemovedNote
      count={getRemovedLinkCount(state, target)}
      isWide={isWide}
      onShow={() => onSelect({ kind: "removed" })}
    />
  );

  let header: React.ReactNode;
  if (newFolder) {
    header = (
      <NewFolderHeader
        actions={actions}
        folder={newFolder}
        meta={meta}
        isRenaming={renamingTarget === target}
        isWide={isWide}
        proposal={proposal}
        onBack={onBack}
        onRenameEnd={onRenameEnd}
        onRenameStart={onRenameStart}
      />
    );
  } else if (existingFolder) {
    header = (
      <PaneHeader
        actions={actions}
        isWide={isWide}
        meta={meta}
        title={
          <>
            <FolderEmoji emoji={existingFolder.emoji} />
            <PaneTitle>{existingFolder.name}</PaneTitle>
            <Badge variant="secondary">
              <Text>기존 폴더</Text>
            </Badge>
          </>
        }
        onBack={onBack}
      />
    );
  } else {
    header = (
      <PaneHeader
        actions={actions}
        isWide={isWide}
        meta={meta}
        title={
          <>
            <FolderEmoji emoji={UNFILED_EMOJI} />
            <PaneTitle>미분류</PaneTitle>
          </>
        }
        onBack={onBack}
      />
    );
  }

  return (
    <>
      {header}
      {links.length > 0 ? (
        <LinkList
          isWide={isWide}
          links={links}
          proposal={proposal}
          windowKey={target}
          onOpenPicker={onOpenPicker}
        />
      ) : newFolder ? (
        <EmptyPane
          description="이 폴더는 가져오기에서 제외돼요."
          icon={FolderOpen}
          title="옮겨지는 링크가 없어요."
        />
      ) : (
        <EmptyPane
          description="다른 폴더의 링크를 손잡이로 끌어서 여기로 옮길 수 있어요."
          icon={FolderOpen}
          title="이 폴더로 옮겨지는 링크가 없어요"
        />
      )}
      {removedNote}
    </>
  );
}

export { ProposalLinkPane, SkippedList, UnsupportedList };
