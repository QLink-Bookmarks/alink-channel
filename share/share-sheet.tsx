import * as React from "react";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AiProviderWithModels } from "@/features/ai/types";
import type { Folder } from "@/features/folders/types";
import { getThumbnailCandidatesFromMeta } from "@/features/links/lib/link-preview/parse-link-preview-html";

import { ArchivedSuccess } from "./archived-success";
import { ShareAiStep } from "./share-ai-step";
import {
  createSharedLink,
  fetchFolders,
  fetchProviderModels,
  hasAuth,
  requestSharedAiSummary,
} from "./share-api";
import { ShareFailureToast } from "./share-failure-toast";
import { ShareFolderStep } from "./share-folder-step";
import { ShareLinkHeader } from "./share-link-header";
import {
  type FetchedPage,
  fetchPage,
  getPreprocessedMeta,
  getSharedDomain,
  getSharedTitle,
  getSharedUrl,
  isHttpUrl,
  isUrlLikeTitle,
  storeSharedThumbnail,
} from "./share-link-info";
import { ShareMainStep } from "./share-main-step";
import { ShareNotice } from "./share-notice";
import {
  SAVE_FAILURE_MESSAGE,
  type ShareFolderChoice,
  type ShareModelOption,
  type ShareStep,
  type ShareSubmitKind,
  UNCATEGORIZED_CHOICE,
  toModelOptions,
} from "./share-options";
import { ShareSheetFrame } from "./share-sheet-frame";
import { DEFAULT_SHEET_HEIGHT, getFolderStepHeight } from "./share-sheet-height";
import { ShareStepLayer, type ShareStepPosition } from "./share-step-layer";

import { close, openHostApp } from "expo-share-extension";
import { Link2Off, LogIn } from "lucide-react-native/icons";

type ShareSheetProps = {
  url?: string;
  text?: string;
  preprocessingResults?: unknown;
};

type Phase = "loading" | "unauthenticated" | "invalid" | "ready";

type MeasuredStep = "main" | "ai" | "notice";

type MeasuredHeights = Partial<Record<MeasuredStep, number>>;

function getStepPosition(step: ShareStep, current: ShareStep): ShareStepPosition {
  if (step === current) return 0;
  return step === "main" ? -1 : 1;
}

function ShareSheet({ url, text, preprocessingResults }: ShareSheetProps) {
  const sharedUrl = getSharedUrl(url, text, preprocessingResults);
  // Title from the in-page preprocessing if present; otherwise fetch the page
  // <title>. URL is only the last-resort fallback.
  const preprocessedTitle = getSharedTitle(preprocessingResults, "");
  // Main image candidates come from the preprocessing meta tags when there are
  // any; otherwise from the page HTML fetched below.
  const preprocessedMeta = getPreprocessedMeta(preprocessingResults);
  const hasPreprocessedMeta = preprocessedMeta !== null;
  const metaThumbnailCandidates = React.useMemo(
    () => getThumbnailCandidatesFromMeta(preprocessedMeta, sharedUrl),
    [preprocessedMeta, sharedUrl],
  );
  const [fetchedPage, setFetchedPage] = React.useState<FetchedPage | null>(null);
  const [isPageFetching, setIsPageFetching] = React.useState(false);
  const fetchedPageRef = React.useRef<Promise<FetchedPage | null> | null>(null);
  const title = preprocessedTitle || fetchedPage?.title || sharedUrl;
  const thumbnailUri = hasPreprocessedMeta
    ? (metaThumbnailCandidates[0] ?? null)
    : (fetchedPage?.thumbnailCandidates[0] ?? null);

  React.useEffect(() => {
    fetchedPageRef.current = null;
    if ((preprocessedTitle && hasPreprocessedMeta) || !isHttpUrl(sharedUrl)) {
      return;
    }
    let active = true;
    const pagePromise = fetchPage(sharedUrl);
    fetchedPageRef.current = pagePromise;
    setIsPageFetching(true);
    void pagePromise.then((page) => {
      if (!active) return;
      setFetchedPage(page);
      setIsPageFetching(false);
    });
    return () => {
      active = false;
    };
  }, [hasPreprocessedMeta, preprocessedTitle, sharedUrl]);

  const getThumbnailCandidates = React.useCallback(async () => {
    if (hasPreprocessedMeta) return metaThumbnailCandidates;
    const page = await fetchedPageRef.current;
    return page?.thumbnailCandidates ?? [];
  }, [hasPreprocessedMeta, metaThumbnailCandidates]);

  const [phase, setPhase] = React.useState<Phase>(() =>
    isHttpUrl(sharedUrl) ? "loading" : "invalid",
  );
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [models, setModels] = React.useState<ShareModelOption[]>([]);
  const [folder, setFolder] = React.useState<ShareFolderChoice>(UNCATEGORIZED_CHOICE);
  const [model, setModel] = React.useState<ShareModelOption | null>(null);
  const [generateTodo, setGenerateTodo] = React.useState(false);
  const [step, setStep] = React.useState<ShareStep>("main");
  const [submitting, setSubmitting] = React.useState<ShareSubmitKind | null>(null);
  const [hasSucceeded, setHasSucceeded] = React.useState(false);
  const [toastKey, setToastKey] = React.useState<number | null>(null);
  const submitLockRef = React.useRef(false);
  const [availableHeight, setAvailableHeight] = React.useState(DEFAULT_SHEET_HEIGHT);
  const [measuredHeights, setMeasuredHeights] = React.useState<MeasuredHeights>({});
  const isReducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!isHttpUrl(sharedUrl)) {
        if (active) setPhase("invalid");
        return;
      }
      if (!(await hasAuth())) {
        if (active) setPhase("unauthenticated");
        return;
      }
      const [folderList, providerModels] = await Promise.all([
        fetchFolders().catch(() => [] as Folder[]),
        fetchProviderModels().catch(() => [] as AiProviderWithModels[]),
      ]);
      if (!active) return;
      const modelOptions = toModelOptions(providerModels);
      setFolders(folderList);
      setModels(modelOptions);
      setModel(modelOptions[0] ?? null);
      setPhase("ready");
    })();
    return () => {
      active = false;
    };
  }, [sharedUrl]);

  const submit = React.useCallback(
    async (kind: ShareSubmitKind) => {
      if (submitLockRef.current || phase !== "ready") return;
      if (kind === "ai" && !model) return;
      submitLockRef.current = true;
      setToastKey(null);
      setSubmitting(kind);
      try {
        const thumbnailUrl = await storeSharedThumbnail(sharedUrl, await getThumbnailCandidates());
        if (kind === "save") {
          await createSharedLink({ url: sharedUrl, title, folderId: folder.id, thumbnailUrl });
        } else if (model) {
          await requestSharedAiSummary({
            url: sharedUrl,
            // Drop a URL-shaped title so the AI generates a real one; keep a genuine
            // web/OG title.
            title: isUrlLikeTitle(title, sharedUrl) ? "" : title,
            folderId: folder.id,
            userProviderId: model.userProviderId,
            modelId: model.modelId,
            generateTodo,
            thumbnailUrl,
          });
        }
        setSubmitting(null);
        setHasSucceeded(true);
      } catch {
        submitLockRef.current = false;
        setSubmitting(null);
        setToastKey((key) => (key ?? 0) + 1);
      }
    },
    [folder.id, generateTodo, getThumbnailCandidates, model, phase, sharedUrl, title],
  );

  const handleSave = React.useCallback(() => void submit("save"), [submit]);
  const handleAiSave = React.useCallback(() => void submit("ai"), [submit]);

  const isInputLocked = submitting !== null || hasSucceeded;

  const handleOpenFolder = React.useCallback(() => {
    if (!isInputLocked) setStep("folder");
  }, [isInputLocked]);

  const handleOpenAi = React.useCallback(() => {
    if (!isInputLocked) setStep("ai");
  }, [isInputLocked]);

  const handleBack = React.useCallback(() => setStep("main"), []);

  const handleFolderSelect = React.useCallback((choice: ShareFolderChoice) => {
    setFolder(choice);
    setStep("main");
  }, []);

  const handleToastHide = React.useCallback(() => setToastKey(null), []);

  const handleFinished = React.useCallback(() => close(), []);

  const handleDismiss = React.useCallback(() => close(), []);

  const setMeasuredHeight = React.useCallback((key: MeasuredStep, height: number) => {
    setMeasuredHeights((current) =>
      current[key] === height ? current : { ...current, [key]: height },
    );
  }, []);
  const handleMainHeight = React.useCallback(
    (height: number) => setMeasuredHeight("main", height),
    [setMeasuredHeight],
  );
  const handleAiHeight = React.useCallback(
    (height: number) => setMeasuredHeight("ai", height),
    [setMeasuredHeight],
  );
  const handleNoticeHeight = React.useCallback(
    (height: number) => setMeasuredHeight("notice", height),
    [setMeasuredHeight],
  );

  const handleGoToLogin = React.useCallback(() => {
    // Deep-link straight to /login. An empty path crashes the extension's URL
    // builder ("".split("?") is empty, so pathComponents[0] is out of range),
    // which is why "로그인 하러가기" opened nothing. /login is a real route now.
    openHostApp("login");
    close();
  }, []);

  const hasBottomInset = insets.bottom > 0;
  const paddingBottom = hasBottomInset ? insets.bottom + 8 : 16;
  const folderStepHeight = React.useMemo(() => {
    const mineCount = folders.filter((entry) => !entry.isShared).length;
    const sharedCount = folders.length - mineCount;
    return getFolderStepHeight({
      sectionRowCounts: [mineCount, sharedCount].filter((count) => count > 0),
      paddingBottom,
      maxHeight: availableHeight,
    });
  }, [availableHeight, folders, paddingBottom]);
  const stepHeight = step === "folder" ? folderStepHeight : measuredHeights[step];
  const header = (
    <ShareLinkHeader
      domain={getSharedDomain(sharedUrl)}
      isThumbnailPending={!hasPreprocessedMeta && isPageFetching}
      thumbnailUri={thumbnailUri}
      title={title}
    />
  );

  if (phase === "invalid" || phase === "unauthenticated") {
    const isAuthNotice = phase === "unauthenticated";
    return (
      <ShareSheetFrame
        contentHeight={measuredHeights.notice}
        hasRoundedCorners={hasBottomInset}
        isCompleting={false}
        isDismissEnabled
        isReducedMotion={isReducedMotion}
        isSwipeEnabled
        onAvailableHeightChange={setAvailableHeight}
        onDismiss={handleDismiss}
      >
        <ShareStepLayer
          isReducedMotion={isReducedMotion}
          maxHeight={availableHeight}
          paddingBottom={paddingBottom}
          position={0}
          onHeightChange={handleNoticeHeight}
        >
          <ShareNotice
            actionLabel={isAuthNotice ? "로그인 하러가기" : "닫기"}
            actionTone={isAuthNotice ? "solid" : "outline"}
            icon={isAuthNotice ? LogIn : Link2Off}
            message={
              isAuthNotice ? "로그인을 먼저 해주세요" : "북마크 가능한 웹페이지 url이 아니에요"
            }
            onAction={isAuthNotice ? handleGoToLogin : handleDismiss}
          />
        </ShareStepLayer>
      </ShareSheetFrame>
    );
  }

  return (
    <ShareSheetFrame
      contentHeight={stepHeight}
      hasRoundedCorners={hasBottomInset}
      isCompleting={hasSucceeded}
      isDismissEnabled={!isInputLocked}
      isReducedMotion={isReducedMotion}
      isSwipeEnabled={step === "main" && !isInputLocked}
      overlay={hasSucceeded ? <ArchivedSuccess onFinished={handleFinished} /> : null}
      onAvailableHeightChange={setAvailableHeight}
      onDismiss={handleDismiss}
    >
      <ShareStepLayer
        isReducedMotion={isReducedMotion}
        maxHeight={availableHeight}
        paddingBottom={paddingBottom}
        position={getStepPosition("main", step)}
        testID="share-step-main"
        onHeightChange={handleMainHeight}
      >
        <ShareMainStep
          folder={folder}
          generateTodo={generateTodo}
          header={header}
          isLoading={phase === "loading"}
          isLocked={hasSucceeded}
          model={model}
          models={models}
          submitting={submitting}
          onAiSave={handleAiSave}
          onOpenAi={handleOpenAi}
          onOpenFolder={handleOpenFolder}
          onSave={handleSave}
        />
      </ShareStepLayer>
      <ShareStepLayer
        height={folderStepHeight}
        isReducedMotion={isReducedMotion}
        maxHeight={availableHeight}
        paddingBottom={paddingBottom}
        position={getStepPosition("folder", step)}
        testID="share-step-folder"
      >
        <ShareFolderStep
          folders={folders}
          selectedFolderId={folder.id}
          onBack={handleBack}
          onSelect={handleFolderSelect}
        />
      </ShareStepLayer>
      {models.length > 0 ? (
        <ShareStepLayer
          isReducedMotion={isReducedMotion}
          maxHeight={availableHeight}
          paddingBottom={paddingBottom}
          position={getStepPosition("ai", step)}
          testID="share-step-ai"
          onHeightChange={handleAiHeight}
        >
          <ShareAiStep
            generateTodo={generateTodo}
            models={models}
            selectedKey={model?.key ?? null}
            onBack={handleBack}
            onGenerateTodoChange={setGenerateTodo}
            onSelectModel={setModel}
          />
        </ShareStepLayer>
      ) : null}
      {toastKey !== null ? (
        <ShareFailureToast
          key={toastKey}
          message={SAVE_FAILURE_MESSAGE}
          showKey={toastKey}
          onHide={handleToastHide}
        />
      ) : null}
    </ShareSheetFrame>
  );
}

export { ShareSheet };
