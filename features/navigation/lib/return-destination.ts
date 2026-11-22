import { SessionStorage } from "@/lib/session-storage";

import { isKnownShellPath, normalizePathname } from "../routes";

const RETURN_DESTINATION_KEY = "qlink-return-destination";
const LINK_OVERLAY_PATHS = ["/home", "/folders", "/links", "/todos"];
let nativeDestination: string | null = null;

function validateReturnDestination(value: string | null) {
  if (!value) return null;
  const [rawPath, query = ""] = value.split(/\?(.*)/s);
  const pathname = normalizePathname(rawPath);
  if (!pathname.startsWith("/") || /[^a-z0-9/-]/.test(pathname) || pathname.includes("//"))
    return null;
  if (pathname !== "/qr-scan" && (!isKnownShellPath(pathname) || pathname === "/invite")) {
    return null;
  }
  const id = pathname.match(
    /^\/(?:folders|links|announcements|feedbacks|settings\/imports)\/([^/]+)$/,
  )?.[1];
  if (id && (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)))) return null;

  const params = new URLSearchParams(query);
  const allowed = new URLSearchParams();
  if (LINK_OVERLAY_PATHS.includes(pathname) || pathname.startsWith("/folders/")) {
    const linkId = params.get("linkId");
    if (linkId && /^\d+$/.test(linkId) && Number.isSafeInteger(Number(linkId))) {
      allowed.set("linkId", linkId);
    }
  }
  if (pathname === "/home") {
    const linkUrl = params.get("linkUrl");
    if (linkUrl && /^https?:\/\/\S+$/i.test(linkUrl)) allowed.set("linkUrl", linkUrl);
  }
  const search = allowed.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function rememberReturnDestination(value: string) {
  const destination = validateReturnDestination(value);
  if (!destination || destination === "/home") return;
  if (process.env.EXPO_OS === "web") {
    void SessionStorage.setItem(RETURN_DESTINATION_KEY, destination);
  } else {
    nativeDestination = destination;
  }
}

function consumeReturnDestination() {
  if (process.env.EXPO_OS === "web") {
    const destination = SessionStorage.getItem(RETURN_DESTINATION_KEY);
    void SessionStorage.removeItem(RETURN_DESTINATION_KEY);
    return typeof destination === "string" ? validateReturnDestination(destination) : null;
  }
  const destination = nativeDestination;
  nativeDestination = null;
  return destination;
}

export { consumeReturnDestination, rememberReturnDestination, validateReturnDestination };
