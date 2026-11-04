import * as React from "react";
import { View, useWindowDimensions } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { FolderSection } from "@/stores/folder-navigation";

import { useFolderPickerConfirm } from "../hooks/use-folder-picker-confirm";
import {
  type FolderPickerId,
  FolderPickerList,
  type FolderPickerListProps,
  type FolderPickerSelection,
} from "./folder-picker-list";

import { CircleAlert } from "lucide-react-native/icons";

const SHEET_MAX_HEIGHT_RATIO = 0.86;
const DIALOG_MAX_HEIGHT = 640;
const DIALOG_HEIGHT_RATIO = 0.8;
const SHEET_FIXED_PARTS_HEIGHT = 440;
const SHEET_LIST_MIN_HEIGHT = 120;
const SHEET_LIST_HEIGHT_RATIO = 0.4;

function getSheetListMaxHeight(windowHeight: number) {
  const available = windowHeight * SHEET_MAX_HEIGHT_RATIO - SHEET_FIXED_PARTS_HEIGHT;
  return Math.round(
    Math.max(SHEET_LIST_MIN_HEIGHT, Math.min(available, windowHeight * SHEET_LIST_HEIGHT_RATIO)),
  );
}

type FolderPickerDialogPresentation = "dialog" | "sheet";

type FolderPickerListSlot<Id> = {
  selectedId: Id | null;
  isPending: boolean;
  listMaxHeight?: number;
  className: string;
  onSelect: (selection: FolderPickerSelection<Id>) => void;
};

type FolderPickerDialogBaseProps<Id> = {
  open: boolean;
  presentation: FolderPickerDialogPresentation;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  errorMessage: string;
  initialFolderId?: Id;
  noneOption?: FolderPickerListProps["noneOption"];
  visibleSections?: FolderSection[];
  stackBehavior?: "switch" | "push" | "replace";
  onOpenChange: (open: boolean) => void;
  onConfirm: (selection: FolderPickerSelection<Id>) => Promise<void>;
};

type FolderPickerDialogProps<Id = FolderPickerId> = FolderPickerDialogBaseProps<Id> &
  ([Id] extends [FolderPickerId]
    ? [FolderPickerId] extends [Id]
      ? { renderList?: (slot: FolderPickerListSlot<Id>) => React.ReactNode }
      : { renderList: (slot: FolderPickerListSlot<Id>) => React.ReactNode }
    : { renderList: (slot: FolderPickerListSlot<Id>) => React.ReactNode });

function renderDefaultList(
  slot: FolderPickerListSlot<FolderPickerId>,
  options: Pick<FolderPickerDialogBaseProps<FolderPickerId>, "noneOption" | "visibleSections">,
) {
  return (
    <FolderPickerList
      className={slot.className}
      isAddDisabled={slot.isPending}
      listMaxHeight={slot.listMaxHeight}
      noneOption={options.noneOption}
      selectedFolderId={slot.selectedId}
      visibleSections={options.visibleSections}
      onSelect={slot.onSelect}
    />
  );
}

function FolderPickerDialog<Id = FolderPickerId>(props: FolderPickerDialogProps<Id>) {
  const {
    open,
    presentation,
    title,
    description,
    confirmLabel,
    pendingLabel,
    errorMessage,
    initialFolderId,
    noneOption,
    visibleSections,
    stackBehavior,
    renderList,
    onOpenChange,
    onConfirm,
  } = props as FolderPickerDialogBaseProps<Id> & {
    renderList?: (slot: FolderPickerListSlot<Id>) => React.ReactNode;
  };
  const { height } = useWindowDimensions();
  const { selection, error, isPending, canConfirm, select, confirm, requestOpenChange } =
    useFolderPickerConfirm({ open, initialFolderId, errorMessage, onConfirm, onOpenChange });
  const isSheet = presentation === "sheet";

  const handleCancelPress = React.useCallback(() => requestOpenChange(false), [requestOpenChange]);
  const handleConfirmPress = React.useCallback(() => {
    void confirm();
  }, [confirm]);

  const slot: FolderPickerListSlot<Id> = {
    selectedId: selection?.id ?? null,
    isPending,
    listMaxHeight: isSheet ? getSheetListMaxHeight(height) : undefined,
    className: isSheet ? "min-h-0 shrink" : "min-h-0 flex-1",
    onSelect: select,
  };
  const list = renderList
    ? renderList(slot)
    : renderDefaultList(slot as unknown as FolderPickerListSlot<FolderPickerId>, {
        noneOption,
        visibleSections,
      });

  const footer = (
    <FolderPickerDialogFooter
      canConfirm={canConfirm}
      confirmLabel={confirmLabel}
      error={error}
      isPending={isPending}
      isSheet={isSheet}
      pendingLabel={pendingLabel}
      onCancelPress={handleCancelPress}
      onConfirmPress={handleConfirmPress}
    />
  );

  if (!isSheet) {
    return (
      <Dialog
        open={open}
        onOpenChange={requestOpenChange}
      >
        <DialogContent
          hideCloseButton
          className="max-h-[80vh] w-[420px] max-w-[90vw] gap-3.5 rounded-[20px] sm:max-w-[90vw]"
          style={{ height: Math.min(DIALOG_MAX_HEIGHT, Math.round(height * DIALOG_HEIGHT_RATIO)) }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {list}
          {footer}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet
      open={open}
      dismissible={!isPending}
      fitContent
      footer={footer}
      hideCloseButton
      maxDynamicContentSize={Math.round(height * SHEET_MAX_HEIGHT_RATIO)}
      stackBehavior={stackBehavior}
      onOpenChange={requestOpenChange}
    >
      <View className="gap-3">
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            className="text-lg font-semibold text-foreground"
          >
            {title}
          </Text>
          <Text className="text-sm text-muted-foreground">{description}</Text>
        </View>
        {list}
      </View>
    </Sheet>
  );
}

function FolderPickerDialogFooter({
  canConfirm,
  confirmLabel,
  error,
  isPending,
  isSheet,
  pendingLabel,
  onCancelPress,
  onConfirmPress,
}: {
  canConfirm: boolean;
  confirmLabel: string;
  error: string | null;
  isPending: boolean;
  isSheet: boolean;
  pendingLabel: string;
  onCancelPress: () => void;
  onConfirmPress: () => void;
}) {
  const buttonClassName = isSheet
    ? "h-12 flex-1 rounded-xl"
    : "h-10 min-w-[88px] rounded-xl px-[18px]";
  const labelClassName = isSheet ? "text-base font-semibold" : "text-sm font-semibold";

  return (
    <View className="gap-2.5">
      {error ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="flex-row items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5"
        >
          <Icon
            as={CircleAlert}
            className="size-4 shrink-0 text-destructive"
          />
          <Text className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{error}</Text>
        </View>
      ) : null}
      <View
        className={cn(
          "flex-row gap-2",
          !isSheet && "justify-end border-t border-border-soft pt-3.5",
        )}
      >
        <Button
          className={buttonClassName}
          disabled={isPending}
          variant="outline"
          onPress={onCancelPress}
        >
          <Text className={labelClassName}>취소</Text>
        </Button>
        <Button
          accessibilityState={{ busy: isPending, disabled: !canConfirm }}
          aria-busy={isPending}
          className={cn(buttonClassName, "flex-row gap-2")}
          disabled={!canConfirm}
          onPress={onConfirmPress}
        >
          {isPending ? <ActivityIndicator tone="onPrimary" /> : null}
          <Text className={labelClassName}>{isPending ? pendingLabel : confirmLabel}</Text>
        </Button>
      </View>
    </View>
  );
}

export { FolderPickerDialog };
export type { FolderPickerDialogPresentation, FolderPickerDialogProps };
