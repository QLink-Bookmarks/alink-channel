import * as React from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PublicAddressRow } from "@/components/ui/public-address-row";
import { Text } from "@/components/ui/text";
import { useFolderDetailQuery } from "@/features/folders/queries";
import { cn } from "@/lib/utils";

import { DetailToolbarButton, FOCUS_RING_CLASS_NAME } from "./link-detail-parts";
import { LinkShareSheet } from "./link-share-sheet";

import { Check, Globe, Lock, Share2 } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";
const choices = [
  { value: true, label: "전체 공개", icon: Globe },
  { value: false, label: "나만 보기", icon: Lock },
] as const;

type LinkShareSurfaceProps = {
  mode: "panel" | "screen";
  linkId: number;
  folderId: number | null;
  url: string;
  isOwner: boolean;
  isPublic: boolean | undefined;
  pending: boolean;
  failed: boolean;
  onChange: (isPublic: boolean) => Promise<void>;
  onShare: () => void;
};

function LinkShareSurface({
  mode,
  linkId,
  folderId,
  url,
  isOwner,
  isPublic,
  pending,
  failed,
  onChange,
  onShare,
}: LinkShareSurfaceProps) {
  const [open, setOpen] = React.useState(false);
  const [savedSelection, setSavedSelection] = React.useState<boolean>();
  const hasVisibility = isOwner && typeof isPublic === "boolean";
  const folder = useFolderDetailQuery(folderId, open && hasVisibility);
  const checking = folderId !== null && folder.isFetching;
  const unavailable =
    folderId !== null &&
    (folder.isError || folder.isPaused || typeof folder.data?.isPublic !== "boolean");
  const canPublish = folder.data?.isPublic === true && !checking && !unavailable;
  const saving = pending || savedSelection !== undefined;
  const selected = savedSelection ?? (canPublish && isPublic === true);
  const message = saving
    ? "공개 설정을 변경하는 중이에요."
    : checking
      ? "폴더 공개 상태를 확인하는 중이에요."
      : unavailable
        ? "폴더 공개 상태를 확인할 수 없어요."
        : failed
          ? "공개 설정을 저장하지 못했어요."
          : !canPublish
            ? "폴더를 먼저 전체 공개해 주세요."
            : undefined;
  const title = isOwner ? "내 링크 페이지 공유" : "공유";

  const handleChange = async (next: boolean) => {
    if (next === selected) return;
    setSavedSelection(selected);
    try {
      await onChange(next);
    } finally {
      setSavedSelection(undefined);
    }
  };

  const content = open ? (
    <View className="gap-3">
      {hasVisibility ? (
        <View className="gap-1">
          <Text className="text-sm font-medium">공개 설정</Text>
          <View
            accessibilityLabel={isWeb ? "공개 설정" : undefined}
            className="gap-1"
            role={isWeb ? "group" : undefined}
          >
            {choices.map(({ value, label, icon }) => {
              const checked = selected === value;
              const disabled = saving || checking || unavailable || (value && !canPublish);
              return (
                <View
                  key={label}
                  className="gap-1"
                >
                  <Pressable
                    accessibilityLabel={label}
                    accessibilityState={isWeb ? undefined : { checked }}
                    aria-pressed={isWeb ? checked : undefined}
                    className={cn(
                      "min-h-11 flex-row items-center gap-2 rounded-lg px-2",
                      FOCUS_RING_CLASS_NAME,
                      checked && "bg-accent",
                      disabled ? "opacity-60" : "active:bg-accent web:hover:bg-accent",
                    )}
                    disabled={disabled}
                    role={isWeb ? "button" : "radio"}
                    onPress={() => handleChange(value)}
                  >
                    <Icon
                      as={icon}
                      size={16}
                      className="text-foreground"
                    />
                    <Text className="flex-1 text-sm">{label}</Text>
                    {checked ? (
                      <Icon
                        as={Check}
                        size={16}
                        className="text-primary"
                      />
                    ) : null}
                  </Pressable>
                  {value && selected ? <PublicAddressRow path={`/links/${linkId}`} /> : null}
                </View>
              );
            })}
          </View>
          {message ? (
            <Text
              accessibilityLiveRegion="polite"
              className={cn(
                "text-xs",
                !saving && !checking && (unavailable || failed)
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
              role={!saving && !checking && (unavailable || failed) ? "alert" : "status"}
            >
              {message}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className={cn("items-start gap-1", hasVisibility && "border-t border-border pt-3")}>
        <Text
          className="w-full text-xs text-muted-foreground"
          numberOfLines={2}
        >
          {url}
        </Text>
        <Button
          className="min-w-0"
          size="xs"
          variant="ghost"
          onPress={onShare}
        >
          <Icon
            as={Share2}
            size={14}
            className="text-muted-foreground"
          />
          <Text>원본 링크 공유</Text>
        </Button>
      </View>
    </View>
  ) : null;

  if (isWeb && mode === "panel") {
    return (
      <Popover onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            accessibilityLabel="공유"
            className="min-w-0 gap-[5px] rounded-[10px]"
            size="xs"
            testID="link-detail-share"
            variant="ghost"
          >
            <Icon
              as={Share2}
              size={15}
              className="text-muted-foreground"
            />
            <Text className="font-semibold text-muted-foreground">공유</Text>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          accessibilityLabel={title}
          align="start"
          className="gap-3 rounded-xl p-3"
          side="bottom"
          sideOffset={8}
        >
          <Text
            className="text-sm font-semibold"
            role="heading"
          >
            {title}
          </Text>
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <DetailToolbarButton
        compact={mode === "screen"}
        icon={Share2}
        label="공유"
        testID="link-detail-share"
        onPress={() => setOpen(true)}
      />
      <LinkShareSheet
        open={open}
        title={title}
        onOpenChange={setOpen}
      >
        {content}
      </LinkShareSheet>
    </>
  );
}

export { LinkShareSurface };
