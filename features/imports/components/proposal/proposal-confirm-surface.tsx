import * as React from "react";
import { View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";

type ProposalConfirmSurfaceProps = {
  open: boolean;
  isWide: boolean;
  title: string;
  isLocked?: boolean;
  testID?: string;
  children: React.ReactNode;
  renderActions: (isWide: boolean) => React.ReactNode;
  onOpenChange: (open: boolean) => void;
};

function ProposalConfirmSurface({
  open,
  isWide,
  title,
  isLocked = false,
  testID,
  children,
  renderActions,
  onOpenChange,
}: ProposalConfirmSurfaceProps) {
  if (isWide) {
    return (
      <AlertDialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <AlertDialogContent
          className="w-[440px] max-w-[92vw] gap-5 sm:max-w-[92vw]"
          testID={testID}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </AlertDialogHeader>
          {children}
          <AlertDialogFooter className="flex-row justify-end gap-2">
            {renderActions(true)}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  return (
    <Sheet
      open={open}
      dismissible={!isLocked}
      fitContent
      footer={<View className="flex-row gap-2">{renderActions(false)}</View>}
      hideCloseButton
      stackBehavior="push"
      onOpenChange={onOpenChange}
    >
      <View
        accessibilityLabel={title}
        className="gap-4 pb-1"
        testID={testID}
      >
        <Text
          accessibilityRole="header"
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </Text>
        {children}
      </View>
    </Sheet>
  );
}

export { ProposalConfirmSurface };
