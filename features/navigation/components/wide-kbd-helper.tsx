import { View } from "react-native";

import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";

import { useNewLinkShortcutLabel } from "../hooks/use-new-link-shortcut-label";

const WIDE_KBD_HELPER_LABEL_CLASS_NAME = "dark:text-popover-foreground";

function WideKbdHelper() {
  const shortcutLabel = useNewLinkShortcutLabel();

  return (
    <View className="absolute bottom-6 right-6 z-fixed flex-row items-center gap-4 rounded-full border border-background/10 bg-foreground/85 px-5 py-1.5 shadow-qlink-md dark:border-border dark:bg-popover/90">
      <View className="flex-row items-center gap-2">
        <Kbd
          variant="inverse"
          label="검색"
          labelClassName={WIDE_KBD_HELPER_LABEL_CLASS_NAME}
          labelPosition="right"
        >
          ⌘/Ctrl + K
        </Kbd>
      </View>
      {shortcutLabel ? (
        <>
          <View className="h-4 w-px bg-background/20 dark:bg-border" />
          <View className="flex-row items-center gap-2">
            <Kbd
              variant="inverse"
              label="새 링크"
              labelClassName={WIDE_KBD_HELPER_LABEL_CLASS_NAME}
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
