import type { BookmarkNode, BookmarkTree } from "./build-import-candidates";

type ReadBookmarkTreeResult = { kind: "ok"; tree: BookmarkTree } | { kind: "not-bookmark" };

const BOOKMARK_DOCTYPE = /<!DOCTYPE\s+NETSCAPE-Bookmark-file-1>/i;

function childElements(element: Element) {
  return Array.from(element.children);
}

function findOwnList(entry: Element): Element | null {
  const inner = childElements(entry).find((child) => child.tagName === "DL");
  if (inner) {
    return inner;
  }
  const next = entry.nextElementSibling;
  return next?.tagName === "DL" ? next : null;
}

function collectEntries(list: Element): Element[] {
  const entries: Element[] = [];
  for (const child of childElements(list)) {
    if (child.tagName === "DT") {
      entries.push(child);
    } else if (child.tagName !== "DL") {
      entries.push(...collectEntries(child));
    }
  }
  return entries;
}

function readList(list: Element): BookmarkNode[] {
  const nodes: BookmarkNode[] = [];
  for (const entry of collectEntries(list)) {
    const head = childElements(entry).find(
      (child) => child.tagName === "A" || child.tagName === "H3",
    );
    if (!head) {
      continue;
    }
    if (head.tagName === "A") {
      nodes.push({
        type: "link",
        title: head.textContent ?? "",
        url: head.getAttribute("href") ?? "",
        addDate: head.getAttribute("add_date"),
      });
      continue;
    }
    const ownList = findOwnList(entry);
    nodes.push({
      type: "folder",
      name: head.textContent ?? "",
      addDate: head.getAttribute("add_date"),
      isToolbar: head.getAttribute("personal_toolbar_folder")?.toLowerCase() === "true",
      children: ownList ? readList(ownList) : [],
    });
  }
  return nodes;
}

function parseBookmarkHtml(html: string): ReadBookmarkTreeResult {
  const document = new DOMParser().parseFromString(html, "text/html");
  const rootList = document.body?.querySelector("dl");
  const hasEntries = Boolean(rootList?.querySelector("dt > a, dt > h3"));
  if (!rootList || (!BOOKMARK_DOCTYPE.test(html) && !hasEntries)) {
    return { kind: "not-bookmark" };
  }
  return { kind: "ok", tree: { children: readList(rootList) } };
}

async function readBookmarkTree(file: Blob): Promise<ReadBookmarkTreeResult> {
  return parseBookmarkHtml(await file.text());
}

export { parseBookmarkHtml, readBookmarkTree };
export type { ReadBookmarkTreeResult };
