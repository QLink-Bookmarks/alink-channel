import type { AiProviderType } from "@/features/account/types";
import { getProviderLabel } from "@/features/ai/lib/provider-label";
import type { AiProviderWithModels } from "@/features/ai/types";
import {
  DEFAULT_FOLDER_EMOJI,
  UNCATEGORIZED_PICKER_OPTION,
} from "@/features/folders/components/folder-picker-row";
import type { Folder } from "@/features/folders/types";

type ShareModelOption = {
  key: string;
  providerType: AiProviderType;
  userProviderId: number;
  modelId: number;
  label: string;
};

type ShareFolderChoice = {
  id: number | null;
  name: string;
  emoji: string;
};

type ShareStep = "main" | "folder" | "ai";

type ShareSubmitKind = "save" | "ai";

const SAVE_FAILURE_MESSAGE = "저장에 실패했어요. 잠시 후 다시 시도해주세요";
const UNCATEGORIZED_CHOICE: ShareFolderChoice = {
  id: null,
  name: UNCATEGORIZED_PICKER_OPTION.label,
  emoji: UNCATEGORIZED_PICKER_OPTION.icon,
};

function toModelOptions(providers: AiProviderWithModels[]): ShareModelOption[] {
  return providers.flatMap((provider) => {
    const model = [...provider.models]
      .sort((a, b) => a.priority - b.priority)
      .find((entry) => entry.userProviderId != null);
    if (!model?.userProviderId) {
      return [];
    }
    return [
      {
        key: String(provider.providerId),
        providerType: provider.providerType,
        userProviderId: model.userProviderId,
        modelId: model.id,
        label: getProviderLabel(provider),
      },
    ];
  });
}

function toFolderChoice(folder: Folder): ShareFolderChoice {
  return { id: folder.id, name: folder.name, emoji: folder.emoji ?? DEFAULT_FOLDER_EMOJI };
}

function shouldShowUncategorizedHint(folder: ShareFolderChoice, models: ShareModelOption[]) {
  return folder.id === null && models.length > 0;
}

function getTodoSummary(generateTodo: boolean): string {
  return generateTodo ? "액션 켬" : "액션 끔";
}

export {
  SAVE_FAILURE_MESSAGE,
  UNCATEGORIZED_CHOICE,
  getTodoSummary,
  shouldShowUncategorizedHint,
  toFolderChoice,
  toModelOptions,
};
export type { ShareFolderChoice, ShareModelOption, ShareStep, ShareSubmitKind };
