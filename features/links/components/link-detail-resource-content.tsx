import type { LinkDetail, PublicLinkDetail } from "../types";
import { LinkDetailView } from "./link-detail-view";
import { PublicLinkContent } from "./public-link-content";

function LinkDetailResourceContent({
  detail,
  mode,
  headerAction,
  onClose,
  onDeleted,
}: {
  detail: LinkDetail | PublicLinkDetail;
  mode: "panel" | "screen";
  headerAction?: React.ReactNode;
  onClose?: () => void;
  onDeleted?: () => void;
}) {
  return "sourceType" in detail ? (
    <LinkDetailView
      detail={detail}
      mode={mode}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  ) : (
    <PublicLinkContent
      link={detail}
      mode={mode}
      headerAction={headerAction}
      onBack={onClose}
    />
  );
}

export { LinkDetailResourceContent };
