import type { ApiEnvelope } from "@/features/links/types";

type ImportStatus = "COMPLETED" | "PARTIALLY_FAILED" | "FAILED" | "UNDONE" | "PARTIALLY_UNDONE";

type ImportFolderMatchType = "EXISTING" | "SHARED_CONFLICT" | "NEW";

type ImportPreviewLinkStatus = "NEW" | "SAVED" | "IN_FILE_DUPLICATE";

type ImportFolderKind = "EXISTING" | "NEW" | "UNFILED";

type ImportFailureReason = "URL_INVALID" | "TITLE_INVALID" | "UNKNOWN";

type ReversalFolderState = "ACTIVE" | "SHARED" | "DELETED" | "REVERSED";

type ReversalLinkState = "IMPORTED" | "EDITED" | "DELETED" | "REVERSED" | "ADDED_LATER";

type ImportErrorName =
  | "IMPORT_LINKS_EMPTY"
  | "IMPORT_LINKS_OVER_MAX"
  | "IMPORT_FOLDERS_OVER_MAX"
  | "IMPORT_KEY_DUPLICATED"
  | "IMPORT_FOLDER_KEY_NOT_FOUND"
  | "IMPORT_FOLDER_NAME_BLANK"
  | "IMPORT_FOLDER_NAME_OVER_MAX"
  | "IMPORT_FILE_NAME_BLANK"
  | "IMPORT_FILE_NAME_OVER_MAX"
  | "IMPORT_REVERSAL_ITEMS_EMPTY"
  | "IMPORT_REVERSAL_ITEM_INVALID"
  | "IMPORT_OWNER_NOT_FOUND"
  | "IMPORT_NOT_FOUND"
  | "IMPORT_PREVIEW_OWNER_NOT_FOUND"
  | "IMPORT_REVERSAL_FOLDER_SHARED"
  | "COMMON_BAD_REQUEST"
  | "COMMON_CURSOR_MALFORMED"
  | "COMMON_CURSOR_FIELD_MISSING";

type ImportPreviewFolderRequest = {
  key: string;
  name: string;
};

type ImportPreviewLinkRequest = {
  key: string;
  url: string;
};

type CreateImportPreviewRequest = {
  folders: ImportPreviewFolderRequest[];
  links: ImportPreviewLinkRequest[];
};

type ImportPreviewFolder = {
  key: string;
  matchType: ImportFolderMatchType;
  folderId?: number | null;
  suggestedName: string;
};

type ImportPreviewLink = {
  key: string;
  status: ImportPreviewLinkStatus;
};

type ImportPreview = {
  folders: ImportPreviewFolder[];
  links: ImportPreviewLink[];
};

type CreateImportPreviewResponse = ApiEnvelope<ImportPreview>;

type StartImportFolderRequest = {
  key: string;
  folderId?: number | null;
  name: string;
  createdAt?: string | null;
};

type StartImportLinkRequest = {
  key: string;
  url: string;
  title: string;
  folderKey?: string | null;
  createdAt?: string | null;
};

type StartImportRequest = {
  clientRequestId: string;
  fileName: string;
  folders: StartImportFolderRequest[];
  links: StartImportLinkRequest[];
};

type ImportSummary = {
  id: number;
  fileName: string;
  status: ImportStatus;
  linkCount: number;
  folderCount: number;
  skippedCount: number;
  failedCount: number;
  progress: number;
  isReversible: boolean;
  createdAt: string;
};

type ImportSummaryResponse = ApiEnvelope<ImportSummary>;

type ImportScrollResponse = {
  isEmpty: boolean;
  contents: ImportSummary[];
  nextCursor: string | null;
  hasNext: boolean;
};

type GetImportsParams = {
  cursor?: string;
  size?: number;
};

type GetImportsResponse = ApiEnvelope<ImportScrollResponse>;

type ImportDetailLink = {
  linkId: number;
  title: string;
  url: string;
};

type ImportDetailFolder = {
  kind: ImportFolderKind;
  folderId?: number | null;
  name: string;
  emoji?: string | null;
  links: ImportDetailLink[];
};

type ImportFailure = {
  title: string;
  url: string;
  reason: ImportFailureReason;
};

type ImportDetail = ImportSummary & {
  folders: ImportDetailFolder[];
  failures: ImportFailure[];
};

type GetImportResponse = ApiEnvelope<ImportDetail>;

type ImportReversalLink = {
  linkId: number;
  title: string;
  url: string;
  state: ReversalLinkState;
};

type ImportReversalFolder = {
  kind: ImportFolderKind;
  state: ReversalFolderState;
  folderId?: number | null;
  name: string;
  emoji?: string | null;
  links: ImportReversalLink[];
};

type ImportReversalPreview = {
  folders: ImportReversalFolder[];
};

type GetImportReversalPreviewResponse = ApiEnvelope<ImportReversalPreview>;

type ReverseImportRequest = {
  linkIds: number[];
  folderIds: number[];
};

export type {
  CreateImportPreviewRequest,
  CreateImportPreviewResponse,
  GetImportResponse,
  GetImportReversalPreviewResponse,
  GetImportsParams,
  GetImportsResponse,
  ImportDetail,
  ImportDetailFolder,
  ImportDetailLink,
  ImportErrorName,
  ImportFailure,
  ImportFailureReason,
  ImportFolderKind,
  ImportFolderMatchType,
  ImportPreview,
  ImportPreviewFolder,
  ImportPreviewFolderRequest,
  ImportPreviewLink,
  ImportPreviewLinkRequest,
  ImportPreviewLinkStatus,
  ImportReversalFolder,
  ImportReversalLink,
  ImportReversalPreview,
  ImportScrollResponse,
  ImportStatus,
  ImportSummary,
  ImportSummaryResponse,
  ReversalFolderState,
  ReversalLinkState,
  ReverseImportRequest,
  StartImportFolderRequest,
  StartImportLinkRequest,
  StartImportRequest,
};
