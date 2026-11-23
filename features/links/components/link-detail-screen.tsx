import { View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { isLinkNotFound } from "@/features/links/lib/is-link-not-found";
import { useLinkDetailQuery } from "@/features/links/queries";
import { UnavailableResourceRedirect } from "@/features/navigation/components/resource-access";

import type { LinkDetail } from "../types";

function LinkDetailScreen({
  linkId,
  render,
}: {
  linkId?: string;
  render: (state: { detail?: LinkDetail; status?: React.ReactNode }) => React.ReactNode;
}) {
  const linkDetailQuery = useLinkDetailQuery(linkId);

  if (!linkId) {
    return render({
      status: (
        <View className="flex-1 bg-background">
          <EmptyState
            description="유효한 링크 ID가 필요하다."
            title="상세 링크를 찾을 수 없음"
          />
        </View>
      ),
    });
  }

  if (linkDetailQuery.isLoading) {
    return render({
      status: (
        <View className="flex-1 bg-background">
          <EmptyState
            description="링크 상세 정보를 불러오는 중이다."
            title="불러오는 중"
          />
        </View>
      ),
    });
  }

  // A failed refresh keeps the loaded detail on screen; the view shows the failure itself.
  const isNotFound = linkDetailQuery.isError && isLinkNotFound(linkDetailQuery.error);
  if (isNotFound) {
    return (
      <UnavailableResourceRedirect
        kind="links"
        id={Number(linkId)}
      />
    );
  }
  if (!linkDetailQuery.data) {
    return render({
      status: (
        <LoadErrorState
          className="flex-1"
          title="링크 상세를 불러오지 못했어요"
          isRetrying={linkDetailQuery.isFetching}
          onRetry={() => void linkDetailQuery.refetch()}
        />
      ),
    });
  }

  return render({ detail: linkDetailQuery.data });
}

export { LinkDetailScreen };
