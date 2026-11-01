// Reads link preview data out of a page's HTML with plain regular expressions, the
// same approach the share sheet already used for titles, so no HTML parser ships in
// the app or the share extension. The rules match the server preview API (#139):
// - title: og:title, then <title>; trimmed, at most 300 characters, empty → null
// - main image candidates: every og:image, then every twitter:image, resolved
//   against the page (or its <base href>), deduplicated, http(s) only
// - isVideo: og:type starts with "video", an og:video tag exists, or
//   twitter:card is "player"
// Favicon candidates are not read here; the server finds favicons itself.

type ParsedLinkPreviewHtml = {
  title: string | null;
  thumbnailCandidates: string[];
  isVideo: boolean;
};

const TITLE_MAX_LENGTH = 300;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
        return entity;
      }
      return String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Matches a whole start tag while allowing ">" inside quoted attribute values.
function matchTags(html: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, "gi");
  return html.match(pattern) ?? [];
}

function readAttribute(tag: string, name: string): string | null {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const match = pattern.exec(tag);
  if (!match) {
    return null;
  }
  return decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "");
}

// Meta values by lower-cased `property` (or `name`), in document order.
function collectMetaValues(html: string): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const tag of matchTags(html, "meta")) {
    const key = (readAttribute(tag, "property") || readAttribute(tag, "name"))
      ?.trim()
      .toLowerCase();
    const content = readAttribute(tag, "content")?.trim();
    if (!key || !content) {
      continue;
    }
    const list = values.get(key);
    if (list) {
      list.push(content);
    } else {
      values.set(key, [content]);
    }
  }
  return values;
}

function removeDotSegments(path: string): string {
  const output: string[] = [];
  const segments = path.split("/");
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    if (segment === ".") {
      if (isLast) output.push("");
    } else if (segment === "..") {
      if (output.length > 1) output.pop();
      if (isLast) output.push("");
    } else {
      output.push(segment);
    }
  });
  return output.join("/");
}

// Resolves `value` against an absolute http(s) `baseUrl` (RFC 3986 reference
// resolution, simplified). The global `URL` is not used on purpose: outside Expo's
// runtime (the iOS share extension bundle) React Native's own `URL` neither resolves
// relative paths nor keeps absolute ones intact.
function resolveHttpUrl(value: string, baseUrl: string): string | null {
  const ref = value.trim();
  const base = /^(https?:)\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i.exec(baseUrl.trim());
  let resolved: string;

  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
    resolved = ref;
  } else if (!base) {
    return null;
  } else {
    const [, scheme, authority, basePath = "", baseQuery = ""] = base;
    const origin = `${scheme}//${authority}`;
    if (ref.startsWith("//")) {
      resolved = `${scheme}${ref}`;
    } else if (ref.startsWith("/")) {
      resolved = `${origin}${ref}`;
    } else if (ref === "" || ref.startsWith("#")) {
      resolved = `${origin}${basePath}${baseQuery}${ref}`;
    } else if (ref.startsWith("?")) {
      resolved = `${origin}${basePath || "/"}${ref}`;
    } else {
      const directory = basePath.slice(0, basePath.lastIndexOf("/") + 1) || "/";
      resolved = `${origin}${directory}${ref}`;
    }
  }

  const parts = /^(https?:\/\/[^/?#]+)([^?#]*)(.*)$/i.exec(resolved);
  if (!parts || /\s/.test(parts[1])) {
    return null;
  }
  return `${parts[1]}${removeDotSegments(parts[2] || "/")}${parts[3]}`;
}

function resolveCandidates(values: string[], baseUrl: string): string[] {
  const resolved: string[] = [];
  for (const value of values) {
    const url = resolveHttpUrl(value, baseUrl);
    if (url && !resolved.includes(url)) {
      resolved.push(url);
    }
  }
  return resolved;
}

function readDocumentTitle(html: string): string {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? collapseWhitespace(decodeHtmlEntities(match[1])) : "";
}

function readBaseUrl(html: string, pageUrl: string): string {
  const baseTag = matchTags(html, "base").find((tag) => readAttribute(tag, "href"));
  const href = baseTag ? readAttribute(baseTag, "href") : null;
  return (href && resolveHttpUrl(href, pageUrl)) || pageUrl;
}

function parseLinkPreviewHtml(html: string, pageUrl: string): ParsedLinkPreviewHtml {
  const meta = collectMetaValues(html);
  const first = (key: string) => meta.get(key)?.[0] ?? "";

  const title = (collapseWhitespace(first("og:title")) || readDocumentTitle(html)).slice(
    0,
    TITLE_MAX_LENGTH,
  );

  const baseUrl = readBaseUrl(html, pageUrl);
  const thumbnailCandidates = resolveCandidates(
    [...(meta.get("og:image") ?? []), ...(meta.get("twitter:image") ?? [])],
    baseUrl,
  );

  const isVideo =
    first("og:type").toLowerCase().startsWith("video") ||
    meta.has("og:video") ||
    (meta.get("twitter:card") ?? []).some((card) => card.toLowerCase() === "player");

  return { title: title || null, thumbnailCandidates, isVideo };
}

// The iOS share extension's preprocessing hands over the page's meta tags as a
// `{ [property or name]: content }` record. Reads main image candidates from it in
// the same og:image → twitter:image order.
function getThumbnailCandidatesFromMeta(meta: unknown, pageUrl: string): string[] {
  if (!meta || typeof meta !== "object") {
    return [];
  }
  const record = meta as Record<string, unknown>;
  const values = ["og:image", "twitter:image"].flatMap((key) => {
    const value = record[key];
    return typeof value === "string" && value.trim() ? [value] : [];
  });
  return resolveCandidates(values, pageUrl);
}

export { decodeHtmlEntities, getThumbnailCandidatesFromMeta, parseLinkPreviewHtml, resolveHttpUrl };
export type { ParsedLinkPreviewHtml };
