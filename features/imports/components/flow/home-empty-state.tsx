import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { openImportFlow } from "@/stores/import-flow";

import { isImportAvailable } from "../../lib/import-availability";
import { WebOnlyImportNote } from "./web-only-import-note";

import { Link, Plus, Upload } from "lucide-react-native/icons";

type HomeEmptyStateProps = {
  className?: string;
  onAddLink?: () => void;
};

function HomeEmptyState({ className, onAddLink }: HomeEmptyStateProps) {
  return (
    <View
      testID="home-empty-state"
      className={cn("items-center justify-center gap-2 px-6 py-12", className)}
    >
      <View className="mb-1.5 size-12 items-center justify-center rounded-[14px] bg-muted">
        <Icon
          as={Link}
          className="size-[22px] text-muted-foreground"
        />
      </View>
      <Text
        accessibilityRole="header"
        className="text-center text-[17px] font-bold text-foreground"
      >
        아직 저장한 링크가 없어요
      </Text>
      <Text className="max-w-[340px] text-center text-[13px] leading-5 text-muted-foreground">
        링크를 직접 추가하거나, 브라우저에 모아 둔 북마크를 한 번에 가져올 수 있어요.
      </Text>
      <View className="mt-2.5 flex-row flex-wrap justify-center gap-2">
        {onAddLink ? (
          <Button
            className="h-10 flex-row gap-1.5 rounded-xl px-4"
            variant="outline"
            onPress={onAddLink}
          >
            <Icon
              as={Plus}
              className="size-4 text-foreground"
            />
            <Text className="text-sm font-semibold">링크 추가</Text>
          </Button>
        ) : null}
        {isImportAvailable() ? (
          <Button
            className="h-10 flex-row gap-1.5 rounded-xl px-4"
            onPress={() => openImportFlow({ from: "home" })}
          >
            <Icon
              as={Upload}
              className="size-4 text-primary-foreground"
            />
            <Text className="text-sm font-semibold">브라우저 북마크 가져오기</Text>
          </Button>
        ) : (
          <WebOnlyImportNote className="h-10 px-1" />
        )}
      </View>
    </View>
  );
}

export { HomeEmptyState };
