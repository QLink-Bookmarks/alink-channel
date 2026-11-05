import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { SlideInRight, SlideOutRight } from "react-native-reanimated";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useWideView } from "@/lib/hooks/use-wide-view";
import { cn } from "@/lib/utils";
import { openImportFlow } from "@/stores/import-flow";

import { useImportProgressRefresh } from "../../hooks/use-import-progress-refresh";
import { useJustImportedIds } from "../../hooks/use-just-imported-ids";
import { useOpenImportedLinks } from "../../hooks/use-open-imported-links";
import { useReversalStatus } from "../../hooks/use-reversal-status";
import { isImportAvailable } from "../../lib/import-availability";
import { IMPORTS_PATH, getImportDetailPath } from "../../lib/import-paths";
import { useImportsQuery } from "../../queries";
import type { ImportSummary } from "../../types";
import { WebOnlyImportNote } from "../flow/web-only-import-note";
import { ReversalModal, type ReversalTarget } from "../reversal/reversal-modal";
import {
  clearDetailOpenedFromList,
  markDetailOpenedFromList,
  wasDetailOpenedFromList,
} from "./detail-navigation";
import { ImportBreadcrumb } from "./import-breadcrumb";
import { ImportDetailView } from "./import-detail-view";
import { ImportHistoryList } from "./import-history-list";
import { ReversalSuccessStatus } from "./reversal-success-status";

import { type Href, useIsFocused, useRouter } from "expo-router";
import { Upload } from "lucide-react-native";

const DETAIL_PANEL_LABEL = "가져오기 기록 상세";
const DETAIL_ENTER_MS = 220;

function useCloseOnEscape(enabled: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!enabled || process.env.EXPO_OS !== "web" || typeof document === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      const otherDialogs = Array.from(
        document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
      ).filter((element) => element.getAttribute("aria-label") !== DETAIL_PANEL_LABEL);
      if (otherDialogs.length > 0) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onClose]);
}

function ImportHistoryScreen({ detailId }: { detailId?: number }) {
  const router = useRouter();
  const isWide = useWideView();
  const isFocused = useIsFocused();
  const importsQuery = useImportsQuery({ isScreenFocused: isFocused });
  const summaries = React.useMemo(
    () => importsQuery.data?.pages.flatMap((page) => page.contents) ?? [],
    [importsQuery.data],
  );
  useImportProgressRefresh(importsQuery.data ? summaries : undefined);
  const justImportedIds = useJustImportedIds(importsQuery.data ? summaries : undefined);
  const { openImportedLinks, pendingId: openingLinksId } = useOpenImportedLinks();
  const [reversalTarget, setReversalTarget] = React.useState<ReversalTarget | null>(null);
  const { status: reversalStatus, showReversalStatus } = useReversalStatus(isFocused);

  const handleOpenDetail = React.useCallback(
    (summary: ImportSummary) => {
      markDetailOpenedFromList(summary.id);
      router.push(getImportDetailPath(summary.id) as Href);
    },
    [router],
  );
  const handleCloseDetail = React.useCallback(() => {
    const canReturnToList =
      detailId !== undefined && wasDetailOpenedFromList(detailId) && router.canGoBack();
    clearDetailOpenedFromList();
    if (canReturnToList) {
      router.back();
      return;
    }
    router.replace(IMPORTS_PATH as Href);
  }, [detailId, router]);
  const handleReverse = React.useCallback((target: ReversalTarget) => {
    setReversalTarget(target);
  }, []);
  const handleCloseReversal = React.useCallback(() => setReversalTarget(null), []);
  const handleOpenLinks = React.useCallback(
    (summary: ImportSummary) => {
      void openImportedLinks(summary.id);
    },
    [openImportedLinks],
  );
  const handleNewImport = React.useCallback(() => {
    openImportFlow({ from: "settings" });
  }, []);

  const isDetailOpen = isWide && detailId !== undefined;
  useCloseOnEscape(isDetailOpen && reversalTarget == null, handleCloseDetail);
  const detailPaneRef = React.useRef<View>(null);
  React.useEffect(() => {
    if (!isDetailOpen || process.env.EXPO_OS !== "web") {
      return;
    }
    const timer = setTimeout(() => {
      (detailPaneRef.current as unknown as HTMLElement | null)?.focus?.();
    }, DETAIL_ENTER_MS);
    return () => clearTimeout(timer);
  }, [detailId, isDetailOpen]);

  return (
    <>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-auto w-full gap-6 px-4 pb-12 pt-4 md:max-w-3xl md:px-6 md:pt-8">
          {isWide && process.env.EXPO_OS === "web" ? <ImportBreadcrumb /> : null}
          <View className="gap-4 md:flex-row md:items-center md:justify-between">
            <View className="gap-1 md:flex-1">
              <Text
                role="heading"
                aria-level={1}
                className="text-2xl font-bold text-foreground"
              >
                북마크 가져오기
              </Text>
              <Text className="text-sm text-muted-foreground">
                브라우저에서 내보낸 북마크 파일로 링크와 폴더를 한 번에 옮겨요.
              </Text>
            </View>
            {isImportAvailable() ? (
              <Button
                size="lg"
                className={cn(!isWide && "w-full")}
                onPress={handleNewImport}
              >
                <Icon
                  as={Upload}
                  size={16}
                  className="text-primary-foreground"
                />
                <Text>새로 가져오기</Text>
              </Button>
            ) : (
              <WebOnlyImportNote className={cn("h-11 sm:h-10", !isWide && "w-full")} />
            )}
          </View>

          <View className="gap-3">
            <View>
              <Text
                role="heading"
                aria-level={2}
                className="text-base font-semibold text-foreground"
              >
                가져오기 기록
              </Text>
              <ReversalSuccessStatus status={reversalStatus} />
            </View>
            <ImportHistoryList
              summaries={summaries}
              justImportedIds={justImportedIds}
              openingLinksId={openingLinksId}
              isWide={isWide}
              isLoading={importsQuery.isLoading}
              isError={importsQuery.isError}
              hasNextPage={importsQuery.hasNextPage}
              isFetchingNextPage={importsQuery.isFetchingNextPage}
              onRetry={() => void importsQuery.refetch()}
              onLoadMore={() => void importsQuery.fetchNextPage()}
              onOpenDetail={handleOpenDetail}
              onOpenLinks={handleOpenLinks}
              onReverse={handleReverse}
            />
          </View>
        </View>
      </ScrollView>

      {isDetailOpen ? (
        <View
          className={cn(
            "bottom-0 left-0 right-0 top-0 z-backdrop",
            process.env.EXPO_OS === "web" ? "fixed" : "absolute",
          )}
        >
          <Pressable
            accessibilityLabel="기록 상세 닫기"
            className="absolute bottom-0 left-0 right-0 top-0 bg-overlay"
            onPress={handleCloseDetail}
          />
          <View
            className="absolute bottom-0 left-0 right-0 top-0 flex-row justify-end"
            pointerEvents="box-none"
          >
            <Animated.View
              entering={SlideInRight.duration(DETAIL_ENTER_MS)}
              exiting={SlideOutRight.duration(180)}
            >
              <View
                ref={detailPaneRef}
                className="h-full w-[520px] max-w-[100vw] overflow-hidden border-l border-border bg-background outline-none"
                role="dialog"
                aria-modal
                aria-label={DETAIL_PANEL_LABEL}
                focusable
              >
                <ImportDetailView
                  key={detailId}
                  importId={detailId}
                  mode="panel"
                  onBack={handleCloseDetail}
                  onReverse={handleReverse}
                />
              </View>
            </Animated.View>
          </View>
        </View>
      ) : null}

      <ReversalModal
        target={reversalTarget}
        onClose={handleCloseReversal}
        onReversed={showReversalStatus}
      />
    </>
  );
}

export { ImportHistoryScreen };
