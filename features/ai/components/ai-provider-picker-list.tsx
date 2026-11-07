import { Pressable, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { getProviderLabel } from "../lib/provider-label";
import { useAiProviderCatalogQuery } from "../queries";
import type { AiProviderModel, AiProviderWithModels } from "../types";

import { Sparkles } from "lucide-react-native/icons";

type AiProviderSelection = {
  providerId: number;
  providerLabel: string;
};

type AiProviderPickerListProps = {
  selectedProviderId: number | null;
  onSelect: (selection: AiProviderSelection) => void;
  className?: string;
};

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
  onSelect,
  className,
}: AiProviderPickerListProps) {
  const providersQuery = useAiProviderCatalogQuery();
  const providers = providersQuery.data ?? [];

  if (providersQuery.isLoading) {
    return (
      <ActivityIndicator
        size="large"
        className={cn("py-8", className)}
      />
    );
  }

  if (providers.length === 0) {
    return (
      <EmptyState
        emoji="🤖"
        title="사용할 수 있는 AI 제공자가 없어요"
        description="잠시 후 다시 시도해주세요."
      />
    );
  }

  return (
    <View className={cn("gap-4", className)}>
      <View className="gap-2">
        {providers.map((provider) => (
          <AiProviderPickerRow
            key={provider.providerId}
            provider={provider}
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
  selected,
  onPress,
}: {
  provider: AiProviderWithModels;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3",
        selected && "border-primary bg-accent",
      )}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${getProviderLabel(provider)} 선택`}
      accessibilityState={{ selected }}
    >
      <Text
        className={cn("min-w-0 flex-1 font-semibold", selected && "text-accent-foreground")}
        numberOfLines={1}
      >
        {getProviderLabel(provider)}
      </Text>
      {selected ? (
        <Icon
          as={Sparkles}
          size={18}
          className="text-primary"
        />
      ) : null}
    </Pressable>
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

export { AiProviderPickerList, getProviderLabel, getProviderSelection };
export type { AiProviderPickerListProps, AiProviderSelection };
