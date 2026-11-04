import * as React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { ImportProposal } from "../../hooks/use-import-proposal";
import {
  type ProposalLink,
  type ProposalRemovedGroup,
  type ProposalTarget,
  UNFILED_TARGET,
  getExistingFolderId,
  getExistingTarget,
  getRemovedGroups,
  getTargetName,
} from "../../lib/proposal-state";
import { formatNumber } from "../../lib/split-import-ranges";
import { FolderEmoji, UNFILED_EMOJI } from "./proposal-folder-list";
import { getHost } from "./proposal-link-row";
import { useLinkWindow } from "./proposal-link-window";
import { PaneHeader, PaneTitle } from "./proposal-pane-header";

import { CirclePlus, ListX, Undo2 } from "lucide-react-native/icons";

const ITEM_SELECTOR = '[data-testid^="import-removed-"]';

type RemovedItem =
  | { kind: "group"; group: ProposalRemovedGroup }
  | { kind: "link"; link: ProposalLink; group: ProposalRemovedGroup };

type ProposalRemovedListProps = {
  proposal: ImportProposal;
  isWide: boolean;
  onBack?: () => void;
};

function GroupIcon({ proposal, target }: { proposal: ImportProposal; target: ProposalTarget }) {
  if (target === UNFILED_TARGET) {
    return <FolderEmoji emoji={UNFILED_EMOJI} />;
  }
  const existingId = getExistingFolderId(target);
  const folder =
    existingId == null ? null : proposal.myFolders.find((item) => item.id === existingId);
  return <FolderEmoji emoji={folder?.emoji} />;
}

function RemovedGroupHeader({
  group,
  proposal,
}: {
  group: ProposalRemovedGroup;
  proposal: ImportProposal;
}) {
  const name = getTargetName(proposal.state, group.target);
  return (
    <View
      className="h-14 flex-row items-center gap-2 px-2"
      testID="import-removed-group"
    >
      <GroupIcon
        proposal={proposal}
        target={group.target}
      />
      <Text
        accessibilityRole="header"
        className="min-w-0 shrink text-sm font-semibold text-foreground"
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        className="min-w-0 flex-1 text-[13px] text-muted-foreground"
        numberOfLines={1}
      >
        {formatNumber(group.links.length)}개{group.isGone ? " · 비어서 없어진 새 폴더" : ""}
      </Text>
      {group.links.length > 1 ? (
        <Button
          accessibilityLabel={`‘${name}’에서 뺀 링크 ${formatNumber(group.links.length)}개 모두 넣기`}
          className="h-9 flex-row gap-1.5 self-center rounded-lg px-2.5 sm:h-9"
          size="sm"
          variant="outline"
          onPress={() => proposal.restoreAll(group.target)}
        >
          <Icon
            as={CirclePlus}
            className="size-4 text-foreground"
          />
          <Text className="text-[13px] font-semibold text-foreground">모두 넣기</Text>
        </Button>
      ) : null}
    </View>
  );
}

function RemovedLinkRow({
  link,
  isGone,
  onRestore,
}: {
  link: ProposalLink;
  isGone: boolean;
  onRestore: (key: string) => void;
}) {
  return (
    <View
      className="h-14 flex-row items-center gap-2 border-b border-border-soft pl-3"
      testID="import-removed-row"
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className="text-sm text-foreground"
          numberOfLines={1}
        >
          {link.title}
        </Text>
        <Text
          className={cn("text-xs", isGone ? "text-warning" : "text-muted-foreground")}
          numberOfLines={1}
        >
          {isGone ? "미분류로 넣어요" : getHost(link.url)}
        </Text>
      </View>
      <Button
        accessibilityLabel={`${link.title} 다시 넣기`}
        className="h-11 flex-row gap-1.5 self-center rounded-lg px-2.5 sm:h-11"
        size="sm"
        variant="ghost"
        onPress={() => onRestore(link.key)}
      >
        <Icon
          as={Undo2}
          className="size-4 text-foreground"
        />
        <Text className="text-[13px] font-semibold text-foreground">다시 넣기</Text>
      </Button>
    </View>
  );
}

function ProposalRemovedList({ proposal, isWide, onBack }: ProposalRemovedListProps) {
  const { state, myFolders, restoreLink } = proposal;
  const order = React.useMemo(
    () => [
      UNFILED_TARGET,
      ...myFolders
        .filter((folder) => !folder.isShared)
        .map((folder) => getExistingTarget(folder.id)),
      ...state.newFolders.map((folder) => folder.target),
    ],
    [myFolders, state.newFolders],
  );
  const groups = React.useMemo(() => getRemovedGroups(state, order), [order, state]);
  const items = React.useMemo(() => {
    const list: RemovedItem[] = [];
    for (const group of groups) {
      list.push({ kind: "group", group });
      for (const link of group.links) {
        list.push({ kind: "link", link, group });
      }
    }
    return list;
  }, [groups]);
  const total = items.length - groups.length;
  const { listRef, range, rowHeight } = useLinkWindow(items.length, "removed", ITEM_SELECTOR);

  return (
    <>
      <PaneHeader
        description="다시 넣으면 원래 폴더로 돌아가요."
        isWide={isWide}
        title={
          <>
            <Icon
              as={ListX}
              className="size-[18px] text-muted-foreground"
            />
            <PaneTitle>뺀 링크</PaneTitle>
            <Text className="text-[13px] tabular-nums text-muted-foreground">
              {formatNumber(total)}개
            </Text>
          </>
        }
        onBack={onBack}
      />
      <View className={cn(isWide ? "px-3 pb-3" : "")}>
        <View
          ref={listRef}
          className="w-full"
        >
          {range.start > 0 ? <View style={{ height: range.start * rowHeight }} /> : null}
          {items.slice(range.start, range.end).map((item) =>
            item.kind === "group" ? (
              <RemovedGroupHeader
                key={`group:${item.group.target}`}
                group={item.group}
                proposal={proposal}
              />
            ) : (
              <RemovedLinkRow
                key={item.link.key}
                isGone={item.group.isGone}
                link={item.link}
                onRestore={restoreLink}
              />
            ),
          )}
          {range.end < items.length ? (
            <View style={{ height: (items.length - range.end) * rowHeight }} />
          ) : null}
        </View>
      </View>
    </>
  );
}

export { ProposalRemovedList };
