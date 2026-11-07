import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  type ShareFolderChoice,
  type ShareModelOption,
  type ShareSubmitKind,
  getTodoSummary,
  shouldShowUncategorizedHint,
} from "./share-options";
import { ShareProviderLogo } from "./share-provider-logo";
import { useShareTheme } from "./share-theme";

import { ChevronRight, Save } from "lucide-react-native/icons";

const UNCATEGORIZED_HINT = "미분류면 AI가 알맞은 폴더에 넣어요";
const SAVING_CAPTION = "보내는 중";

type ShareMainStepProps = {
  header: React.ReactNode;
  isLoading: boolean;
  isLocked: boolean;
  folder: ShareFolderChoice;
  models: ShareModelOption[];
  model: ShareModelOption | null;
  generateTodo: boolean;
  submitting: ShareSubmitKind | null;
  onOpenFolder: () => void;
  onOpenAi: () => void;
  onSave: () => void;
  onAiSave: () => void;
};

function ShareMainStep({
  header,
  isLoading,
  isLocked,
  folder,
  models,
  model,
  generateTodo,
  submitting,
  onOpenFolder,
  onOpenAi,
  onSave,
  onAiSave,
}: ShareMainStepProps) {
  const hasAi = models.length > 0;
  const isRowLocked = isLoading || isLocked || submitting !== null;
  const isHintShown = !isLoading && shouldShowUncategorizedHint(folder, models);

  return (
    <View className="min-h-0 flex-1">
      <ScrollView
        bounces={false}
        className="min-h-0 flex-1"
        contentContainerClassName="grow"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {header}
        <View
          aria-hidden
          className="min-h-4 flex-1"
        />
        <View className="overflow-hidden rounded-[14px] border border-border-soft bg-card">
          <ShareSettingRow
            accessibilityLabel={`폴더, ${folder.name}`}
            isDisabled={isRowLocked}
            label="폴더"
            onPress={onOpenFolder}
          >
            {isLoading ? (
              <Skeleton className="h-3 w-[72px] rounded-full bg-muted" />
            ) : (
              <>
                <Text
                  aria-hidden
                  className="shrink-0 text-[15px] leading-5"
                >
                  {folder.emoji}
                </Text>
                <Text
                  className="min-w-0 shrink text-[15px] leading-5 text-muted-foreground"
                  numberOfLines={1}
                >
                  {folder.name}
                </Text>
              </>
            )}
          </ShareSettingRow>
          {hasAi || isLoading ? (
            <ShareSettingRow
              accessibilityLabel={
                model ? `AI 옵션, ${model.label}, ${getTodoSummary(generateTodo)}` : "AI 옵션"
              }
              hasDivider
              isDisabled={isRowLocked}
              label="AI 옵션"
              onPress={onOpenAi}
            >
              {isLoading || !model ? (
                <Skeleton className="h-3 w-[120px] rounded-full bg-muted" />
              ) : (
                <>
                  <ShareProviderLogo type={model.providerType} />
                  <Text className="shrink-0 text-[15px] leading-5 text-muted-foreground">
                    {model.label}
                  </Text>
                  <Text className="shrink-0 text-[15px] leading-5 text-muted-foreground/60">·</Text>
                  <Text className="shrink-0 text-[15px] leading-5 text-muted-foreground">
                    {getTodoSummary(generateTodo)}
                  </Text>
                </>
              )}
            </ShareSettingRow>
          ) : null}
        </View>
        {isLoading || isHintShown ? (
          <Text
            aria-hidden={isLoading}
            className={cn(
              "mx-3.5 mt-1.5 text-[13px] leading-[18px] text-muted-foreground",
              isLoading && "opacity-0",
            )}
            numberOfLines={1}
          >
            {UNCATEGORIZED_HINT}
          </Text>
        ) : null}
      </ScrollView>
      <ShareActions
        hasAi={hasAi || isLoading}
        isDisabled={isLoading || isLocked}
        submitting={submitting}
        onAiSave={onAiSave}
        onSave={onSave}
      />
    </View>
  );
}

function ShareSettingRow({
  label,
  accessibilityLabel,
  hasDivider = false,
  isDisabled,
  children,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  hasDivider?: boolean;
  isDisabled: boolean;
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      className={cn(
        "min-h-[50px] flex-row items-center gap-2.5 pl-3.5 pr-2.5 active:bg-muted",
        isDisabled && "opacity-[0.45]",
      )}
      disabled={isDisabled}
      onPress={onPress}
    >
      {hasDivider ? <View className="absolute left-3.5 right-0 top-0 h-px bg-border-soft" /> : null}
      <Text className="shrink-0 text-base leading-[21px] text-foreground">{label}</Text>
      <View className="min-w-0 flex-1 flex-row items-center justify-end gap-1.5">{children}</View>
      <Icon
        as={ChevronRight}
        className="text-muted-foreground/80"
        size={16}
      />
    </Pressable>
  );
}

function ShareActions({
  hasAi,
  isDisabled,
  submitting,
  onSave,
  onAiSave,
}: {
  hasAi: boolean;
  isDisabled: boolean;
  submitting: ShareSubmitKind | null;
  onSave: () => void;
  onAiSave: () => void;
}) {
  const { tokens, mode, accent } = useShareTheme();
  const isBusy = submitting !== null;

  if (!hasAi) {
    const isSaving = submitting === "save";
    return (
      <View className="pt-3.5">
        <Button
          accessibilityHint="그대로 보관"
          accessibilityState={{ busy: isSaving, disabled: isDisabled || (isBusy && !isSaving) }}
          className="h-12 w-full self-stretch rounded-xl bg-primary"
          disabled={isDisabled || (isBusy && !isSaving)}
          onPress={onSave}
        >
          {isSaving ? (
            <ActivityIndicator
              className="size-4"
              color={tokens.primaryForeground}
              size="small"
            />
          ) : null}
          <Text className="text-base font-semibold text-primary-foreground">저장</Text>
        </Button>
        <Text
          aria-hidden
          className="mt-[5px] text-center text-xs leading-4 text-muted-foreground"
        >
          {isSaving ? SAVING_CAPTION : "그대로 보관"}
        </Text>
      </View>
    );
  }

  const isSaving = submitting === "save";
  const isAiSaving = submitting === "ai";
  const isSaveDisabled = isDisabled || (isBusy && !isSaving);
  const isAiDisabled = isDisabled || (isBusy && !isAiSaving);

  return (
    <View className="pt-3.5">
      <View className="flex-row gap-2">
        <Button
          accessibilityHint="그대로 보관"
          accessibilityState={{ busy: isSaving, disabled: isSaveDisabled }}
          className="h-12 flex-1 rounded-xl bg-primary/15 shadow-none active:bg-primary/25"
          disabled={isSaveDisabled}
          onPress={onSave}
        >
          {isSaving ? (
            <ActivityIndicator
              className="size-4"
              color={tokens.accentForeground}
              size="small"
            />
          ) : (
            <Icon
              as={Save}
              className="text-accent-foreground"
              size={18}
            />
          )}
          <Text className="text-base font-semibold text-accent-foreground">저장</Text>
        </Button>
        <Button
          accessibilityHint="요약·태그까지 정리"
          accessibilityState={{ busy: isAiSaving, disabled: isAiDisabled }}
          className="relative h-12 flex-1 overflow-hidden rounded-xl bg-transparent shadow-qlink-sm active:opacity-95"
          disabled={isAiDisabled}
          onPress={onAiSave}
        >
          <LinearGradient
            accent={accent}
            mode={mode}
            pointerEvents="none"
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          {isAiSaving ? (
            <ActivityIndicator
              className="size-4"
              color={tokens.primaryForeground}
              size="small"
            />
          ) : null}
          <Text className="text-base font-semibold text-primary-foreground">AI 정리</Text>
        </Button>
      </View>
      <View
        aria-hidden
        className="mt-[5px] flex-row gap-2"
      >
        <Text className="flex-1 text-center text-xs leading-4 text-muted-foreground">
          {isSaving ? SAVING_CAPTION : "그대로 보관"}
        </Text>
        <Text className="flex-1 text-center text-xs leading-4 text-muted-foreground">
          {isAiSaving ? SAVING_CAPTION : "요약·태그까지 정리"}
        </Text>
      </View>
    </View>
  );
}

export { SAVING_CAPTION, ShareMainStep, UNCATEGORIZED_HINT };
