import { Pressable, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { getAiProviderKind } from "../lib/provider-kind";
import { useAiProviderCatalogQuery } from "../queries";
import type { AiProviderModel, AiProviderWithModels } from "../types";
import { AiProviderLogo } from "./ai-provider-logo";

import { Check } from "lucide-react-native/icons";

type AiProviderSelection = {
  providerId: number;
  providerLabel: string;
};

type AiProviderPickerListProps = {
  selectedProviderId: number | null;
  /** The provider used when none is picked; its row carries a 기본 tag. */
  defaultProviderId?: number | null;
  onSelect: (selection: AiProviderSelection) => void;
  className?: string;
};

const PROVIDERS_LOADING_LABEL = "불러오는 중";
const NO_PROVIDERS_TITLE = "사용할 수 있는 AI 제공자가 없어요";
const NO_PROVIDERS_DESCRIPTION = "잠시 후 다시 시도해주세요.";

function getProviderLabel(provider: AiProviderWithModels): string {
  switch (provider.providerType) {
    case "GEMINI":
      return "Gemini";
    case "CLAUDE":
      return "Claude";
    case "OPENAI":
      return "OpenAI";
    default:
      return provider.providerType;
  }
}

// 사용량 제한에 따라 순차적으로 쓰이는 순서. priority가 앞선 모델이 그 제공자의 기본값이다.
function sortModelsByPriority(models: AiProviderModel[]): AiProviderModel[] {
  return [...models].sort((a, b) => a.priority - b.priority);
}

function getProviderSelection(provider: AiProviderWithModels): AiProviderSelection {
  return {
    providerId: provider.providerId,
    providerLabel: getProviderLabel(provider),
  };
}

function AiProviderPickerList({
  selectedProviderId,
  defaultProviderId = null,
  onSelect,
  className,
}: AiProviderPickerListProps) {
  const providersQuery = useAiProviderCatalogQuery();
  const providers = providersQuery.data ?? [];

  if (providersQuery.isLoading) {
    return (
      <ActivityIndicator
        accessibilityLabel={PROVIDERS_LOADING_LABEL}
        size="large"
        className={cn("py-8", className)}
      />
    );
  }

  if (providers.length === 0) {
    return (
      <View
        className={cn("items-center gap-1 px-4 py-6", className)}
        testID="ai-provider-picker-empty"
      >
        <Text className="text-center text-[13px] font-semibold text-foreground">
          {NO_PROVIDERS_TITLE}
        </Text>
        <Text className="text-center text-sm font-normal text-muted-foreground">
          {NO_PROVIDERS_DESCRIPTION}
        </Text>
      </View>
    );
  }

  return (
    <View className={cn("gap-3", className)}>
      <View className="gap-1.5">
        {providers.map((provider) => (
          <AiProviderPickerRow
            key={provider.providerId}
            provider={provider}
            isDefault={defaultProviderId === provider.providerId}
            selected={selectedProviderId === provider.providerId}
            onPress={() => onSelect(getProviderSelection(provider))}
          />
        ))}
      </View>
      <AiProviderModelNotice providers={providers} />
    </View>
  );
}

function AiProviderPickerRow({
  provider,
  isDefault,
  selected,
  onPress,
}: {
  provider: AiProviderWithModels;
  isDefault: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const label = getProviderLabel(provider);

  return (
    <Pressable
      className={cn(
        "h-12 flex-row items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 web:hover:border-primary",
        selected && "border-primary bg-accent",
      )}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} 선택`}
      accessibilityState={{ selected }}
    >
      <AiProviderLogo
        kind={getAiProviderKind(provider.providerType)}
        name={label}
        className="min-w-0 shrink"
        nameClassName={cn("text-sm", selected && "text-accent-foreground")}
      >
        {isDefault ? <DefaultProviderTag /> : null}
      </AiProviderLogo>
      <View className="flex-1" />
      {selected ? (
        <Icon
          as={Check}
          size={18}
          className="text-primary"
          testID="ai-provider-picker-check"
        />
      ) : null}
    </Pressable>
  );
}

function DefaultProviderTag() {
  return (
    <View className="ml-1 rounded-md border border-border-soft bg-surface-elevated px-1.5 py-px">
      <Text className="text-[11px] font-semibold text-muted-foreground">기본</Text>
    </View>
  );
}

function AiProviderModelNotice({ providers }: { providers: AiProviderWithModels[] }) {
  const rows = providers
    .map((provider) => ({
      label: getProviderLabel(provider),
      models: sortModelsByPriority(provider.models)
        .map((model) => model.model)
        .join(", "),
    }))
    .filter((row) => row.models.length > 0);

  return (
    <View className="gap-1 px-1">
      <Text className="text-xs leading-5 text-muted-foreground">
        제공사 별 모델은 서비스의 사용량 제한에 따라 순차적으로 선택되어 사용됩니다.
      </Text>
      {rows.map((row) => (
        <Text
          key={row.label}
          className="text-xs leading-5 text-muted-foreground"
        >
          {row.label} · {row.models}
        </Text>
      ))}
    </View>
  );
}

export {
  AiProviderPickerList,
  NO_PROVIDERS_DESCRIPTION,
  NO_PROVIDERS_TITLE,
  PROVIDERS_LOADING_LABEL,
  getProviderLabel,
  getProviderSelection,
};
export type { AiProviderPickerListProps, AiProviderSelection };
