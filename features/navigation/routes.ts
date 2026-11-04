import type { MobileTabKey, RouteParamValue, RouteParams, WideSidebarKey } from "./types";

type ShellRouteStateInput = {
  isWideView: boolean;
  pathname: string;
  searchParams: RouteParams;
};

const folderLabels: Record<string, string> = {
  inbox: "Inbox",
  design: "Design",
  product: "Product",
};

const MOBILE_TAB_ROOT_PATHS = ["/home", "/folders", "/todos", "/settings"];

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") {
    return pathname;
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function readParamValue(value: RouteParamValue) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isFolderDetailPath(pathname: string) {
  return /^\/folders\/[^/]+$/.test(pathname);
}

function isMobileTabRootPath(pathname: string) {
  return MOBILE_TAB_ROOT_PATHS.includes(normalizePathname(pathname));
}

function isLinkDetailPath(pathname: string) {
  return /^\/links\/[^/]+$/.test(pathname);
}

function isAnnouncementDetailPath(pathname: string) {
  return /^\/announcements\/[^/]+$/.test(pathname);
}

function isFeedbackDetailPath(pathname: string) {
  return /^\/feedbacks\/[^/]+$/.test(pathname);
}

function isImportsPath(pathname: string) {
  return pathname === "/settings/imports";
}

function isImportDetailPath(pathname: string) {
  return /^\/settings\/imports\/[^/]+$/.test(pathname);
}

function isKnownShellPath(pathname: string) {
  return (
    pathname === "/home" ||
    pathname === "/folders" ||
    isFolderDetailPath(pathname) ||
    pathname === "/todos" ||
    pathname === "/notifications" ||
    pathname === "/links" ||
    isLinkDetailPath(pathname) ||
    pathname === "/announcements" ||
    isAnnouncementDetailPath(pathname) ||
    pathname === "/feedbacks" ||
    isFeedbackDetailPath(pathname) ||
    pathname === "/settings" ||
    isImportsPath(pathname) ||
    isImportDetailPath(pathname) ||
    pathname === "/invite" ||
    pathname === "/share"
  );
}

function canOpenWideOverlayInPlace(pathname: string) {
  return (
    pathname === "/home" ||
    pathname === "/folders" ||
    isFolderDetailPath(pathname) ||
    pathname === "/todos" ||
    pathname === "/links"
  );
}

function getWideSidebarActiveItem(pathname: string): WideSidebarKey | null {
  if (pathname === "/home") {
    return "home";
  }

  if (pathname === "/folders" || isFolderDetailPath(pathname)) {
    return "folders";
  }

  if (pathname === "/todos") {
    return "todos";
  }

  if (pathname === "/links" || isLinkDetailPath(pathname)) {
    return "links";
  }

  return null;
}

function getMobileTabActiveItem(pathname: string): MobileTabKey | null {
  if (pathname === "/home") {
    return "home";
  }

  if (pathname === "/folders" || isFolderDetailPath(pathname)) {
    return "folders";
  }

  if (pathname === "/todos") {
    return "todos";
  }

  if (pathname === "/settings" || isImportsPath(pathname) || isImportDetailPath(pathname)) {
    return "settings";
  }

  return null;
}

function getFolderLabel(folderId?: string) {
  if (!folderId) {
    return "폴더";
  }

  if (folderId === "0") {
    return "미분류";
  }

  return folderLabels[folderId] ?? `Folder ${folderId}`;
}

function getRouteTitle(pathname: string, params: RouteParams, isWideView: boolean) {
  const normalizedPathname = normalizePathname(pathname);
  const folderId = readParamValue(params.id);

  switch (normalizedPathname) {
    case "/home":
      return "홈";
    case "/folders":
      return isWideView ? "홈" : "폴더";
    case "/todos":
      return "투두";
    case "/notifications":
      return "알림";
    case "/links":
      return "링크";
    case "/announcements":
      return "공지사항";
    case "/feedbacks":
      return "피드백";
    case "/settings":
      return "설정";
    case "/settings/imports":
      return "북마크 가져오기";
    case "/invite":
      return "초대 확인";
    case "/share":
      return "공유 처리";
    default:
      if (isFolderDetailPath(normalizedPathname)) {
        return getFolderLabel(folderId);
      }

      if (isLinkDetailPath(normalizedPathname)) {
        return isWideView ? "링크" : "링크 상세";
      }

      if (isAnnouncementDetailPath(normalizedPathname)) {
        return "공지사항";
      }

      if (isFeedbackDetailPath(normalizedPathname)) {
        return "피드백";
      }

      if (isImportDetailPath(normalizedPathname)) {
        return "가져오기 기록";
      }

      return "페이지를 찾을 수 없음";
  }
}

function getBackHref(pathname: string) {
  if (isFolderDetailPath(pathname)) {
    return "/folders";
  }

  if (isLinkDetailPath(pathname)) {
    return "/links";
  }

  if (isAnnouncementDetailPath(pathname)) {
    return "/announcements";
  }

  if (isFeedbackDetailPath(pathname)) {
    return "/feedbacks";
  }

  if (isImportDetailPath(pathname)) {
    return "/settings/imports";
  }

  if (isImportsPath(pathname)) {
    return "/settings";
  }

  if (pathname === "/notifications") {
    return "/home";
  }

  return "/home";
}

function getOverlayLinkId(pathname: string, searchParams: RouteParams, isWideView: boolean) {
  if (!isWideView) {
    return undefined;
  }

  const queryLinkId = readParamValue(searchParams.linkId);

  if (queryLinkId && canOpenWideOverlayInPlace(pathname)) {
    return queryLinkId;
  }

  if (isLinkDetailPath(pathname)) {
    return pathname.split("/")[2];
  }

  return undefined;
}

function getOverlayBaseHref(pathname: string) {
  if (isLinkDetailPath(pathname)) {
    return "/links";
  }

  return pathname;
}

function getRedirectHref({ isWideView, pathname, searchParams }: ShellRouteStateInput) {
  const normalizedPathname = normalizePathname(pathname);
  const linkId = readParamValue(searchParams.linkId);

  if (normalizedPathname === "/share") {
    return "/home";
  }

  if (isWideView && normalizedPathname === "/folders") {
    return linkId ? `/links?linkId=${encodeURIComponent(linkId)}` : "/home";
  }

  if (!isWideView && linkId) {
    const targetHref = `/links/${encodeURIComponent(linkId)}`;

    return normalizedPathname === targetHref ? undefined : targetHref;
  }

  if (!isWideView && normalizedPathname === "/links") {
    return "/home";
  }

  if (isWideView && linkId && !canOpenWideOverlayInPlace(normalizedPathname)) {
    const targetHref = `/links?linkId=${encodeURIComponent(linkId)}`;

    return normalizedPathname === "/links" ? undefined : targetHref;
  }

  return undefined;
}

export {
  canOpenWideOverlayInPlace,
  getBackHref,
  getMobileTabActiveItem,
  getOverlayBaseHref,
  getOverlayLinkId,
  getRedirectHref,
  getRouteTitle,
  getWideSidebarActiveItem,
  isKnownShellPath,
  isMobileTabRootPath,
  normalizePathname,
  readParamValue,
};
