import { isLinkNotFound } from "../lib/is-link-not-found";
import { useLinkDetailQuery } from "../queries";
import type { LinkDetail, PublicLinkDetail } from "../types";
import { LinkDetailView } from "./link-detail-view";
import { PublicLinkContent } from "./public-link-content";

function LinkDetailResourceContent({
  detail,
  mode,
  headerAction,
  observeAuthenticatedDetail,
  onClose,
  onDeleted,
}: {
  detail: LinkDetail | PublicLinkDetail;
  mode: "panel" | "screen";
  headerAction?: React.ReactNode;
  observeAuthenticatedDetail?: boolean;
  onClose?: () => void;
  onDeleted?: () => void;
}) {
  if (!("sourceType" in detail)) {
    return (
      <PublicLinkContent
        link={detail}
        mode={mode}
        headerAction={headerAction}
        onBack={onClose}
      />
    );
  }
  const Detail = observeAuthenticatedDetail ? MemberLinkDetailController : LinkDetailView;
  return (
    <Detail
      detail={detail}
      mode={mode}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}

function MemberLinkDetailController(props: React.ComponentProps<typeof LinkDetailView>) {
  const detail = useLinkDetailQuery(props.detail.id, props.detail);
  if (detail.isError && isLinkNotFound(detail.error)) return null;
  return (
    <LinkDetailView
      {...props}
      detail={detail.data ?? props.detail}
    />
  );
}

export { LinkDetailResourceContent };
