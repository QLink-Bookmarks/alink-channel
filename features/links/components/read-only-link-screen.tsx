import { View } from "react-native";

import { AppHeader } from "@/components/layout/app-header";
import { TodoItem } from "@/features/todos/components/todo-item/todo-item";
import { useWideView } from "@/lib/hooks/use-wide-view";

import type { PublicLinkDetail } from "../types";
import { LinkDetailActionList, LinkDetailActionSection } from "./link-detail-action-list";
import { LinkDetailBody } from "./link-detail-body";
import { LinkDetailHead } from "./link-detail-head";
import { DetailRow } from "./link-detail-parts";

import { Link, useRouter } from "expo-router";

function ReadOnlyLinkScreen({
  link,
  headerAction,
}: {
  link: PublicLinkDetail;
  headerAction?: React.ReactNode;
}) {
  const router = useRouter();
  const isWide = useWideView();
  const mode = isWide ? "panel" : "screen";
  const folderHref = `/folders/${link.folderId}` as const;
  const handleBack = () => (router.canGoBack() ? router.back() : router.replace(folderHref));

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        back
        className="md:hidden"
        onBack={handleBack}
        rightSlot={headerAction}
      />
      <View className="w-full flex-1 self-center md:w-[clamp(420px,34vw,560px)]">
        <LinkDetailBody mode={mode}>
          <LinkDetailHead
            mode={mode}
            title={link.title}
            url={link.url}
            readOnly
          />
          <DetailRow
            label="폴더"
            first
          >
            <Link
              href={folderHref}
              className="self-start text-sm font-medium text-foreground underline"
            >
              {[link.folderEmoji, link.folderName].filter(Boolean).join(" ")}
            </Link>
          </DetailRow>
          {link.todos.length > 0 ? (
            <LinkDetailActionSection>
              <LinkDetailActionList>
                {link.todos.map(({ title, isCompleted }, index) => (
                  <TodoItem
                    key={index}
                    variant="display"
                    text={title}
                    done={isCompleted}
                    readOnly
                  />
                ))}
              </LinkDetailActionList>
            </LinkDetailActionSection>
          ) : null}
        </LinkDetailBody>
      </View>
    </View>
  );
}

export { ReadOnlyLinkScreen };
