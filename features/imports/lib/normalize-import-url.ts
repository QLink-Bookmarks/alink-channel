const TRACKING_QUERY_KEYS = new Set(["fbclid", "gclid", "igshid", "mc_cid", "mc_eid"]);
const TRACKING_QUERY_KEY_PREFIXES = ["utm_"];
const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443 };

const UNRESERVED = "A-Za-z0-9\\-_.!~*'()";
const PATH_CHARS = new RegExp(`^[${UNRESERVED}:@&=+$,;/]$`);
const URIC_CHARS = new RegExp(`^[${UNRESERVED};/?:@&=+$,\\[\\]]$`);
const USERINFO_CHARS = new RegExp(`^[${UNRESERVED};:&=+$,]$`);
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const HEX_PAIR = /^[0-9A-Fa-f]{2}$/;
const SPACE_CHAR = /^[\p{Zs}\p{Zl}\p{Zp}]$/u;
const TRIM_CHAR = /^[\t\n\u000B\f\r\u001C-\u001F\p{Zs}\p{Zl}\p{Zp}]$/u;
const HOST_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const IPV4 = /^\d+\.\d+\.\d+\.\d+$/;
const IPV6 = /^\[[0-9A-Fa-f:.]+\]$/;

function isOtherChar(char: string) {
  const code = char.charCodeAt(0);
  if (code <= 128 || (code >= 0x7f && code <= 0x9f)) {
    return false;
  }
  return !SPACE_CHAR.test(char);
}

function hasOnlyChars(text: string, allowed: RegExp) {
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (allowed.test(char) || isOtherChar(char)) {
      index += 1;
      continue;
    }
    if (char === "%" && HEX_PAIR.test(text.slice(index + 1, index + 3))) {
      index += 3;
      continue;
    }
    return false;
  }
  return true;
}

function trimLikeKotlin(text: string) {
  let start = 0;
  let end = text.length;
  while (start < end && TRIM_CHAR.test(text[start])) {
    start += 1;
  }
  while (end > start && TRIM_CHAR.test(text[end - 1])) {
    end -= 1;
  }
  return text.slice(start, end);
}

function isHostname(host: string) {
  if (IPV6.test(host)) {
    return true;
  }
  if (IPV4.test(host) && host.split(".").every((octet) => Number(octet) <= 255)) {
    return true;
  }
  const labels = (host.endsWith(".") ? host.slice(0, -1) : host).split(".");
  if (!labels.every((label) => HOST_LABEL.test(label))) {
    return false;
  }
  return labels.length === 1 || /^[A-Za-z]/.test(labels[labels.length - 1]);
}

type Authority = { userInfo: string | null; host: string; port: number };

function parseAuthority(authority: string): Authority | null {
  const at = authority.indexOf("@");
  const userInfo = at >= 0 ? authority.slice(0, at) : null;
  if (userInfo != null && !hasOnlyChars(userInfo, USERINFO_CHARS)) {
    return null;
  }
  const server = at >= 0 ? authority.slice(at + 1) : authority;
  const hostEnd = server.startsWith("[") ? server.indexOf("]") + 1 : server.indexOf(":");
  const host = hostEnd > 0 ? server.slice(0, hostEnd) : server;
  const rest = hostEnd > 0 ? server.slice(hostEnd) : "";
  if (!host || !isHostname(host)) {
    return null;
  }
  if (rest === "" || rest === ":") {
    return { userInfo, host, port: -1 };
  }
  if (!/^:\d+$/.test(rest)) {
    return null;
  }
  const port = Number.parseInt(rest.slice(1), 10);
  return port > 2147483647 ? null : { userInfo, host, port };
}

function hasTrackingKey(part: string) {
  const key = part.split("=")[0].toLowerCase();
  return TRACKING_QUERY_KEYS.has(key) || TRACKING_QUERY_KEY_PREFIXES.some((p) => key.startsWith(p));
}

function compareKeys(a: string, b: string) {
  const keyA = a.split("=")[0];
  const keyB = b.split("=")[0];
  if (keyA < keyB) {
    return -1;
  }
  return keyA > keyB ? 1 : 0;
}

function normalizeImportUrl(raw: string): string | null {
  const input = trimLikeKotlin(raw);
  const hashIndex = input.indexOf("#");
  const beforeFragment = hashIndex >= 0 ? input.slice(0, hashIndex) : input;
  if (hashIndex >= 0 && !hasOnlyChars(input.slice(hashIndex + 1), URIC_CHARS)) {
    return null;
  }
  const colon = beforeFragment.search(/[:/?]/);
  if (colon <= 0 || beforeFragment[colon] !== ":") {
    return null;
  }
  const scheme = beforeFragment.slice(0, colon);
  if (!SCHEME.test(scheme)) {
    return null;
  }
  const hierarchical = beforeFragment.slice(colon + 1);
  if (!hierarchical.startsWith("//")) {
    return null;
  }
  const afterSlashes = hierarchical.slice(2);
  const authorityEnd = afterSlashes.search(/[/?]/);
  const authority = authorityEnd >= 0 ? afterSlashes.slice(0, authorityEnd) : afterSlashes;
  const pathAndQuery = authorityEnd >= 0 ? afterSlashes.slice(authorityEnd) : "";
  const queryIndex = pathAndQuery.indexOf("?");
  const rawPath = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
  const rawQuery = queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : null;
  if (!hasOnlyChars(rawPath, PATH_CHARS)) {
    return null;
  }
  if (rawQuery != null && !hasOnlyChars(rawQuery, URIC_CHARS)) {
    return null;
  }
  const parsed = authority ? parseAuthority(authority) : null;
  if (!parsed) {
    return null;
  }

  const lowerScheme = scheme.toLowerCase();
  const userInfo = parsed.userInfo != null ? `${parsed.userInfo}@` : "";
  const port =
    parsed.port === -1 || parsed.port === DEFAULT_PORTS[lowerScheme] ? "" : `:${parsed.port}`;
  const path = rawPath.replace(/\/+$/, "");
  const parts = (rawQuery ?? "")
    .split("&")
    .filter((part) => part.length > 0 && !hasTrackingKey(part))
    .sort(compareKeys);
  const query = parts.length > 0 ? `?${parts.join("&")}` : "";
  return `${lowerScheme}://${userInfo}${parsed.host.toLowerCase()}${port}${path}${query}`;
}

function isHttpUrl(raw: string) {
  return /^https?:\/\//i.test(raw.trim());
}

export { isHttpUrl, normalizeImportUrl };
