import { Pressable, ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { FolderPickerRow } from "@/features/folders/components/folder-picker-row";

import type { ShareModelOption } from "./share-options";
import { ShareProviderLogo } from "./share-provider-logo";
import { ShareStepNav } from "./share-step-nav";
import { ShareToggleTrack } from "./share-toggle-track";

type ShareAiStepProps = {
  models: ShareModelOption[];
  selectedKey: string | null;
  generateTodo: boolean;
  onSelectModel: (model: ShareModelOption) => void;
  onGenerateTodoChange: (value: boolean) => void;
  onBack: () => void;
};

function ShareAiStep({
  models,
  selectedKey,
  generateTodo,
  onSelectModel,
  onGenerateTodoChange,
  onBack,
}: ShareAiStepProps) {
  return (
    <View className="min-h-0 flex-1">
      <ShareStepNav
        title="AI 옵션"
        onBack={onBack}
      />
      <ScrollView
        className="min-h-0 flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mx-2 mb-1.5 mt-0.5 text-[13px] font-semibold text-muted-foreground">
          AI 제공자
        </Text>
        <View
          aria-label="AI 제공자"
          className="gap-0.5"
          role="radiogroup"
        >
          {models.map((model) => (
            <FolderPickerRow
              key={model.key}
              accessibilityLabel={model.label}
              isLarge
              label={model.label}
              leading={
                <ShareProviderLogo
                  size={20}
                  type={model.providerType}
                />
              }
              selected={model.key === selectedKey}
              onPress={() => onSelectModel(model)}
            />
          ))}
        </View>
        <View className="my-2 h-px bg-border" />
        <Pressable
          accessibilityLabel="액션 생성"
          accessibilityRole="switch"
          accessibilityState={{ checked: generateTodo }}
          className="min-h-14 flex-row items-center gap-3 rounded-xl px-2 py-1.5 active:bg-muted"
          onPress={() => onGenerateTodoChange(!generateTodo)}
        >
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base font-medium text-foreground">액션 생성</Text>
            <Text className="text-[13px] leading-[18px] text-muted-foreground">
              마감일이 보이면 액션으로 만들어요
            </Text>
          </View>
          <ShareToggleTrack checked={generateTodo} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

export { ShareAiStep };
