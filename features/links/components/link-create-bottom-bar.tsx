import * as React from "react";
import { Pressable, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopoverContext,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { AiProviderLogo } from "@/features/ai/components/ai-provider-logo";
import {
  AiProviderPickerList,
  type AiProviderSelection,
  PROVIDERS_LOADING_LABEL,
} from "@/features/ai/components/ai-provider-picker-list";
import { getAiProviderKind } from "@/features/ai/lib/provider-kind";
import { TodoErrorSummary } from "@/features/todos/components/todo-error-summary";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

import { getSaveLabelClassName } from "../lib/save-label-class-name";

import { ChevronDown, ChevronRight, CircleAlert, Save } from "lucide-react-native/icons";

const AI_OPTIONS_LABEL = "AI 정리 옵션";
const AI_ORGANIZE_CAPTION = "AI 정리는 요약·태그·폴더를 AI가 정해요";
const GENERATE_TODO_LABEL = "액션 자동 추가";
const NO_PROVIDER_LABEL = "제공자 없음";
const SAVING_LABEL = "저장하는 중";
const SAVE_FAILED_MESSAGE = "링크 저장에 실패했습니다. 잠시 후 다시 시도해주세요.";

type LinkCreateProviderState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; selection: AiProviderSelection; isDefault: boolean };

type LinkCreateBottomBarProps = {
  mode: "wide" | "mobile";
  provider: LinkCreateProviderState;
  /** Highlights the default provider's row in the wide provider list. */
  defaultProviderId: number | null;
  generateTodo: boolean;
  todoErrorCount: number;
  hasSaveError: boolean;
  /** The request in flight, if any: its button spins and every control waits. */
  pendingRequest: "save" | "ai" | null;
  onGenerateTodoChange: (next: boolean) => void;
  /** Wide: picks a provider in the popover. */
  onProviderSelect: (selection: AiProviderSelection) => void;
  /** Mobile: moves the sheet to its provider step. */
  onOpenProviderStep: () => void;
  onSave: () => void;
  onAiOrganize: () => void;
};

function getProviderName(provider: LinkCreateProviderState): string {
  if (provider.status === "loading") return PROVIDERS_LOADING_LABEL;
  if (provider.status === "empty") return NO_PROVIDER_LABEL;
  return provider.selection.providerLabel;
}

// The bottom of the new link form: the AI 정리 options, the caption (or the action
// error count), the save failure notice and the two buttons. Wide pins it under the
// dialog body; mobile renders it inside the sheet's fixed footer.
function LinkCreateBottomBar({
  mode,
  provider,
  defaultProviderId,
  generateTodo,
  todoErrorCount,
  hasSaveError,
  pendingRequest,
  onGenerateTodoChange,
  onProviderSelect,
  onOpenProviderStep,
  onSave,
  onAiOrganize,
}: LinkCreateBottomBarProps) {
  const isSheet = mode === "mobile";
  const isBusy = pendingRequest != null;
  const caption =
    todoErrorCount > 0 ? (
      <TodoErrorSummary
        className={cn(isSheet ? "justify-center" : "min-w-0 flex-1")}
        count={todoErrorCount}
      />
    ) : (
      <Text
        className={cn(
          "text-xs leading-[17px] text-muted-foreground",
          isSheet ? "text-center" : "min-w-0 flex-1",
        )}
        testID="link-create-caption"
      >
        {AI_ORGANIZE_CAPTION}
      </Text>
    );
  const buttons = (
    <LinkCreateButtons
      isSheet={isSheet}
      pendingRequest={pendingRequest}
      onAiOrganize={onAiOrganize}
      onSave={onSave}
    />
  );

  return (
    <View
      className={cn(isSheet ? "gap-2" : "gap-2.5")}
      testID="link-create-bottom-bar"
    >
      {hasSaveError ? <SaveFailedNotice /> : null}
      <AiOptionsSurface
        defaultProviderId={defaultProviderId}
        disabled={isBusy}
        generateTodo={generateTodo}
        isSheet={isSheet}
        provider={provider}
        onGenerateTodoChange={onGenerateTodoChange}
        onOpenProviderStep={onOpenProviderStep}
        onProviderSelect={onProviderSelect}
      />
      {isSheet ? (
        <>
          {caption}
          {buttons}
        </>
      ) : (
        <View className="flex-row items-center gap-2">
          {caption}
          {buttons}
        </View>
      )}
    </View>
  );
}

function SaveFailedNotice() {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="flex-row items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5"
    >
      <Icon
        as={CircleAlert}
        className="size-4 shrink-0 text-destructive"
      />
      <Text className="min-w-0 flex-1 text-[13px] font-medium text-foreground">
        {SAVE_FAILED_MESSAGE}
      </Text>
    </View>
  );
}

function AiOptionsSurface({
  defaultProviderId,
  disabled,
  generateTodo,
  isSheet,
  provider,
  onGenerateTodoChange,
  onOpenProviderStep,
  onProviderSelect,
}: {
  defaultProviderId: number | null;
  disabled: boolean;
  generateTodo: boolean;
  isSheet: boolean;
  provider: LinkCreateProviderState;
  onGenerateTodoChange: (next: boolean) => void;
  onOpenProviderStep: () => void;
  onProviderSelect: (selection: AiProviderSelection) => void;
}) {
  const triggerLabel = `AI 제공자, ${getProviderName(provider)}`;

  return (
    <View
      accessibilityLabel={AI_OPTIONS_LABEL}
      accessibilityRole="none"
      aria-label={AI_OPTIONS_LABEL}
      className="min-h-[52px] flex-row items-center gap-1 rounded-2xl bg-surface-elevated py-1.5 pl-3.5 pr-1.5"
      role="group"
      testID="link-create-ai-options"
    >
      <Text className="mr-1 shrink-0 text-xs font-semibold text-muted-foreground">
        {AI_OPTIONS_LABEL}
      </Text>
      {isSheet ? (
        <ProviderTrigger
          accessibilityLabel={triggerLabel}
          disabled={disabled}
          isSheet
          provider={provider}
          onPress={onOpenProviderStep}
        />
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <ProviderTrigger
              accessibilityLabel={triggerLabel}
              disabled={disabled}
              isSheet={false}
              provider={provider}
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-80 rounded-2xl p-3 web:max-h-[calc(var(--radix-popover-content-available-height)-16px)] web:overflow-y-auto"
          >
            <ProviderPopoverList
              defaultProviderId={defaultProviderId}
              selectedProviderId={
                provider.status === "ready" ? provider.selection.providerId : null
              }
              onSelect={onProviderSelect}
            />
          </PopoverContent>
        </Popover>
      )}
      <View className="min-w-0 flex-1" />
      <View className="h-10 shrink-0 flex-row items-center gap-2 rounded-xl pr-1">
        <Pressable
          accessible={false}
          className="h-10 justify-center rounded-lg pl-2.5"
          disabled={disabled}
          tabIndex={-1}
          onPress={() => onGenerateTodoChange(!generateTodo)}
        >
          <Text className="text-[13px] font-medium text-foreground">{GENERATE_TODO_LABEL}</Text>
        </Pressable>
        <Switch
          accessibilityLabel={GENERATE_TODO_LABEL}
          checked={generateTodo}
          disabled={disabled}
          onCheckedChange={onGenerateTodoChange}
        />
      </View>
    </View>
  );
}

const ProviderTrigger = React.forwardRef<
  View,
  {
    accessibilityLabel: string;
    isSheet: boolean;
    provider: LinkCreateProviderState;
    onPress?: React.ComponentProps<typeof Pressable>["onPress"];
  } & Omit<React.ComponentProps<typeof Pressable>, "children">
>(function ProviderTrigger({ accessibilityLabel, isSheet, provider, onPress, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="h-10 min-w-0 shrink flex-row items-center gap-2 rounded-xl px-2.5 web:hover:bg-card"
      testID="link-create-provider-trigger"
      onPress={onPress}
      {...props}
    >
      <ProviderTriggerContent provider={provider} />
      <Icon
        as={isSheet ? ChevronRight : ChevronDown}
        size={14}
        className="shrink-0 text-muted-foreground"
      />
    </Pressable>
  );
});

function ProviderTriggerContent({ provider }: { provider: LinkCreateProviderState }) {
  if (provider.status === "loading") {
    return (
      <View className="flex-row items-center gap-2">
        <ActivityIndicator />
        <Text className="text-[13px] font-semibold text-muted-foreground">
          {PROVIDERS_LOADING_LABEL}
        </Text>
      </View>
    );
  }
  if (provider.status === "empty") {
    return (
      <Text className="text-[13px] font-semibold text-muted-foreground">{NO_PROVIDER_LABEL}</Text>
    );
  }
  return (
    <AiProviderLogo
      kind={getAiProviderKind(provider.selection.providerLabel)}
      name={provider.selection.providerLabel}
      className="shrink"
      nameClassName="text-[13px]"
    >
      {provider.isDefault ? <Text className="text-xs text-muted-foreground">기본</Text> : null}
    </AiProviderLogo>
  );
}

function ProviderPopoverList({
  defaultProviderId,
  selectedProviderId,
  onSelect,
}: {
  defaultProviderId: number | null;
  selectedProviderId: number | null;
  onSelect: (selection: AiProviderSelection) => void;
}) {
  const popoverContext = usePopoverContext();

  return (
    <AiProviderPickerList
      defaultProviderId={defaultProviderId}
      selectedProviderId={selectedProviderId}
      onSelect={(selection) => {
        onSelect(selection);
        popoverContext.onOpenChange(false);
      }}
    />
  );
}

function LinkCreateButtons({
  isSheet,
  pendingRequest,
  onAiOrganize,
  onSave,
}: {
  isSheet: boolean;
  pendingRequest: "save" | "ai" | null;
  onAiOrganize: () => void;
  onSave: () => void;
}) {
  const labelClassName = isSheet ? "text-base font-semibold" : "text-sm font-semibold";
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const saveTextClassName = getSaveLabelClassName(accent, theme);
  const isBusy = pendingRequest != null;

  return (
    <View className={cn("flex-row gap-2", isSheet ? "w-full" : "shrink-0")}>
      <Button
        className={cn(
          "flex-row gap-2 rounded-xl bg-primary/15 shadow-none active:bg-primary/20",
          process.env.EXPO_OS === "web" && "hover:bg-primary/20",
          isSheet ? "h-12 flex-1 sm:h-12" : "h-10 min-w-[104px] px-[18px] sm:h-10",
        )}
        disabled={isBusy}
        variant="secondary"
        onPress={onSave}
      >
        {pendingRequest === "save" ? (
          <ActivityIndicator accessibilityLabel={SAVING_LABEL} />
        ) : (
          <Icon
            as={Save}
            className={saveTextClassName}
            size={isSheet ? 18 : 16}
          />
        )}
        <Text className={cn(labelClassName, saveTextClassName)}>저장</Text>
      </Button>
      <Button
        className={cn(
          "flex-row gap-2 rounded-xl",
          isSheet ? "h-12 flex-1 sm:h-12" : "h-10 min-w-[104px] px-[18px] sm:h-10",
        )}
        disabled={isBusy}
        variant="gradient"
        onPress={onAiOrganize}
      >
        {pendingRequest === "ai" ? (
          <ActivityIndicator
            accessibilityLabel={SAVING_LABEL}
            tone="onPrimary"
          />
        ) : null}
        <Text className={labelClassName}>AI 정리</Text>
      </Button>
    </View>
  );
}

export { AI_ORGANIZE_CAPTION, LinkCreateBottomBar, SAVE_FAILED_MESSAGE };
export type { LinkCreateBottomBarProps, LinkCreateProviderState };
