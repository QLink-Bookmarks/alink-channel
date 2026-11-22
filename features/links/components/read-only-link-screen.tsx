import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { isPreviewableUrl } from "@/features/links/lib/link-preview/link-preview-result";
import type { PublicLinkDetail } from "@/features/links/types";

import { Link } from "expo-router";

function ReadOnlyLinkScreen({ link }: { link: PublicLinkDetail }) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View
        role="main"
        className="gap-4 px-6 pb-24 pt-4 md:pb-6"
      >
        <Link
          href={`/folders/${link.folderId}`}
          className="self-start text-sm text-foreground underline"
        >
          {[link.folderEmoji, link.folderName].filter(Boolean).join(" ")}
        </Link>
        <Text
          role="heading"
          aria-level={1}
          className="text-xl font-bold"
        >
          {link.title}
        </Text>
        {isPreviewableUrl(link.url) ? (
          <Link
            href={link.url as `https://${string}` | `http://${string}`}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-sm text-foreground underline web:[overflow-wrap:anywhere]"
          >
            {link.url}
          </Link>
        ) : (
          <Text
            selectable
            className="text-sm text-muted-foreground web:[overflow-wrap:anywhere]"
          >
            {link.url}
          </Text>
        )}
        {link.todos.length > 0 ? (
          <View className="gap-2">
            <Text
              role="heading"
              aria-level={2}
              className="text-lg font-semibold"
            >
              할 일
            </Text>
            {link.todos.map(({ title, isCompleted }, index) => (
              <View
                key={index}
                className="flex-row items-start gap-2"
              >
                <Text className="flex-1">{title}</Text>
                <Text className="text-sm text-muted-foreground">
                  {isCompleted ? "완료" : "미완료"}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

export { ReadOnlyLinkScreen };
