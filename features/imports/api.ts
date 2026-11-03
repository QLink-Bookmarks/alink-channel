import { api } from "@/lib/api-client";

import type {
  CreateImportPreviewRequest,
  CreateImportPreviewResponse,
  GetImportResponse,
  GetImportReversalPreviewResponse,
  GetImportsParams,
  GetImportsResponse,
  ImportErrorName,
  ImportSummaryResponse,
  ReverseImportRequest,
  StartImportRequest,
} from "./types";

const IMPORT_ERROR_CODES: Record<ImportErrorName, string> = {
  IMPORT_LINKS_EMPTY: "IMPORT_400_0001",
  IMPORT_LINKS_OVER_MAX: "IMPORT_400_0002",
  IMPORT_FOLDERS_OVER_MAX: "IMPORT_400_0003",
  IMPORT_KEY_DUPLICATED: "IMPORT_400_0004",
  IMPORT_FOLDER_KEY_NOT_FOUND: "IMPORT_400_0005",
  IMPORT_FOLDER_NAME_BLANK: "IMPORT_400_0006",
  IMPORT_FOLDER_NAME_OVER_MAX: "IMPORT_400_0007",
  IMPORT_FILE_NAME_BLANK: "IMPORT_400_0008",
  IMPORT_FILE_NAME_OVER_MAX: "IMPORT_400_0009",
  IMPORT_REVERSAL_ITEMS_EMPTY: "IMPORT_400_0010",
  IMPORT_REVERSAL_ITEM_INVALID: "IMPORT_400_0011",
  IMPORT_OWNER_NOT_FOUND: "IMPORT_404_0001",
  IMPORT_NOT_FOUND: "IMPORT_404_0002",
  IMPORT_PREVIEW_OWNER_NOT_FOUND: "IMPORT_404_0003",
  IMPORT_REVERSAL_FOLDER_SHARED: "IMPORT_422_0002",
  COMMON_BAD_REQUEST: "COM_400_0001",
  COMMON_CURSOR_MALFORMED: "COM_400_0004",
  COMMON_CURSOR_FIELD_MISSING: "COM_400_0006",
};

const IMPORT_ERROR_NAMES_BY_CODE = new Map(
  Object.entries(IMPORT_ERROR_CODES).map(([name, code]) => [code, name as ImportErrorName]),
);

function getImportErrorName(error: unknown): ImportErrorName | null {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  const code = (response?.data as { error?: { code?: unknown } } | undefined)?.error?.code;
  if (typeof code !== "string") {
    return null;
  }
  return IMPORT_ERROR_NAMES_BY_CODE.get(code) ?? null;
}

async function createImportPreview(payload: CreateImportPreviewRequest) {
  return api.post<CreateImportPreviewResponse, CreateImportPreviewRequest>(
    "/api/import-previews",
    payload,
  );
}

async function startImport(payload: StartImportRequest) {
  return api.post<ImportSummaryResponse, StartImportRequest>("/api/imports", payload);
}

async function getImports(params: GetImportsParams = {}) {
  return api.get<GetImportsResponse>("/api/imports", { params });
}

async function getImport(id: number) {
  return api.get<GetImportResponse>(`/api/imports/${id}`);
}

async function getImportReversalPreview(id: number) {
  return api.get<GetImportReversalPreviewResponse>(`/api/imports/${id}/reversal-preview`);
}

async function reverseImport(id: number, payload: ReverseImportRequest) {
  return api.post<ImportSummaryResponse, ReverseImportRequest>(
    `/api/imports/${id}/reversals`,
    payload,
  );
}

export {
  IMPORT_ERROR_CODES,
  createImportPreview,
  getImport,
  getImportErrorName,
  getImportReversalPreview,
  getImports,
  reverseImport,
  startImport,
};
