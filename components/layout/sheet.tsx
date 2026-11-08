import * as React from "react";
import { Keyboard, Pressable, type StyleProp, View, type ViewStyle } from "react-native";
import Animated, {
  type EasingFunctionFactory,
  type SharedValue,
  useDerivedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type AccentName, type ThemeMode, getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";
import { useSheetTracker } from "@/stores/sheet-tracker";
import {
  ANIMATION_STATUS,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
  useBottomSheetInternal,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";

import { useSheetHostScrollLock } from "./use-sheet-host-scroll-lock";

import { ChevronLeft, X } from "lucide-react-native/icons";

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

type SheetScroll = {
  /** Scrolls the sheet body so `target`, a view inside it, sits `offset` px below the top. */
  scrollToView: (target: View, offset?: number) => void;
};

const SheetScrollContext = React.createContext<SheetScroll | null>(null);

// The scroll handle of the sheet around the caller; null outside a sheet.
function useSheetScroll() {
  return React.use(SheetScrollContext);
}

type SheetHeaderState = { title: string; hasBack: boolean };

type SheetHeaderSlot = {
  setHeader: (header: SheetHeaderState | null) => void;
  backRef: React.RefObject<(() => void) | null>;
};

const SheetHeaderSlotContext = React.createContext<SheetHeaderSlot | null>(null);

const EMPTY_HEADER: SheetHeaderState = { title: "", hasBack: false };

/**
 * Puts a fixed head on the sheet around it: the title in the middle, an optional back
 * button on the left and the close button on the right, above a divider. The body
 * scrolls under it. Outside a sheet it renders the title as a plain line.
 */
function SheetHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const slot = React.use(SheetHeaderSlotContext);
  const hasBack = onBack != null;
  React.useLayoutEffect(() => {
    if (slot) slot.backRef.current = onBack ?? null;
  });
  React.useLayoutEffect(() => {
    slot?.setHeader({ title, hasBack });
  }, [hasBack, slot, title]);
  React.useLayoutEffect(() => {
    if (!slot) return;
    return () => slot.setHeader(null);
  }, [slot]);
  if (slot) {
    return null;
  }
  return <Text className="text-center text-[17px] font-semibold text-foreground">{title}</Text>;
}

function SheetHeaderBar({
  header,
  showCloseButton,
  onBack,
  onClose,
}: {
  header: SheetHeaderState;
  showCloseButton: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <View className="bg-transparent pt-2">
      <View className="items-center">
        <View className="h-1.5 w-10 rounded-full bg-border" />
      </View>
      <View className="h-12 flex-row items-center gap-2 border-b border-border px-2">
        <View className="w-10 items-start">
          {header.hasBack ? (
            <Pressable
              className="size-10 items-center justify-center rounded-full active:bg-accent web:hover:bg-accent"
              accessibilityLabel="뒤로"
              accessibilityRole="button"
              onPress={onBack}
            >
              <Icon
                as={ChevronLeft}
                size={18}
                className="text-foreground"
              />
            </Pressable>
          ) : null}
        </View>
        <Text
          accessibilityRole="header"
          className="flex-1 text-center text-[17px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {header.title}
        </Text>
        <View className="w-10 items-end">
          {showCloseButton ? (
            <Pressable
              className="size-9 items-center justify-center rounded-full active:bg-accent web:hover:bg-accent"
              accessibilityLabel="닫기"
              accessibilityRole="button"
              hitSlop={4}
              onPress={onClose}
            >
              <Icon
                as={X}
                size={18}
                className="text-muted-foreground"
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

type SheetMotion = {
  position: SharedValue<number>;
  target: SharedValue<number | null>;
};

const SheetMotionContext = React.createContext<SheetMotion | null>(null);

type SheetFooterSnapshot = {
  propNode: React.ReactNode;
  slotNode: React.ReactNode;
  bottomInset: number;
};

type SheetFooterStore = {
  getSnapshot: () => SheetFooterSnapshot;
  subscribe: (listener: () => void) => () => void;
  update: (next: Partial<SheetFooterSnapshot>) => void;
};

function createSheetFooterStore(bottomInset: number): SheetFooterStore {
  let snapshot: SheetFooterSnapshot = { propNode: null, slotNode: null, bottomInset };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (next) => {
      const merged = { ...snapshot, ...next };
      if (
        merged.propNode === snapshot.propNode &&
        merged.slotNode === snapshot.slotNode &&
        merged.bottomInset === snapshot.bottomInset
      ) {
        return;
      }
      snapshot = merged;
      listeners.forEach((listener) => listener());
    },
  };
}

type SheetFooterSlot = {
  setNode: (node: React.ReactNode) => void;
  setPresent: (present: boolean) => void;
};

const SheetFooterSlotContext = React.createContext<SheetFooterSlot | null>(null);

function isKeyboardVisibleNow() {
  return typeof Keyboard.isVisible === "function" ? Keyboard.isVisible() : false;
}

function useIsKeyboardShown(active: boolean) {
  const [isShown, setIsShown] = React.useState(() => active && isKeyboardVisibleNow());
  React.useEffect(() => {
    if (!active) {
      setIsShown(false);
      return;
    }
    setIsShown(isKeyboardVisibleNow());
    const showSubscription = Keyboard.addListener("keyboardWillShow", () => setIsShown(true));
    const hideSubscription = Keyboard.addListener("keyboardWillHide", () => setIsShown(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [active]);
  return isShown;
}

function SheetFooter({ children }: { children: React.ReactNode }) {
  const slot = React.use(SheetFooterSlotContext);
  React.useLayoutEffect(() => {
    slot?.setNode(children);
  }, [children, slot]);
  React.useLayoutEffect(() => {
    if (!slot) {
      return;
    }
    slot.setPresent(true);
    return () => {
      slot.setPresent(false);
      slot.setNode(null);
    };
  }, [slot]);
  if (!slot) {
    return <>{children}</>;
  }
  return null;
}

function SheetFooterContent({
  store,
  onHeightChange,
}: {
  store: SheetFooterStore;
  onHeightChange: (height: number) => void;
}) {
  const snapshot = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return (
    <View
      className="border-t border-border-soft bg-background px-4 pt-3"
      style={{ paddingBottom: snapshot.bottomInset }}
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
    >
      {snapshot.propNode ?? snapshot.slotNode}
    </View>
  );
}

function useSheetMotion() {
  return React.use(SheetMotionContext);
}

function SheetMotionProvider({ children }: { children: React.ReactNode }) {
  const { animatedPosition, animatedAnimationState } = useBottomSheetInternal();
  const target = useDerivedValue(() => {
    const { status, nextPosition } = animatedAnimationState.value;
    return status === ANIMATION_STATUS.RUNNING && nextPosition != null ? nextPosition : null;
  });
  const motion = React.useMemo(
    () => ({ position: animatedPosition, target }),
    [animatedPosition, target],
  );
  return <SheetMotionContext.Provider value={motion}>{children}</SheetMotionContext.Provider>;
}

type SheetResizeTiming = { duration: number; easing: EasingFunctionFactory };

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
  hideCloseButton?: boolean;
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
  /** 시트 아래에 고정되는 영역. 키보드가 올라오면 키보드 바로 위에 붙는다. */
  footer?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  /**
   * BottomSheet stack behaviour. Default 'switch' dismisses any other open sheet
   * when this one presents — pass 'push' to stack on top instead (e.g. a picker
   * inside an already-open editor sheet).
   */
  stackBehavior?: "switch" | "push" | "replace";
  /**
   * Timing for every move of the sheet (open, close, content resize) instead of the default
   * spring, so a sheet whose content animates its height can follow it frame for frame.
   */
  resizeTiming?: SheetResizeTiming;
  /**
   * Asked before a close the user starts (×, backdrop, dragging down). Returning false keeps
   * the sheet open, so the caller can confirm first; a dragged-down sheet comes back up. It
   * is also asked if another "switch" sheet minimises this one, which cannot be held.
   */
  onCloseRequest?: () => boolean;
  /**
   * Draws the fixed head from the first frame for a sheet whose content puts a SheetHeader
   * in it, so the head does not grow in while the sheet slides in.
   */
  fixedHeader?: boolean;
};

function Sheet({
  className,
  open,
  title,
  dismissible = true,
  hideCloseButton = false,
  defaultSize = "35%",
  maxSize = "80%",
  fitContent = false,
  maxDynamicContentSize = 700,
  accent,
  mode,
  backgroundStyle,
  children,
  footer,
  onOpenChange,
  stackBehavior = "switch",
  resizeTiming,
  onCloseRequest,
  fixedHeader = false,
}: SheetProps) {
  const [footerHeight, setFooterHeight] = React.useState(0);
  const [hasSlotFooter, setHasSlotFooter] = React.useState(false);
  const hostScrollLockRef = useSheetHostScrollLock();
  const scrollViewRef = React.useRef<BottomSheetScrollViewMethods>(null);
  const bodyRef = React.useRef<View | null>(null);
  const contentRef = React.useCallback(
    (node: View | null) => {
      bodyRef.current = node;
      hostScrollLockRef?.(node);
    },
    [hostScrollLockRef],
  );
  const sheetScroll = React.useMemo<SheetScroll>(
    () => ({
      scrollToView: (target, offset = 16) => {
        const body = bodyRef.current;
        const scrollView = scrollViewRef.current;
        if (!body || !scrollView) return;
        target.measureLayout(
          body,
          (_x, y) => scrollView.scrollTo({ y: Math.max(0, y - offset), animated: true }),
          () => undefined,
        );
      },
    }),
    [],
  );
  const resizeConfigs = useBottomSheetTimingConfigs({
    duration: resizeTiming?.duration,
    easing: resizeTiming?.easing,
  });
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
  const isPresentedRef = React.useRef(false);
  const isClosingRef = React.useRef(false);
  const isPresentPendingRef = React.useRef(false);
  const hasShownRef = React.useRef(false);
  const isDismissPendingRef = React.useRef(false);
  const closeReportedRef = React.useRef(false);
  const isMountedRef = React.useRef(false);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useLayoutEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  const onCloseRequestRef = React.useRef(onCloseRequest);
  React.useLayoutEffect(() => {
    onCloseRequestRef.current = onCloseRequest;
  }, [onCloseRequest]);
  const hasCloseRequest = onCloseRequest != null;
  const [header, setHeader] = React.useState<SheetHeaderState | null>(null);
  const headerBackRef = React.useRef<(() => void) | null>(null);
  const headerSlot = React.useMemo<SheetHeaderSlot>(
    () => ({ setHeader, backRef: headerBackRef }),
    [],
  );
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const presentSheet = React.useCallback(() => {
    isPresentedRef.current = true;
    hasShownRef.current = false;
    closeReportedRef.current = false;
    sheetRef.current?.present();
  }, []);
  const dismissSheet = React.useCallback(() => {
    isClosingRef.current = true;
    sheetRef.current?.dismiss();
  }, []);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      if (isDismissPendingRef.current) {
        isDismissPendingRef.current = false;
      } else if (isClosingRef.current) {
        isPresentPendingRef.current = true;
      } else {
        presentSheet();
      }
    } else if (!open && wasOpenRef.current) {
      // Cleared before dismissing so the onChange(-1)/onDismiss this close produces is not
      // reported back to the caller that asked for it.
      wasOpenRef.current = false;
      isPresentPendingRef.current = false;
      if (isPresentedRef.current && !isClosingRef.current) {
        if (hasShownRef.current) {
          dismissSheet();
        } else {
          isDismissPendingRef.current = true;
        }
      }
    }
  }, [dismissSheet, open, presentSheet]);

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

  const reportUserClose = React.useCallback(() => {
    if (!isMountedRef.current || !wasOpenRef.current || closeReportedRef.current) {
      return;
    }
    closeReportedRef.current = true;
    onOpenChangeRef.current?.(false);
  }, []);
  const handleChange = React.useCallback(
    (index: number) => {
      if (index >= 0) {
        hasShownRef.current = true;
        closeReportedRef.current = false;
        if (isDismissPendingRef.current) {
          isDismissPendingRef.current = false;
          dismissSheet();
        }
      } else if (!isClosingRef.current) {
        reportUserClose();
      }
    },
    [dismissSheet, reportUserClose],
  );
  // A drag-down starts closing on its own; a close request that says no sends it back up
  // before the close finishes. Closes this sheet asked for itself are not asked again.
  const handleAnimate = React.useCallback((_fromIndex: number, toIndex: number) => {
    const onRequest = onCloseRequestRef.current;
    if (toIndex !== -1 || !onRequest || isClosingRef.current || !isMountedRef.current) {
      return;
    }
    if (!onRequest()) {
      sheetRef.current?.snapToIndex(0);
    }
  }, []);
  const handleDismiss = React.useCallback(() => {
    const wasClosing = isClosingRef.current;
    isPresentedRef.current = false;
    isClosingRef.current = false;
    isDismissPendingRef.current = false;
    if (isPresentPendingRef.current) {
      isPresentPendingRef.current = false;
      requestAnimationFrame(() => {
        if (isMountedRef.current && wasOpenRef.current && !isPresentedRef.current) {
          presentSheet();
        }
      });
      return;
    }
    if (!wasClosing) {
      reportUserClose();
    }
  }, [presentSheet, reportUserClose]);
  const handleClosePress = React.useCallback(() => {
    if (!isPresentedRef.current || isClosingRef.current) {
      return;
    }
    if (onCloseRequestRef.current && !onCloseRequestRef.current()) {
      return;
    }
    reportUserClose();
    dismissSheet();
  }, [dismissSheet, reportUserClose]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        onPress={dismissible ? handleClosePress : undefined}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        style={backdropStyle}
        pressBehavior={dismissible && !hasCloseRequest ? "close" : "none"}
      >
        {/* "none" drops the backdrop's own tap, so a guarded sheet takes the tap here. */}
        {dismissible && hasCloseRequest ? (
          <Pressable
            accessible={false}
            className="flex-1"
            testID="sheet-backdrop-press"
            onPress={handleClosePress}
          />
        ) : null}
      </BottomSheetBackdrop>
    ),
    [backdropStyle, dismissible, handleClosePress, hasCloseRequest],
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

  const renderHandle = React.useCallback(() => {
    if (header || fixedHeader) {
      return (
        <SheetHeaderBar
          header={header ?? EMPTY_HEADER}
          showCloseButton={dismissible && !hideCloseButton}
          onBack={() => headerBackRef.current?.()}
          onClose={handleClosePress}
        />
      );
    }
    return (
      <View className="bg-transparent pt-3">
        <View className="items-center">
          <View className="h-1.5 w-10 rounded-full bg-border" />
        </View>
        {dismissible && !hideCloseButton ? (
          <Pressable
            className="absolute right-3 top-2 size-9 items-center justify-center rounded-full active:bg-accent web:hover:bg-accent"
            accessibilityLabel="닫기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleClosePress}
          >
            <Icon
              as={X}
              size={18}
              className="text-muted-foreground"
            />
          </Pressable>
        ) : null}
      </View>
    );
  }, [dismissible, fixedHeader, handleClosePress, header, hideCloseButton]);

  const safeBottomInset = Math.max(insets.bottom, 16);
  const hasFooter = footer != null || hasSlotFooter;
  const isKeyboardShown = useIsKeyboardShown(hasFooter);
  const footerBottomInset = isKeyboardShown ? 12 : safeBottomInset;
  const [footerStore] = React.useState(() => createSheetFooterStore(footerBottomInset));
  React.useLayoutEffect(() => {
    footerStore.update({ propNode: footer ?? null, bottomInset: footerBottomInset });
  }, [footer, footerBottomInset, footerStore]);
  const footerSlot = React.useMemo<SheetFooterSlot>(
    () => ({
      setNode: (slotNode) => footerStore.update({ slotNode }),
      setPresent: setHasSlotFooter,
    }),
    [footerStore],
  );
  const renderFooter = React.useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <SheetFooterContent
          store={footerStore}
          onHeightChange={setFooterHeight}
        />
      </BottomSheetFooter>
    ),
    [footerStore],
  );
  const content = (
    <View
      ref={contentRef}
      className={cn("gap-4 p-4", className)}
      style={{
        paddingBottom: hasFooter ? footerHeight + 16 : safeBottomInset,
      }}
    >
      {title ? <Text className="text-lg font-semibold">{title}</Text> : null}
      <SheetHeaderSlotContext value={headerSlot}>{children}</SheetHeaderSlotContext>
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
      animationConfigs={resizeTiming ? resizeConfigs : undefined}
      backdropComponent={renderBackdrop}
      backgroundComponent={renderBackground}
      footerComponent={hasFooter ? renderFooter : undefined}
      handleComponent={renderHandle}
      style={sheetStyle}
      onAnimate={handleAnimate}
      onChange={handleChange}
      onDismiss={handleDismiss}
    >
      <SheetContext.Provider value={true}>
        <SheetFooterSlotContext value={footerSlot}>
          <SheetScrollContext value={sheetScroll}>
            <SheetMotionProvider>
              <BottomSheetScrollView
                ref={scrollViewRef}
                className="scrollbar-none"
                showsVerticalScrollIndicator={false}
              >
                {content}
              </BottomSheetScrollView>
            </SheetMotionProvider>
          </SheetScrollContext>
        </SheetFooterSlotContext>
      </SheetContext.Provider>
    </BottomSheetModal>
  );
}

export { Sheet, SheetFooter, SheetHeader, useIsInsideSheet, useSheetMotion, useSheetScroll };
export type { SheetMotion, SheetProps, SheetScroll };
