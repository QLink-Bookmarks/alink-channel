import { type LinkCardSize, resolveLinkCardSize } from "@/features/links/lib/link-card-size";
import { useWideView } from "@/lib/hooks/use-wide-view";
import { useLinkCardSizeStore } from "@/stores/link-card-size";

/** The link card size in effect on this layout, and its setter. */
function useLinkCardSize(): {
  isWideView: boolean;
  linkCardSize: LinkCardSize;
  setLinkCardSize: (size: LinkCardSize) => void;
} {
  const isWideView = useWideView();
  const chosen = useLinkCardSizeStore((state) => state.linkCardSize);
  const setLinkCardSize = useLinkCardSizeStore((state) => state.setLinkCardSize);
  return { isWideView, linkCardSize: resolveLinkCardSize(chosen, isWideView), setLinkCardSize };
}

export { useLinkCardSize };
