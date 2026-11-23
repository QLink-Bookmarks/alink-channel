import * as React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { getThemeTokens } from "@/lib/theme";
import { useDisplaySettings } from "@/stores/display-settings";
import { useSheetTracker } from "@/stores/sheet-tracker";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";

import type { LinkShareSheetProps } from "./link-share-sheet";

import { X } from "lucide-react-native/icons";

function ShareSheetContainer({ children }: { children?: React.ReactNode }) {
  return (
    <View
      accessibilityViewIsModal
      className="absolute inset-0"
      pointerEvents="box-none"
    >
      {children}
    </View>
  );
}

function LinkShareSheet({ open, title, children, onOpenChange }: LinkShareSheetProps) {
  const sheet = React.useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { theme, accent } = useDisplaySettings((state) => state.display);
  const tokens = getThemeTokens(theme, accent);

  React.useEffect(() => {
    if (!open) return;
    sheet.current?.present();
    const { registerOpen, registerClose } = useSheetTracker.getState();
    registerOpen();
    return registerClose;
  }, [open]);

  const handleClose = React.useCallback(() => sheet.current?.dismiss(), []);
  const renderHandle = React.useCallback(
    () => (
      <View className="pt-2">
        <View className="h-1.5 w-10 self-center rounded-full bg-border" />
        <View className="h-12 flex-row items-center gap-2 border-b border-border px-2">
          <View className="w-10" />
          <Text
            accessibilityRole="header"
            className="flex-1 text-center text-[17px] font-semibold"
            numberOfLines={1}
          >
            {title}
          </Text>
          <IconButton
            accessibilityLabel="닫기"
            className="mr-1 rounded-full"
            hitSlop={4}
            icon={X}
            size="sm"
            variant="ghost"
            onPress={handleClose}
          />
        </View>
      </View>
    ),
    [handleClose, title],
  );
  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        style={{ backgroundColor: `rgba(${tokens.glowRgb}, ${theme === "dark" ? 0.14 : 0.24})` }}
      />
    ),
    [theme, tokens.glowRgb],
  );

  return (
    <BottomSheetModal
      ref={sheet}
      accessible={false}
      accessibilityLabel={null}
      accessibilityRole={null}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: tokens.background,
        borderColor: tokens.border,
        borderWidth: 1,
        borderRadius: 28,
      }}
      containerComponent={ShareSheetContainer}
      enableContentPanningGesture={false}
      enablePanDownToClose
      handleComponent={renderHandle}
      topInset={Math.max(insets.top, 12)}
      onDismiss={() => onOpenChange(false)}
    >
      <BottomSheetScrollView
        className="scrollbar-none"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="gap-4 p-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {children}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export { LinkShareSheet };
