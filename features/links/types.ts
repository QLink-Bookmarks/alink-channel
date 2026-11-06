type SourceType = "INPUT" | "QR" | "IMPORT" | "COPY";

type LinkStatus = "G" | "A" | "F" | "C";

type RepeatDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

type CreateLinkTodoRequest = {
  title: string;
  reminderAt?: string | null;
  repeatUntil?: string | null;
  repeatDays?: RepeatDay[] | null;
  repeatTime?: string | null;
  repeatTimezone?: string | null;
};

type CreateLinkRequest = {
  url: string;
  title: string;
  summary?: string;
  tags: string[];
  memo?: string;
  // Only one of the two image fields carries a value (see `LinkPreview`).
  thumbnailUrl?: string | null;
  faviconUrl?: string | null;
  isVideo?: boolean;
  sourceType: Extract<SourceType, "INPUT" | "QR">;
  folderId?: number | null;
  todos: CreateLinkTodoRequest[];
};

type UpdateLinkRequest = {
  url: string;
  title: string;
  summary?: string | null;
  tags: string[];
  memo?: string | null;
  // PUT is a full replace — omitting folderId makes the server reset the link to
  // uncategorized, so always send the link's current folder.
  folderId?: number | null;
  // Same for the preview fields: omitting them clears the image (null) and the
  // video flag (false), so always resend the values from the detail.
  thumbnailUrl?: string | null;
  faviconUrl?: string | null;
  isVideo?: boolean;
  sourceType: SourceType;
};

type SetLinkFavoriteRequest = {
  isFavorite: boolean;
};

type CopyLinkRequest = {
  fromFolderId: number;
  // null = "없음" (uncategorized / AI auto-classify), mirroring link creation.
  toFolderId: number | null;
};

type CopyLinkResponse = ApiEnvelope<{
  id: number;
}>;

type PatchLinkRequest = {
  // null = "없음" (remove from folder / AI auto-classify).
  folderId?: number | null;
  memo?: string | null;
  tags?: string[] | null;
};

type SetLinkFavoriteResponse = ApiEnvelope<null>;

type CreateLinkResponse = {
  success: boolean;
  data: {
    id: number;
  };
};

type LinkTodo = {
  id: number | string;
  title?: string | null;
  content?: string | null;
  done?: boolean | null;
  completed?: boolean | null;
  completedAt?: string | null;
  reminderAt?: string | null;
  dueAt?: string | null;
  repeatUntil?: string | null;
  repeatDays?: RepeatDay[] | null;
  repeatTime?: string | null;
};

/** Fields the server matched a search query on; for app-side decisions only, never shown. */
type MatchedField = "TITLE" | "URL" | "TAGS" | "SUMMARY" | "MEMO" | "CONTENT";

/** A highlighted range of `ContentSnippet.text`: UTF-16 indexes, `end` exclusive. */
type HighlightRange = {
  start: number;
  end: number;
};

/** Short context around a body match (≤100 UTF-16 units, ellipses included). */
type ContentSnippet = {
  text: string;
  highlights: HighlightRange[];
};

/**
 * The page-body part of a link detail. `excerpt` is the server-cut excerpt (≤101 units,
 * ending in "…") or null while collecting, after a failure or for a body too short.
 * `isPending` only drives the silent re-check; it is never shown.
 */
type LinkDetailContent = {
  excerpt: string | null;
  isPending: boolean;
};

type LinkDetail = {
  id: number;
  url: string;
  title: string;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  isVideo: boolean;
  summary?: string | null;
  tags: string[];
  memo?: string | null;
  sourceType: SourceType;
  createdAt: string;
  folderId?: number | null;
  folderEmoji?: string | null;
  folderName?: string | null;
  todos: LinkTodo[];
  workModel?: string | null;
  status?: LinkStatus | null;
  isFavorite: boolean;
  /** null = no record (links saved before the feature); missing before the server ships it. */
  content?: LinkDetailContent | null;
};

type ApiEnvelope<TData> = {
  success: boolean;
  data: TData;
  error: {
    code: string;
    message: string;
    cause?: string | null;
    causeMessage?: string | null;
  } | null;
};

type LinkDetailResponse = ApiEnvelope<LinkDetail>;
type DeleteLinkResponse = ApiEnvelope<null>;

/**
 * Todo counts of a link in the list response. `open` includes `dueSoon` and `overdue`.
 */
type LinkTodoCounts = {
  open: number;
  dueSoon: number;
  overdue: number;
  completed: number;
};

type LinkListItem = {
  id: number;
  folderId?: number | null;
  folderName?: string | null;
  folderEmoji?: string | null;
  url: string;
  title: string;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  isVideo: boolean;
  tags: string[];
  createdAt: string;
  todoCounts: LinkTodoCounts;
  workModel?: string | null;
  status?: LinkStatus | null;
  isFavorite: boolean;
  /** Same excerpt as the detail; null when there is none. */
  contentExcerpt?: string | null;
  /** Empty without a search query. */
  matchedFields?: MatchedField[];
  /** Context around a body match; null without a query or a body match. */
  contentSnippet?: ContentSnippet | null;
};

type LinkScrollResponse = {
  isEmpty: boolean;
  contents: LinkListItem[];
  nextCursor: string | null;
  hasNext: boolean;
};

type GetLinksResponse = ApiEnvelope<LinkScrollResponse>;

type LinkOrder = "latest" | "earliest" | "laxico" | "similar";

type GetLinksParams = {
  query?: string;
  folderId?: number;
  order?: LinkOrder;
  cursor?: string;
  size?: number;
  isFavorite?: boolean;
};

// A link preview holds at most one image: the stored main image (`thumbnailUrl`),
// or, only when there is none, the stored favicon (`faviconUrl`). Both null means
// the card falls back to the domain.
type LinkPreviewImages =
  | { thumbnailUrl: string; faviconUrl: null }
  | { thumbnailUrl: null; faviconUrl: string | null };

type LinkPreview = LinkPreviewImages & {
  title: string | null;
  isVideo: boolean;
};

type LinkPreviewResponse = ApiEnvelope<{
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  isVideo: boolean;
}>;

export type {
  ApiEnvelope,
  CopyLinkRequest,
  CopyLinkResponse,
  CreateLinkRequest,
  CreateLinkResponse,
  ContentSnippet,
  CreateLinkTodoRequest,
  DeleteLinkResponse,
  HighlightRange,
  LinkPreview,
  LinkPreviewImages,
  LinkPreviewResponse,
  RepeatDay,
  GetLinksParams,
  GetLinksResponse,
  LinkDetail,
  LinkDetailContent,
  LinkDetailResponse,
  LinkListItem,
  PatchLinkRequest,
  LinkTodoCounts,
  LinkOrder,
  LinkScrollResponse,
  LinkStatus,
  LinkTodo,
  MatchedField,
  SetLinkFavoriteRequest,
  SetLinkFavoriteResponse,
  SourceType,
  UpdateLinkRequest,
};
