import type {
  CreateImportPreviewRequest,
  ImportDetail,
  ImportErrorName,
  ImportFailure,
  ImportFolderKind,
  ImportPreview,
  ImportPreviewFolder,
  ImportReversalPreview,
  ImportScrollResponse,
  ImportStatus,
  ImportSummary,
  ReversalFolderState,
  ReversalLinkState,
  ReverseImportRequest,
  StartImportRequest,
} from "@/features/imports/types";
import type { Route } from "@playwright/test";

import type { MockFolder } from "./mock-api";

type Handler = (route: Route, request: ReturnType<Route["request"]>) => Promise<unknown> | unknown;

type ImportEndpoint = "preview" | "start" | "list" | "detail" | "reversalPreview" | "reverse";

type MockErrorName = ImportErrorName | "COMMON_INTERNAL_SERVER_ERROR";

type ImportMockFailure =
  | "abort"
  | "save-then-abort"
  | { status: number; errorName?: MockErrorName };

type ImportEndpointControl = {
  fail: ImportMockFailure | null;
  failTimes: number | null;
  delayMs: number;
};

type MockImportLink = {
  linkId: number;
  title: string;
  url: string;
  state: ReversalLinkState;
  movedToUnfiled?: boolean;
};

type MockImportFolder = {
  kind: ImportFolderKind;
  state: ReversalFolderState;
  folderId: number | null;
  name: string | null;
  emoji: string | null;
  links: MockImportLink[];
};

type MockImportRecord = {
  id: number;
  fileName: string;
  baseStatus: Extract<ImportStatus, "COMPLETED" | "PARTIALLY_FAILED" | "FAILED">;
  linkCount: number;
  folderCount: number;
  skippedCount: number;
  failedCount: number;
  progress: number;
  wasReversed: boolean;
  createdAt: string;
  clientRequestId: string | null;
  folders: MockImportFolder[];
  failures: ImportFailure[];
};

type Source<T> = T | (() => T);

type MockImportApiOptions = {
  folders?: Source<MockFolder[]>;
  links?: Source<{ url: string }[]>;
  meId?: number;
  records?: MockImportRecord[];
  progressStep?: number;
  endpoints?: Partial<Record<ImportEndpoint, Partial<ImportEndpointControl>>>;
  handlers?: Record<string, Handler>;
};

const IMPORT_ERRORS: Record<MockErrorName, { code: string; status: number; message: string }> = {
  IMPORT_LINKS_EMPTY: { code: "IMPORT_400_0001", status: 400, message: "가져올 링크가 없어요" },
  IMPORT_LINKS_OVER_MAX: {
    code: "IMPORT_400_0002",
    status: 400,
    message: "한 번에 가져올 수 있는 링크는 최대 3,000개에요",
  },
  IMPORT_FOLDERS_OVER_MAX: {
    code: "IMPORT_400_0003",
    status: 400,
    message: "한 번에 가져올 수 있는 폴더는 최대 3,000개에요",
  },
  IMPORT_KEY_DUPLICATED: {
    code: "IMPORT_400_0004",
    status: 400,
    message: "가져오기 항목의 키가 중복되었어요",
  },
  IMPORT_FOLDER_KEY_NOT_FOUND: {
    code: "IMPORT_400_0005",
    status: 400,
    message: "링크가 가리키는 폴더 항목이 없어요",
  },
  IMPORT_FOLDER_NAME_BLANK: {
    code: "IMPORT_400_0006",
    status: 400,
    message: "폴더 이름이 입력되지 않았어요",
  },
  IMPORT_FOLDER_NAME_OVER_MAX: {
    code: "IMPORT_400_0007",
    status: 400,
    message: "폴더 이름은 최대 100자에요",
  },
  IMPORT_FILE_NAME_BLANK: {
    code: "IMPORT_400_0008",
    status: 400,
    message: "파일 이름이 입력되지 않았어요",
  },
  IMPORT_FILE_NAME_OVER_MAX: {
    code: "IMPORT_400_0009",
    status: 400,
    message: "파일 이름은 최대 255자에요",
  },
  IMPORT_REVERSAL_ITEMS_EMPTY: {
    code: "IMPORT_400_0010",
    status: 400,
    message: "되돌릴 항목이 선택되지 않았어요",
  },
  IMPORT_REVERSAL_ITEM_INVALID: {
    code: "IMPORT_400_0011",
    status: 400,
    message: "이 가져오기로 추가된 항목이 아니에요",
  },
  IMPORT_OWNER_NOT_FOUND: {
    code: "IMPORT_404_0001",
    status: 404,
    message: "로그인 사용자를 찾을 수 없어요",
  },
  IMPORT_NOT_FOUND: {
    code: "IMPORT_404_0002",
    status: 404,
    message: "가져오기 기록을 찾을 수 없어요",
  },
  IMPORT_PREVIEW_OWNER_NOT_FOUND: {
    code: "IMPORT_404_0003",
    status: 404,
    message: "로그인 사용자를 찾을 수 없어요",
  },
  IMPORT_NOTHING_TO_IMPORT: {
    code: "IMPORT_422_0003",
    status: 422,
    message: "새로 가져올 링크가 없어요",
  },
  IMPORT_REVERSAL_FOLDER_SHARED: {
    code: "IMPORT_422_0002",
    status: 422,
    message: "공유 중인 폴더는 되돌릴 수 없어요",
  },
  COMMON_BAD_REQUEST: { code: "COM_400_0001", status: 400, message: "유효하지 않은 요청이에요" },
  COMMON_CURSOR_MALFORMED: {
    code: "COM_400_0004",
    status: 400,
    message: "스크롤 커서를 해석할 수 없어요",
  },
  COMMON_CURSOR_FIELD_MISSING: {
    code: "COM_400_0006",
    status: 400,
    message: "커서에 필요한 값이 없어요",
  },
  COMMON_INTERNAL_SERVER_ERROR: {
    code: "COM_500_0001",
    status: 500,
    message: "예기치 못한 서버 에러가 발생했어요",
  },
};

const IMPORT_LINKS_MAX = 3000;
const IMPORT_FOLDERS_MAX = 3000;
const IMPORT_FOLDER_NAME_MAX = 100;
const IMPORT_FILE_NAME_MAX = 255;
const IMPORT_LINK_URL_MAX = 2048;
const IMPORT_PAGE_SIZE = 15;
const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|igshid|mc_cid|mc_eid)$/;
const REMOVABLE_LINK_STATES: ReversalLinkState[] = ["IMPORTED", "EDITED"];
const LEFT_IN_IMPORT_FOLDER_LINK_STATES: ReversalLinkState[] = ["REVERSED", "DELETED"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMPORT_CREATED_LINK_STATES: ReversalLinkState[] = [
  "IMPORTED",
  "EDITED",
  "DELETED",
  "REVERSED",
];

// Shared by every mock instance in a worker, so link and folder ids never collide across tests.
let nextMockId = 1;

function takeMockId(base: number) {
  const id = base + nextMockId;
  nextMockId += 1;
  return id;
}

function resolve<T>(source: Source<T> | undefined, fallback: T): T {
  if (source === undefined) return fallback;
  return typeof source === "function" ? (source as () => T)() : source;
}

function normalizeName(name: string) {
  return name.trim().normalize("NFC");
}

function normalizeImportUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    const entries = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAM.test(key))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const query = new URLSearchParams(entries).toString();
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "";
    return `${url.protocol}//${url.host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

function isHttpUrl(raw: string) {
  try {
    const { protocol } = new URL(raw);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function makeImportRecord(
  overrides: Partial<MockImportRecord> & Pick<MockImportRecord, "id">,
): MockImportRecord {
  const folders = overrides.folders ?? [
    {
      kind: "NEW",
      state: "ACTIVE",
      folderId: 7000 + overrides.id,
      name: `가져온 폴더 ${overrides.id}`,
      emoji: null,
      links: [
        {
          linkId: overrides.id * 100 + 1,
          title: "예시 링크 1",
          url: `https://example.com/${overrides.id}/1`,
          state: "IMPORTED",
        },
        {
          linkId: overrides.id * 100 + 2,
          title: "예시 링크 2",
          url: `https://example.com/${overrides.id}/2`,
          state: "IMPORTED",
        },
      ],
    },
    {
      kind: "UNFILED",
      state: "ACTIVE",
      folderId: null,
      name: null,
      emoji: null,
      links: [
        {
          linkId: overrides.id * 100 + 3,
          title: "예시 링크 3",
          url: `https://example.com/${overrides.id}/3`,
          state: "IMPORTED",
        },
      ],
    },
  ];
  const failures = overrides.failures ?? [];
  const linkCount = folders
    .flatMap((folder) => folder.links)
    .filter((link) => link.state !== "ADDED_LATER").length;
  return {
    fileName: "bookmarks.html",
    baseStatus: failures.length > 0 ? (linkCount > 0 ? "PARTIALLY_FAILED" : "FAILED") : "COMPLETED",
    linkCount,
    folderCount: folders.filter((folder) => folder.kind === "NEW").length,
    skippedCount: 0,
    failedCount: failures.length,
    progress: 1,
    wasReversed: false,
    createdAt: new Date().toISOString(),
    clientRequestId: null,
    ...overrides,
    folders,
    failures,
  };
}

function isRecordReversible(record: MockImportRecord) {
  return record.folders.some(
    (folder) =>
      (folder.kind === "NEW" && folder.state === "ACTIVE") ||
      folder.links.some((link) => REMOVABLE_LINK_STATES.includes(link.state)),
  );
}

function toSummary(record: MockImportRecord): ImportSummary {
  const isReversible = isRecordReversible(record);
  const status: ImportStatus = record.wasReversed
    ? isReversible
      ? "PARTIALLY_UNDONE"
      : "UNDONE"
    : record.baseStatus;
  return {
    id: record.id,
    fileName: record.fileName,
    status,
    linkCount: record.linkCount,
    folderCount: record.folderCount,
    skippedCount: record.skippedCount,
    failedCount: record.failedCount,
    progress: record.progress,
    isReversible,
    createdAt: record.createdAt,
  };
}

function toDetail(record: MockImportRecord): ImportDetail {
  return {
    ...toSummary(record),
    folders: record.folders.map((folder) => ({
      kind: folder.kind,
      folderId: folder.folderId,
      name: folder.name,
      emoji: folder.emoji,
      links: folder.links
        .filter((link) => link.state !== "ADDED_LATER")
        .map(({ linkId, title, url }) => ({ linkId, title, url })),
    })),
    failures: record.failures,
  };
}

function isMovedToUnfiled(link: MockImportLink) {
  return link.movedToUnfiled === true && !LEFT_IN_IMPORT_FOLDER_LINK_STATES.includes(link.state);
}

function toReversalPreview(record: MockImportRecord): ImportReversalPreview {
  const toLink = ({ linkId, title, url, state }: MockImportLink) => ({ linkId, title, url, state });
  const moved = record.folders.flatMap((folder) => folder.links.filter(isMovedToUnfiled));
  const unfiled = record.folders
    .filter((folder) => folder.kind === "UNFILED")
    .flatMap((folder) => folder.links)
    .concat(moved);
  const folders: ImportReversalPreview["folders"] = record.folders
    .filter((folder) => folder.kind !== "UNFILED")
    .map((folder) => ({
      kind: folder.kind,
      state: folder.state,
      folderId: folder.folderId,
      name: folder.name,
      emoji: folder.emoji,
      links: folder.links.filter((link) => !isMovedToUnfiled(link)).map(toLink),
    }));
  if (unfiled.length > 0) {
    folders.push({
      kind: "UNFILED",
      state: "ACTIVE",
      folderId: null,
      name: null,
      emoji: null,
      links: unfiled.map(toLink),
    });
  }
  return { folders };
}

function nextAvailableName(name: string, taken: Set<string>) {
  for (let index = 2; ; index += 1) {
    const suffix = ` ${index}`;
    // Cuts by UTF-16 units like the server's length rule; a surrogate pair at the cut can split.
    const base = name.slice(0, Math.max(0, IMPORT_FOLDER_NAME_MAX - suffix.length));
    const candidate = `${base}${suffix}`;
    if (!taken.has(normalizeName(candidate))) {
      return candidate;
    }
  }
}

function findKeyDuplicate(items: { key: string }[]) {
  const seen = new Set<string>();
  return items.some((item) => {
    if (seen.has(item.key)) return true;
    seen.add(item.key);
    return false;
  });
}

function validateFolderNames(folders: { name: string }[]): ImportErrorName | null {
  if (folders.some((folder) => folder.name.trim().length === 0)) return "IMPORT_FOLDER_NAME_BLANK";
  if (folders.some((folder) => folder.name.trim().length > IMPORT_FOLDER_NAME_MAX)) {
    return "IMPORT_FOLDER_NAME_OVER_MAX";
  }
  return null;
}

function validateSource(body: {
  folders: { key: string; name: string }[];
  links: { key: string }[];
}): ImportErrorName | null {
  if (body.links.length === 0) return "IMPORT_LINKS_EMPTY";
  if (body.links.length > IMPORT_LINKS_MAX) return "IMPORT_LINKS_OVER_MAX";
  if (body.folders.length > IMPORT_FOLDERS_MAX) return "IMPORT_FOLDERS_OVER_MAX";
  if (findKeyDuplicate(body.links) || findKeyDuplicate(body.folders)) {
    return "IMPORT_KEY_DUPLICATED";
  }
  return validateFolderNames(body.folders);
}

/**
 * Answers the bookmark import API (#156 section 2) through `mockApi`'s `handlers`.
 *
 * `mockApi` defaults to its own DEFAULT_FOLDERS, so pass the user's folders and links as getters
 * over the state `mockApi` returns; they are read on every request:
 *
 * ```ts
 * let api: Awaited<ReturnType<typeof mockApi>>;
 * const imports = createMockImportApi({ folders: () => api.folders, links: () => api.links });
 * api = await mockApi(page, { links: myLinks, handlers: imports.handlers });
 * ```
 *
 * Earlier imports count as the user's own data too: their IMPORTED/EDITED links are saved URLs and
 * their active NEW folders are the user's non-shared folders, so re-importing the same file skips
 * the links and reuses the folders like the real server. A start that would save no link and record
 * no failure answers 422 `IMPORT_NOTHING_TO_IMPORT` and creates no record.
 *
 * `handlers` is a Proxy that answers `/api/imports/{id}` for any id; don't spread it.
 *
 * Toggles live in `state.endpoints[endpoint]`: `fail` (`"abort"`, `"save-then-abort"` for start —
 * the record is created and then the response is lost — or `{ status, errorName? }`), `failTimes`
 * (null = every request) and `delayMs`.
 *
 * Double-tap tests should count `POST /api/imports` in `mockApi`'s `state.requests`; records
 * dedupe by `clientRequestId`, so their count can't show a second request.
 */
function createMockImportApi(options: MockImportApiOptions = {}) {
  const meId = options.meId ?? 1;
  const endpointNames: ImportEndpoint[] = [
    "preview",
    "start",
    "list",
    "detail",
    "reversalPreview",
    "reverse",
  ];
  const state = {
    records: [...(options.records ?? [])],
    progressStep: options.progressStep ?? 0.5,
    endpoints: Object.fromEntries(
      endpointNames.map((name) => [
        name,
        { fail: null, failTimes: null, delayMs: 0, ...options.endpoints?.[name] },
      ]),
    ) as Record<ImportEndpoint, ImportEndpointControl>,
  };

  const importedFolders = (): MockFolder[] =>
    state.records.flatMap((record) =>
      record.folders
        .filter((folder) => folder.kind === "NEW" && folder.state === "ACTIVE")
        .flatMap((folder) =>
          folder.folderId == null || folder.name == null
            ? []
            : [
                {
                  id: folder.folderId,
                  ownerId: meId,
                  name: folder.name,
                  emoji: folder.emoji,
                  isShared: false,
                  shareCounts: 0,
                  linkCounts: folder.links.length,
                },
              ],
        ),
    );
  const importedUrls = () =>
    state.records.flatMap((record) =>
      record.folders
        .flatMap((folder) => folder.links)
        .filter((link) => REMOVABLE_LINK_STATES.includes(link.state))
        .map((link) => link.url),
    );
  const myFolders = () => {
    const fixtures = resolve(options.folders, [] as MockFolder[]).filter(
      (folder) => folder.ownerId === meId,
    );
    const fixtureIds = new Set(fixtures.map((folder) => folder.id));
    return [...fixtures, ...importedFolders().filter((folder) => !fixtureIds.has(folder.id))];
  };
  const myUrls = () =>
    new Set(
      [
        ...resolve(options.links, [] as { url: string }[]).map((link) => link.url),
        ...importedUrls(),
      ]
        .map((url) => normalizeImportUrl(url))
        .filter((url): url is string => url != null),
    );
  const findRecord = (id: number) => state.records.find((record) => record.id === id);

  const json = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data, error: null }),
    });

  const fail = (route: Route, errorName: MockErrorName, statusOverride?: number) => {
    const { code, status: defaultStatus, message } = IMPORT_ERRORS[errorName];
    const status = statusOverride ?? defaultStatus;
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        data: null,
        error: { code, message, cause: null, causeMessage: null },
      }),
    });
  };

  const errorNameForStatus = (endpoint: ImportEndpoint, status: number): MockErrorName => {
    if (status === 400) return "COMMON_BAD_REQUEST";
    if (status === 404) {
      if (endpoint === "preview") return "IMPORT_PREVIEW_OWNER_NOT_FOUND";
      if (endpoint === "start" || endpoint === "list") return "IMPORT_OWNER_NOT_FOUND";
      return "IMPORT_NOT_FOUND";
    }
    if (status === 422 && endpoint === "reverse") return "IMPORT_REVERSAL_FOLDER_SHARED";
    return "COMMON_INTERNAL_SERVER_ERROR";
  };

  const takeFailure = (control: ImportEndpointControl) => {
    if (!control.fail) return null;
    if (control.failTimes !== null) {
      if (control.failTimes <= 0) return null;
      control.failTimes -= 1;
    }
    return control.fail;
  };

  const applyControl = async (
    route: Route,
    endpoint: ImportEndpoint,
  ): Promise<"handled" | "save-then-abort" | null> => {
    const control = state.endpoints[endpoint];
    if (control.delayMs > 0) {
      await new Promise((done) => setTimeout(done, control.delayMs));
    }
    const failure = takeFailure(control);
    if (!failure) return null;
    if (failure === "save-then-abort" && endpoint === "start") return failure;
    if (failure === "abort" || failure === "save-then-abort") {
      await route.abort("failed");
      return "handled";
    }
    const { status, errorName } = failure;
    await fail(route, errorName ?? errorNameForStatus(endpoint, status), status);
    return "handled";
  };

  const readBody = <T>(request: ReturnType<Route["request"]>) => request.postDataJSON() as T;

  const buildPreview = (body: CreateImportPreviewRequest): ImportPreview => {
    const owned = myFolders();
    const plainByName = new Map(
      owned
        .filter((folder) => !folder.isShared)
        .map((folder) => [normalizeName(folder.name), folder]),
    );
    const sharedNames = new Set(
      owned.filter((folder) => folder.isShared).map((folder) => normalizeName(folder.name)),
    );
    const taken = new Set([
      ...owned.map((folder) => normalizeName(folder.name)),
      ...body.folders.map((folder) => normalizeName(folder.name)),
    ]);
    const folders = body.folders.map((folder): ImportPreviewFolder => {
      const name = normalizeName(folder.name);
      const existing = plainByName.get(name);
      if (existing) {
        return {
          key: folder.key,
          matchType: "EXISTING",
          folderId: existing.id,
          suggestedName: existing.name,
        };
      }
      if (sharedNames.has(name)) {
        const suggestedName = nextAvailableName(folder.name.trim(), taken);
        taken.add(normalizeName(suggestedName));
        return { key: folder.key, matchType: "SHARED_CONFLICT", folderId: null, suggestedName };
      }
      return {
        key: folder.key,
        matchType: "NEW",
        folderId: null,
        suggestedName: folder.name.trim(),
      };
    });
    const saved = myUrls();
    const seen = new Set<string>();
    const links = body.links.map((link) => {
      const normalized = normalizeImportUrl(link.url);
      if (normalized && saved.has(normalized)) return { key: link.key, status: "SAVED" as const };
      if (normalized && seen.has(normalized)) {
        return { key: link.key, status: "IN_FILE_DUPLICATE" as const };
      }
      if (normalized) seen.add(normalized);
      return { key: link.key, status: "NEW" as const };
    });
    return { folders, links };
  };

  const buildRecord = (body: StartImportRequest): MockImportRecord => {
    const owned = myFolders();
    const plain = owned.filter((folder) => !folder.isShared);
    const sharedNames = new Set(
      owned.filter((folder) => folder.isShared).map((folder) => normalizeName(folder.name)),
    );
    const taken = new Set(owned.map((folder) => normalizeName(folder.name)));
    const newFoldersByName = new Map<string, MockImportFolder>();
    const targets = new Map<string, MockImportFolder>();
    const existingTargets = new Map<number, MockImportFolder>();

    const reuseExistingFolder = (folder: MockFolder) => {
      const current = existingTargets.get(folder.id);
      if (current) return current;
      const target: MockImportFolder = {
        kind: "EXISTING",
        state: "ACTIVE",
        folderId: folder.id,
        name: folder.name,
        emoji: folder.emoji,
        links: [],
      };
      existingTargets.set(folder.id, target);
      return target;
    };

    for (const folder of body.folders) {
      const byId = plain.find((candidate) => candidate.id === folder.folderId);
      if (byId) {
        targets.set(folder.key, reuseExistingFolder(byId));
        continue;
      }
      const name = normalizeName(folder.name);
      const byName = plain.find((candidate) => normalizeName(candidate.name) === name);
      if (byName) {
        targets.set(folder.key, reuseExistingFolder(byName));
        continue;
      }
      const finalName = sharedNames.has(name)
        ? nextAvailableName(folder.name.trim(), taken)
        : folder.name.trim();
      const finalKey = normalizeName(finalName);
      let target = newFoldersByName.get(finalKey);
      if (!target) {
        taken.add(finalKey);
        target = {
          kind: "NEW",
          state: "ACTIVE",
          folderId: takeMockId(70_000),
          name: finalName,
          emoji: null,
          links: [],
        };
        newFoldersByName.set(finalKey, target);
      }
      targets.set(folder.key, target);
    }

    const unfiled: MockImportFolder = {
      kind: "UNFILED",
      state: "ACTIVE",
      folderId: null,
      name: null,
      emoji: null,
      links: [],
    };
    const saved = myUrls();
    const failures: ImportFailure[] = [];
    let skippedCount = 0;
    let linkCount = 0;
    for (const link of body.links) {
      if (!isHttpUrl(link.url) || link.url.length > IMPORT_LINK_URL_MAX) {
        failures.push({ title: link.title, url: link.url, reason: "URL_INVALID" });
        continue;
      }
      if (link.title.trim().length === 0) {
        failures.push({ title: link.title, url: link.url, reason: "TITLE_INVALID" });
        continue;
      }
      const normalized = normalizeImportUrl(link.url);
      if (normalized && saved.has(normalized)) {
        skippedCount += 1;
        continue;
      }
      if (normalized) saved.add(normalized);
      const target = (link.folderKey != null && targets.get(link.folderKey)) || unfiled;
      target.links.push({
        linkId: takeMockId(500_000),
        title: link.title,
        url: link.url,
        state: "IMPORTED",
      });
      linkCount += 1;
    }

    const folders = [unfiled, ...existingTargets.values(), ...newFoldersByName.values()].filter(
      (folder) => folder.links.length > 0,
    );
    const baseStatus =
      failures.length === 0 ? "COMPLETED" : linkCount > 0 ? "PARTIALLY_FAILED" : "FAILED";
    return {
      id: Math.max(0, ...state.records.map((record) => record.id)) + 1,
      fileName: body.fileName,
      baseStatus,
      linkCount,
      folderCount: folders.filter((folder) => folder.kind === "NEW").length,
      skippedCount,
      failedCount: failures.length,
      progress: linkCount > 0 ? 0 : 1,
      wasReversed: false,
      createdAt: new Date().toISOString(),
      clientRequestId: body.clientRequestId,
      folders,
      failures,
    };
  };

  const reverse = (
    record: MockImportRecord,
    body: ReverseImportRequest,
  ): ImportErrorName | null => {
    const linkIds = body.linkIds ?? [];
    const folderIds = body.folderIds ?? [];
    if (linkIds.length === 0 && folderIds.length === 0) return "IMPORT_REVERSAL_ITEMS_EMPTY";
    const allLinks = record.folders.flatMap((folder) => folder.links);
    const selectedLinks = linkIds.map((id) => allLinks.find((link) => link.linkId === id));
    if (selectedLinks.some((link) => !link || !IMPORT_CREATED_LINK_STATES.includes(link.state))) {
      return "IMPORT_REVERSAL_ITEM_INVALID";
    }
    const selectedFolders = folderIds.map((id) =>
      record.folders.find((folder) => folder.kind === "NEW" && folder.folderId === id),
    );
    if (selectedFolders.some((folder) => !folder)) return "IMPORT_REVERSAL_ITEM_INVALID";
    if (selectedFolders.some((folder) => folder?.state === "SHARED")) {
      return "IMPORT_REVERSAL_FOLDER_SHARED";
    }
    for (const link of selectedLinks) {
      if (link && REMOVABLE_LINK_STATES.includes(link.state)) link.state = "REVERSED";
    }
    for (const folder of selectedFolders) {
      if (!folder || folder.state !== "ACTIVE") continue;
      folder.state = "REVERSED";
      for (const link of folder.links) {
        if (link.state !== "REVERSED" && link.state !== "DELETED") link.movedToUnfiled = true;
      }
    }
    record.wasReversed = true;
    return null;
  };

  const handlePreview: Handler = async (route, request) => {
    if ((await applyControl(route, "preview")) === "handled") return;
    const body = readBody<CreateImportPreviewRequest>(request);
    const error = validateSource(body);
    if (error) return fail(route, error);
    return json(route, buildPreview(body), 201);
  };

  const handleStart: Handler = async (route, request) => {
    const control = await applyControl(route, "start");
    if (control === "handled") return;
    const body = readBody<StartImportRequest>(request);
    const previous = state.records.find(
      (record) => record.clientRequestId != null && record.clientRequestId === body.clientRequestId,
    );
    if (previous) {
      if (control === "save-then-abort") return route.abort("failed");
      return json(route, toSummary(previous), 201);
    }
    if (typeof body.clientRequestId !== "string" || !UUID_PATTERN.test(body.clientRequestId)) {
      return fail(route, "COMMON_BAD_REQUEST");
    }
    if (!body.fileName || body.fileName.trim().length === 0) {
      return fail(route, "IMPORT_FILE_NAME_BLANK");
    }
    if (body.fileName.length > IMPORT_FILE_NAME_MAX)
      return fail(route, "IMPORT_FILE_NAME_OVER_MAX");
    const error = validateSource(body);
    if (error) return fail(route, error);
    const folderKeys = new Set(body.folders.map((folder) => folder.key));
    if (body.links.some((link) => link.folderKey != null && !folderKeys.has(link.folderKey))) {
      return fail(route, "IMPORT_FOLDER_KEY_NOT_FOUND");
    }
    const record = buildRecord(body);
    if (record.linkCount === 0 && record.failedCount === 0) {
      return fail(route, "IMPORT_NOTHING_TO_IMPORT");
    }
    state.records.unshift(record);
    if (control === "save-then-abort") return route.abort("failed");
    return json(route, toSummary(record), 201);
  };

  const handleList: Handler = async (route, request) => {
    if ((await applyControl(route, "list")) === "handled") return;
    const url = new URL(request.url());
    const size = Number(url.searchParams.get("size") ?? IMPORT_PAGE_SIZE) || IMPORT_PAGE_SIZE;
    const offset = Number(url.searchParams.get("cursor") ?? "0") || 0;
    const sorted = [...state.records].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
    );
    const contents = sorted.slice(offset, offset + size).map(toSummary);
    const hasNext = offset + size < sorted.length;
    const page: ImportScrollResponse = {
      isEmpty: contents.length === 0,
      contents,
      nextCursor: hasNext ? String(offset + size) : null,
      hasNext,
    };
    for (const record of state.records) {
      if (record.progress < 1) record.progress = Math.min(1, record.progress + state.progressStep);
    }
    return json(route, page);
  };

  const withRecord =
    (
      endpoint: ImportEndpoint,
      respond: (
        route: Route,
        request: ReturnType<Route["request"]>,
        record: MockImportRecord,
      ) => unknown,
    ) =>
    (id: number): Handler =>
    async (route, request) => {
      if ((await applyControl(route, endpoint)) === "handled") return;
      const record = findRecord(id);
      if (!record) return fail(route, "IMPORT_NOT_FOUND");
      return respond(route, request, record);
    };

  const handleDetail = withRecord("detail", (route, _request, record) =>
    json(route, toDetail(record)),
  );
  const handleReversalPreview = withRecord("reversalPreview", (route, _request, record) =>
    json(route, toReversalPreview(record)),
  );
  const handleReverse = withRecord("reverse", (route, request, record) => {
    const error = reverse(record, readBody<ReverseImportRequest>(request));
    if (error) return fail(route, error);
    return json(route, toSummary(record), 201);
  });

  const staticHandlers: Record<string, Handler> = {
    "POST /api/import-previews": handlePreview,
    "POST /api/imports": handleStart,
    "GET /api/imports": handleList,
  };

  const findImportHandler = (key: string): Handler | undefined => {
    if (staticHandlers[key]) return staticHandlers[key];
    const match = /^(GET|POST) \/api\/imports\/(\d+)(\/reversal-preview|\/reversals)?$/.exec(key);
    if (!match) return undefined;
    const [, method, rawId, suffix] = match;
    const id = Number(rawId);
    if (method === "GET" && !suffix) return handleDetail(id);
    if (method === "GET" && suffix === "/reversal-preview") return handleReversalPreview(id);
    if (method === "POST" && suffix === "/reversals") return handleReverse(id);
    return undefined;
  };

  const extraHandlers = options.handlers ?? {};
  const handlers = new Proxy({} as Record<string, Handler>, {
    get: (_target, key) =>
      typeof key === "string" ? (extraHandlers[key] ?? findImportHandler(key)) : undefined,
    has: (_target, key) =>
      typeof key === "string" && (key in extraHandlers || findImportHandler(key) !== undefined),
  });

  return { handlers, state };
}

export { IMPORT_ERRORS, createMockImportApi, makeImportRecord, normalizeImportUrl };
export type {
  MockErrorName,
  ImportEndpoint,
  ImportEndpointControl,
  ImportMockFailure,
  MockImportApiOptions,
  MockImportFolder,
  MockImportLink,
  MockImportRecord,
};
