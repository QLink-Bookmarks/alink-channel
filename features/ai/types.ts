import type { AiProviderType } from "@/features/account/types";
import type { ApiEnvelope } from "@/features/links/types";

type AiProviderModel = {
  id: number;
  model: string;
  priority: number;
  // null on the public catalog (isMine=false); only set for the caller's own providers.
  userProviderId: number | null;
};

type AiProviderWithModels = {
  providerId: number;
  providerType: AiProviderType;
  models: AiProviderModel[];
};

type GetAiProviderModelsResponse = ApiEnvelope<AiProviderWithModels[]>;

type AiSummaryRequest = {
  id?: number | null;
  folderId?: number | null;
  userProviderId: number;
  modelId: number;
  url: string;
  title?: string | null;
  generateTodo?: boolean;
  // Omitted values are stored as null / false, even for an existing link.
  thumbnailUrl?: string | null;
  faviconUrl?: string | null;
  isVideo?: boolean;
};

type AiSummaryResponseData = {
  id: number;
};

type AiSummaryResponse = ApiEnvelope<AiSummaryResponseData>;

export type {
  AiProviderModel,
  AiProviderWithModels,
  AiSummaryRequest,
  AiSummaryResponse,
  AiSummaryResponseData,
  GetAiProviderModelsResponse,
};
