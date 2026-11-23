import * as React from "react";
import { View } from "react-native";

import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { getWebAppOrigin } from "@/lib/app-variant";
import { useToastStore } from "@/stores/toast-store";

import * as Clipboard from "expo-clipboard";
import { Copy } from "lucide-react-native/icons";

const isWeb = process.env.EXPO_OS === "web";

type PublicAddressRowProps = {
  path: `/folders/${number}` | `/links/${number}`;
};

function PublicAddressRow({ path }: PublicAddressRowProps) {
  const [failed, setFailed] = React.useState(false);
  const showToast = useToastStore((state) => state.showToast);
  const origin =
    isWeb && typeof window !== "undefined" ? window.location.origin : getWebAppOrigin();
  const address = `${origin}${path}`;

  const handleCopy = async () => {
    let copied = false;
    try {
      if (isWeb) {
        await navigator.clipboard.writeText(address);
        copied = true;
      } else {
        copied = await Clipboard.setStringAsync(address);
      }
    } catch {
      copied = false;
    }
    setFailed(!copied);
    showToast({
      sourceKey: "public-address-copy",
      title: copied
        ? "공개 주소를 복사했어요."
        : "공개 주소를 복사하지 못했어요. 다시 시도해주세요.",
      variant: copied ? "success" : "error",
    });
  };

  return (
    <View className="flex-row items-center gap-1 rounded-lg bg-muted px-2">
      {failed ? (
        <Text
          selectable
          className="min-w-0 flex-1 rounded py-2 text-sm text-muted-foreground web:[overflow-wrap:anywhere] web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-ring"
          {...(isWeb && {
            tabIndex: 0 as const,
            onFocus: (event: { currentTarget: EventTarget }) => {
              if (!(event.currentTarget instanceof HTMLElement)) return;
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(event.currentTarget);
              selection?.removeAllRanges();
              selection?.addRange(range);
            },
          })}
        >
          {address}
        </Text>
      ) : (
        <View className="min-w-0 flex-1 flex-row items-center">
          <Text
            className="min-w-0 shrink text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {origin}
          </Text>
          <Text
            className="shrink-0 text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {path}
          </Text>
        </View>
      )}
      <IconButton
        accessibilityLabel="공개 주소 복사"
        className="shrink-0"
        icon={Copy}
        variant="ghost"
        onPress={handleCopy}
      />
    </View>
  );
}

export { PublicAddressRow };
export type { PublicAddressRowProps };
