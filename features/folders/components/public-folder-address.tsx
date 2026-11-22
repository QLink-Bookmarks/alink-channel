import * as React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { getWebAppOrigin } from "@/lib/app-variant";

import * as Clipboard from "expo-clipboard";
import { Link } from "expo-router";

function PublicFolderAddress({ folderId }: { folderId: number }) {
  const [status, setStatus] = React.useState<"copied" | "failed">();
  const origin =
    process.env.EXPO_OS === "web" && typeof window !== "undefined"
      ? window.location.origin
      : getWebAppOrigin();
  const url = `${origin}/folders/${folderId}`;

  const handleCopy = async () => {
    try {
      if (process.env.EXPO_OS === "web") {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
        return;
      }
      setStatus((await Clipboard.setStringAsync(url)) ? "copied" : "failed");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <View className="gap-2 rounded-xl border border-border bg-card p-3">
      <Text className="text-sm font-semibold">공개 열람 주소</Text>
      <Text
        selectable
        className="text-sm text-muted-foreground web:[overflow-wrap:anywhere]"
      >
        {url}
      </Text>
      <View className="flex-row flex-wrap items-center gap-3">
        <Button
          className="min-h-11"
          size="sm"
          variant="outline"
          onPress={handleCopy}
        >
          <Text>주소 복사</Text>
        </Button>
        <Link
          href={url as `https://${string}` | `http://${string}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded text-sm font-medium text-foreground underline web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-ring"
        >
          공개 페이지 열기
        </Link>
      </View>
      {status ? (
        <Text
          role="status"
          className="text-xs text-muted-foreground"
        >
          {status === "copied"
            ? "공개 주소를 복사했어요."
            : "복사하지 못했어요. 위 주소를 선택해 직접 복사해 주세요."}
        </Text>
      ) : null}
    </View>
  );
}

export { PublicFolderAddress };
