import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { DetailRow } from "./link-detail-parts";

import { Link } from "expo-router";

function LinkDetailNotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <View
      accessibilityLabel="내 정리"
      testID="link-detail-my-notes"
    >
      <Text
        aria-level={2}
        className="mb-1 text-sm font-bold text-foreground"
        role="heading"
      >
        내 정리
      </Text>
      {children}
    </View>
  );
}

function LinkDetailFolderRow({
  name,
  emoji,
  href,
  trailing,
}: {
  name?: string | null;
  emoji?: string | null;
  href?: `/folders/${number}`;
  trailing?: React.ReactNode;
}) {
  const label = (
    <Text
      className={cn(
        "text-[13px] leading-5",
        name ? "font-semibold text-foreground" : "text-muted-foreground",
        href && "underline",
      )}
      numberOfLines={name ? 2 : undefined}
      testID="link-detail-folder-name"
    >
      {name ? `${emoji ?? "📁"} ${name}` : "폴더 없음"}
    </Text>
  );
  return (
    <DetailRow
      first
      label="폴더"
      testID="link-detail-folder-row"
      trailing={trailing}
    >
      {href ? (
        <Link
          href={href}
          asChild
        >
          {label}
        </Link>
      ) : (
        label
      )}
    </DetailRow>
  );
}

export { LinkDetailFolderRow, LinkDetailNotesLayout };
