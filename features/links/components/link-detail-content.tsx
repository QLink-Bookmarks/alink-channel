import { View } from "react-native";

import { AppHeader } from "@/components/layout/app-header";
import { isPreviewableUrl } from "@/features/links/lib/link-preview/link-preview-result";

import { LinkDetailAiSurface } from "./link-detail-ai-surface";
import { LinkDetailBody } from "./link-detail-body";
import { LinkDetailHead } from "./link-detail-head";
import { LinkDetailNotesLayout } from "./link-detail-notes-layout";

function LinkDetailContent({
  head,
  toolbar,
  ai,
  notes,
  footer,
  onBack,
}: {
  head: React.ComponentProps<typeof LinkDetailHead>;
  toolbar?: React.ReactNode;
  ai?: Omit<React.ComponentProps<typeof LinkDetailAiSurface>, "url">;
  notes: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
}) {
  const isPanel = head.mode === "panel";
  return (
    <View className={isPanel ? "flex-1" : "flex-1 bg-background"}>
      {isPanel ? null : (
        <AppHeader
          back
          onBack={onBack}
          rightSlot={toolbar}
        />
      )}
      <LinkDetailBody mode={head.mode}>
        {isPanel ? toolbar : null}
        <LinkDetailHead {...head} />
        <LinkDetailAiSurface
          {...ai}
          url={head.url}
          canOpenOriginal={!head.readOnly || isPreviewableUrl(head.url)}
        />
        {head.readOnly ? notes : <LinkDetailNotesLayout>{notes}</LinkDetailNotesLayout>}
        {footer}
      </LinkDetailBody>
    </View>
  );
}

export { LinkDetailContent };
