import type { PublicLinkDetail } from "../types";
import { LinkDetailActionList, LinkDetailActionSection } from "./link-detail-action-list";
import { LinkDetailContent } from "./link-detail-content";
import { LinkDetailFolderRow } from "./link-detail-notes-layout";
import { LinkDetailToolbarLayout } from "./link-detail-toolbar";

function PublicLinkContent({
  link,
  mode,
  headerAction,
  onBack,
}: {
  link: PublicLinkDetail;
  mode: "panel" | "screen";
  headerAction?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <LinkDetailContent
      head={{
        mode,
        title: link.title,
        url: link.url,
        thumbnailUrl: link.thumbnailUrl,
        faviconUrl: link.faviconUrl,
        isVideo: link.isVideo,
        readOnly: true,
      }}
      ai={{ excerpt: link.content?.excerpt }}
      toolbar={
        <LinkDetailToolbarLayout
          mode={mode}
          onClose={onBack}
        >
          {headerAction}
        </LinkDetailToolbarLayout>
      }
      onBack={onBack}
      notes={
        <>
          <LinkDetailFolderRow
            name={link.folderName}
            emoji={link.folderEmoji}
            href={`/folders/${link.folderId}`}
          />
          {link.todos.length > 0 ? (
            <LinkDetailActionSection>
              <LinkDetailActionList
                items={link.todos.map(({ title, isCompleted }, index) => ({
                  id: index,
                  text: title,
                  done: isCompleted,
                  readOnly: true,
                }))}
              />
            </LinkDetailActionSection>
          ) : null}
        </>
      }
    />
  );
}

export { PublicLinkContent };
