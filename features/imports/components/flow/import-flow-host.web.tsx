import * as React from "react";

import { useWideView } from "@/lib/hooks/use-wide-view";
import { closeImportFlow, useImportFlowStore } from "@/stores/import-flow";

import { useImportFlow } from "../../hooks/use-import-flow";
import { IMPORTS_PATH } from "../../lib/import-paths";
import { ProposalModal } from "../proposal/proposal-modal";
import { useWindowFileDropGuard } from "../upload/file-drop-zone.web";
import { UploadDialog } from "../upload/upload-dialog";

import { type Href, usePathname, useRouter } from "expo-router";

function ImportFlowHost() {
  const router = useRouter();
  const pathname = usePathname();
  const isWide = useWideView();
  const request = useImportFlowStore((state) => state.request);
  const flow = useImportFlow();
  const { open: openFlow, close: closeFlow } = flow;
  const [anchorPath, setAnchorPath] = React.useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = React.useState<number | null>(null);
  const handledRequestRef = React.useRef<number | null>(null);

  React.useEffect(() => () => closeImportFlow(), []);

  React.useEffect(() => {
    if (!request || handledRequestRef.current === request.id) {
      return;
    }
    handledRequestRef.current = request.id;
    if (request.from === "home" && pathname !== IMPORTS_PATH) {
      setPendingRequestId(request.id);
      router.navigate(IMPORTS_PATH as Href);
      return;
    }
    setAnchorPath(pathname);
    openFlow();
  }, [openFlow, pathname, request, router]);

  React.useEffect(() => {
    if (pendingRequestId == null || pathname !== IMPORTS_PATH) {
      return;
    }
    setPendingRequestId(null);
    setAnchorPath(IMPORTS_PATH);
    openFlow();
  }, [openFlow, pathname, pendingRequestId]);

  const handleClose = React.useCallback(() => {
    closeFlow();
    setAnchorPath(null);
    closeImportFlow();
  }, [closeFlow]);

  React.useEffect(() => {
    if (anchorPath != null && pathname !== anchorPath) {
      handleClose();
    }
  }, [anchorPath, handleClose, pathname]);

  const handleStarted = React.useCallback(() => {
    handleClose();
    if (pathname !== IMPORTS_PATH) {
      router.navigate(IMPORTS_PATH as Href);
    }
  }, [handleClose, pathname, router]);

  const { step } = flow;
  const isUploadOpen = step.name !== "closed" && step.name !== "proposal";
  useWindowFileDropGuard(step.name !== "closed");

  return (
    <>
      <UploadDialog
        isWide={isWide}
        open={isUploadOpen}
        step={step}
        onChooseOtherFile={flow.chooseOtherFile}
        onClose={handleClose}
        onPreviewRange={flow.previewRange}
        onRetryPreview={flow.retryPreview}
        onSelectFile={flow.selectFile}
      />
      {step.name === "proposal" ? (
        <ProposalModal
          fileName={step.fileName}
          input={step.input}
          isWide={isWide}
          onClose={handleClose}
          onStarted={handleStarted}
        />
      ) : null}
    </>
  );
}

export { ImportFlowHost };
