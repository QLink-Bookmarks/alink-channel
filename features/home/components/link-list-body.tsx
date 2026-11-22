import { ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { Text } from "@/components/ui/text";

import { LinkFilterRow, type LinkFilterRowProps } from "./link-filter-row";

import type { LucideIcon } from "lucide-react-native";

type LinkListBodyProps = {
  title: string;
  emoji?: string;
  icon?: LucideIcon;
  headerActions?: React.ReactNode;
  scrollRef?: React.Ref<ScrollView>;
  scrollProps: React.ComponentProps<typeof ScrollView>;
  meta: string | null;
  filter: Omit<LinkFilterRowProps, "children" | "className" | "testID">;
  isLoadError: boolean;
  isEmpty: boolean;
  isRetrying: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  onRetry: () => void;
  pagination: Pick<
    React.ComponentProps<typeof PaginationFooter>,
    "isLoading" | "isError" | "onRetry"
  >;
  children: React.ReactNode;
};

function LinkListBody({
  title,
  emoji,
  icon,
  headerActions,
  scrollRef,
  scrollProps,
  meta,
  filter,
  isLoadError,
  isEmpty,
  isRetrying,
  emptyTitle,
  emptyDescription,
  onRetry,
  pagination,
  children,
}: LinkListBodyProps) {
  return (
    <ScrollView
      ref={scrollRef}
      {...scrollProps}
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        title={title}
        emoji={emoji}
        icon={icon}
        actions={headerActions}
        titleAccessibilityRole="header"
      />
      <View
        className="gap-5 px-6 pb-24 pt-4 md:pb-6 md:pt-0"
        testID="link-list-body"
      >
        <LinkFilterRow
          {...filter}
          className="md:-mt-4"
          testID="link-filter-row"
        >
          {meta != null ? <Text className="text-sm text-muted-foreground">{meta}</Text> : null}
        </LinkFilterRow>
        {isLoadError ? (
          <LoadErrorState
            title="링크를 불러오지 못했어요"
            isRetrying={isRetrying}
            onRetry={onRetry}
          />
        ) : isEmpty ? (
          <EmptyState
            emoji="📭"
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          children
        )}
        <PaginationFooter
          {...pagination}
          errorTitle="링크를 불러오지 못했어요"
        />
      </View>
    </ScrollView>
  );
}

export { LinkListBody };
export type { LinkListBodyProps };
