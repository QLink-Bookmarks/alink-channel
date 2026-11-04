import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  type ReversalExclusions,
  type ReversalFolderItem,
  getFolderCheck,
  isFolderRemoved,
  isLinkSelectable,
} from "../../lib/reversal-selection";
import { ChangeMark } from "../history/change-mark";
import { ReversalCheckbox } from "./reversal-checkbox";
import { getReversalFolderIntro, getReversalFolderLabel } from "./reversal-copy";
import { ReversalLinkRow } from "./reversal-link-row";

import { ChevronLeft } from "lucide-react-native";

type ReversalFolderPaneProps = {
  folder: ReversalFolderItem;
  exclusions: ReversalExclusions;
  disabled?: boolean;
  onBack?: () => void;
  onToggleFolder: (folder: ReversalFolderItem) => void;
  onToggleLink: (folder: ReversalFolderItem, linkId: number) => void;
};

const BADGE_VARIANTS = {
  danger: "overdue",
  muted: "private",
  shared: "status",
} as const;

function ReversalFolderPane({
  folder,
  exclusions,
  disabled,
  onBack,
  onToggleFolder,
  onToggleLink,
}: ReversalFolderPaneProps) {
  const { name, emoji } = getReversalFolderLabel(folder);
  const removed = isFolderRemoved(folder, exclusions);
  const intro = getReversalFolderIntro(folder, removed);
  const check = getFolderCheck(folder, exclusions);
  const selectableCount = folder.links.filter(isLinkSelectable).length;

  return (
    <View
      className="gap-0"
      role="region"
      aria-label={`${name} 폴더의 링크`}
    >
      <View className="gap-2 px-4 pb-3 pt-4">
        <View className="flex-row items-center gap-2">
          {onBack ? (
            <IconButton
              accessibilityLabel="폴더 목록으로"
              icon={ChevronLeft}
              size="md"
              variant="ghost"
              onPress={onBack}
            />
          ) : null}
          {removed ? <ChangeMark kind="remove" /> : null}
          <Text
            role="heading"
            className="min-w-0 shrink text-lg font-semibold text-foreground"
            numberOfLines={1}
          >
            {emoji ? `${emoji} ` : ""}
            {name}
          </Text>
          {intro.badge ? (
            <Badge
              variant={BADGE_VARIANTS[intro.tone]}
              className={intro.tone === "muted" ? "border-border bg-card" : undefined}
            >
              <Text className={cn("text-sm", intro.tone === "muted" && "text-foreground/70")}>
                {intro.badge}
              </Text>
            </Badge>
          ) : null}
        </View>
        <Text className="text-sm text-muted-foreground">{intro.description}</Text>
        {selectableCount > 0 ? (
          <View className="-ml-3 flex-row items-center">
            <ReversalCheckbox
              checked={check.checked}
              disabled={disabled}
              label={`가져온 링크 ${selectableCount}개 모두 지우기`}
              onPress={() => onToggleFolder(folder)}
            />
            <Text
              className="text-sm text-foreground"
              aria-hidden
            >
              가져온 링크 {selectableCount}개 모두 지우기
            </Text>
          </View>
        ) : null}
      </View>
      <View
        className={cn("pl-1", folder.links.length === 0 && "hidden")}
        role="list"
      >
        {folder.links.map((link) => (
          <View
            key={link.linkId}
            role="listitem"
          >
            <ReversalLinkRow
              folder={folder}
              link={link}
              exclusions={exclusions}
              disabled={disabled}
              onToggle={onToggleLink}
            />
          </View>
        ))}
      </View>
      {folder.links.length === 0 ? (
        <Text className="px-4 pb-4 text-sm text-muted-foreground">
          이 폴더에 남은 가져온 링크가 없어요.
        </Text>
      ) : null}
    </View>
  );
}

export { ReversalFolderPane };
