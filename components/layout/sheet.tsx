import * as React from "react";
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type AccentName, type ThemeMode, getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";
import { useSheetTracker } from "@/stores/sheet-tracker";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";

import { X } from "lucide-react-native/icons";

/**
 * Signals to descendants that they're rendered inside a BottomSheetModal so they can
 * swap to BottomSheet-aware primitives (e.g. BottomSheetTextInput) — without this swap,
 * the sheet's gesture handler swallows touch events on Android and the Korean IME
 * breaks composition mid-syllable.
 */
const SheetContext = React.createContext<boolean>(false);

function useIsInsideSheet() {
  return React.useContext(SheetContext);
}

// View scope: 모바일 전용. md >= 769px에서는 사용하지 않는다.

type SheetBackgroundProps = BottomSheetBackgroundProps & {
  accent: AccentName;
  mode: ThemeMode;
  backgroundStyle?: StyleProp<ViewStyle>;
};

function SheetBackground({ style, accent, mode, backgroundStyle }: SheetBackgroundProps) {
  const tokens = getThemeTokens(mode, accent);
  const containerStyle = React.useMemo<StyleProp<ViewStyle>>(
    () => [
      style,
      {
        backgroundColor: tokens.background,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderColor: tokens.border,
      },
      backgroundStyle,
    ],
    [backgroundStyle, style, tokens],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={containerStyle}
    />
  );
}

type SheetProps = {
  className?: string;
  open: boolean;
  title?: string;
  dismissible?: boolean;
  /** fitContent=false일 때 기본 스냅 포인트. 기본값 "35%" */
  defaultSize?: string | number;
  /** fitContent=false일 때 최대 스냅 포인트. 기본값 "80%" */
  maxSize?: string | number;
  /** true면 콘텐츠 높이에 맞게 동적 사이징. defaultSize/maxSize는 무시된다. */
  fitContent?: boolean;
  /** fitContent=true일 때 시트가 커질 수 있는 최대 높이(px). 콘텐츠가 더 길면 내부에서 스크롤된다. */
  maxDynamicContentSize?: number;
  accent?: AccentName;
  mode?: ThemeMode;
  backgroundStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  /**
   * BottomSheet stack behaviour. Default 'switch' dismisses any other open sheet
   * when this one presents — pass 'push' to stack on top instead (e.g. a picker
   * inside an already-open editor sheet).
   */
  stackBehavior?: "switch" | "push" | "replace";
};

function Sheet({
  className,
  open,
  title,
  dismissible = true,
  defaultSize = "35%",
  maxSize = "80%",
  fitContent = false,
  maxDynamicContentSize = 700,
  accent,
  mode,
  backgroundStyle,
  children,
  onOpenChange,
  stackBehavior = "switch",
}: SheetProps) {
  const sheetRef = React.useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  // Default to the active app theme so sheets follow dark mode even when the
  // caller doesn't pass mode/accent explicitly.
  const storeTheme = useDisplaySettings((state) => state.display.theme);
  const storeAccent = useDisplaySettings((state) => state.display.accent);
  const resolvedMode = mode ?? storeTheme;
  const resolvedAccent = accent ?? storeAccent;
  const safeTopInset = Math.max(insets.top, 12);
  const snapPoints = React.useMemo(
    () => (fitContent ? undefined : [defaultSize, maxSize]),
    [fitContent, defaultSize, maxSize],
  );

  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      sheetRef.current?.present();
      wasOpenRef.current = true;
    } else if (!open && wasOpenRef.current) {
      sheetRef.current?.dismiss();
      wasOpenRef.current = false;
    }
  }, [open]);

  // Register this sheet as open so global chrome (mobile FAB) can hide while any
  // sheet is up. Cleanup fires on close and on unmount, keeping the count honest.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const { registerOpen, registerClose } = useSheetTracker.getState();
    registerOpen();
    return registerClose;
  }, [open]);
  const sheetTokens = React.useMemo(
    () => getThemeTokens(resolvedMode, resolvedAccent),
    [resolvedAccent, resolvedMode],
  );
  const backdropStyle = React.useMemo<StyleProp<ViewStyle>>(
    () => ({
      backgroundColor:
        resolvedMode === "dark"
          ? `rgba(${sheetTokens.glowRgb}, 0.14)`
          : `rgba(${sheetTokens.glowRgb}, 0.24)`,
    }),
    [resolvedMode, sheetTokens],
  );
  const sheetStyle = React.useMemo<StyleProp<ViewStyle>>(
    () => ({
      shadowColor: `rgb(${sheetTokens.glowRgb})`,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 32,
      elevation: 12,
    }),
    [sheetTokens],
  );

  const handleChange = React.useCallback(
    (index: number) => {
      if (index < 0) {
        onOpenChange?.(false);
      }
    },
    [onOpenChange],
  );
  const handleDismiss = React.useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);
  const handleBackdropPress = React.useCallback(() => {
    onOpenChange?.(false);
    sheetRef.current?.dismiss();
  }, [onOpenChange]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        onPress={dismissible ? handleBackdropPress : undefined}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        style={backdropStyle}
        pressBehavior={dismissible ? "close" : "none"}
      />
    ),
    [backdropStyle, dismissible, handleBackdropPress],
  );
  const renderBackground = React.useCallback(
    (props: BottomSheetBackgroundProps) => (
      <SheetBackground
        {...props}
        accent={resolvedAccent}
        mode={resolvedMode}
        backgroundStyle={backgroundStyle}
      />
    ),
    [resolvedAccent, backgroundStyle, resolvedMode],
  );

  const renderHandle = React.useCallback(
    () => (
      <View className="bg-transparent pt-3">
        <View className="items-center">
          <View className="h-1.5 w-10 rounded-full bg-border" />
        </View>
        {dismissible ? (
          <Pressable
            className="absolute right-3 top-2 size-9 items-center justify-center rounded-full active:bg-accent web:hover:bg-accent"
            hitSlop={8}
            onPress={handleBackdropPress}
          >
            <Icon
              as={X}
              size={18}
              className="text-muted-foreground"
            />
          </Pressable>
        ) : null}
      </View>
    ),
    [dismissible, handleBackdropPress],
  );

  const safeBottomInset = Math.max(insets.bottom, 16);
  const content = (
    <View
      className={cn("gap-4 p-4", className)}
      style={{ paddingBottom: safeBottomInset }}
    >
      {title ? <Text className="text-lg font-semibold">{title}</Text> : null}
      {children}
    </View>
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      topInset={safeTopInset}
      enableDynamicSizing={fitContent}
      maxDynamicContentSize={fitContent ? maxDynamicContentSize : undefined}
      enableContentPanningGesture={false}
      enablePanDownToClose={dismissible}
      stackBehavior={stackBehavior}
      backdropComponent={renderBackdrop}
      backgroundComponent={renderBackground}
      handleComponent={renderHandle}
      style={sheetStyle}
      onChange={handleChange}
      onDismiss={handleDismiss}
    >
      <SheetContext.Provider value={true}>
        <BottomSheetScrollView
          className="scrollbar-none"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </BottomSheetScrollView>
      </SheetContext.Provider>
    </BottomSheetModal>
  );
}

export { Sheet, useIsInsideSheet };
export type { SheetProps };
