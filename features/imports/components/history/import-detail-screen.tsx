import * as React from "react";
import { View } from "react-native";

import { IMPORTS_PATH } from "../../lib/import-paths";
import { ReversalModal, type ReversalTarget } from "../reversal/reversal-modal";
import { clearDetailOpenedFromList, wasDetailOpenedFromList } from "./detail-navigation";
import { ImportDetailView } from "./import-detail-view";

import { type Href, useRouter } from "expo-router";

function ImportDetailScreen({ importId }: { importId: number }) {
  const router = useRouter();
  const [reversalTarget, setReversalTarget] = React.useState<ReversalTarget | null>(null);

  const handleBack = React.useCallback(() => {
    const canReturnToList = wasDetailOpenedFromList(importId) && router.canGoBack();
    clearDetailOpenedFromList();
    if (canReturnToList) {
      router.back();
      return;
    }
    router.replace(IMPORTS_PATH as Href);
  }, [importId, router]);

  return (
    <View className="flex-1 bg-background">
      <ImportDetailView
        importId={importId}
        mode="page"
        onBack={handleBack}
        onReverse={setReversalTarget}
      />
      <ReversalModal
        target={reversalTarget}
        onClose={() => setReversalTarget(null)}
      />
    </View>
  );
}

export { ImportDetailScreen };
