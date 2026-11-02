import { View } from "react-native";

import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";

import { useNewLinkShortcutLabel } from "../hooks/use-new-link-shortcut-label";

function WideKbdHelper() {
  const shortcutLabel = useNewLinkShortcutLabel();

  return (
    <View className="absolute bottom-6 right-6 z-fixed flex-row items-center gap-4 rounded-full border border-white/10 bg-black/40 px-5 py-1.5 shadow-qlink-md dark:border-white/15 dark:bg-white/80">
      <View className="flex-row items-center gap-2">
        <Kbd
          variant="inverse"
          label="검색"
          labelPosition="right"
        >
          ⌘/Ctrl + K
        </Kbd>
      </View>
      {shortcutLabel ? (
        <>
          <View className="h-4 w-px bg-white/20 dark:bg-black/15" />
          <View className="flex-row items-center gap-2">
            <Kbd
              variant="inverse"
              label="새 링크"
              labelPosition="right"
            >
              {shortcutLabel}
            </Kbd>
          </View>
        </>
      ) : null}
      <Text className="sr-only">와이드뷰 키보드 단축키 안내</Text>
    </View>
  );
}

export { WideKbdHelper };
