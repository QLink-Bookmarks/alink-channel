import * as React from "react";

import { IconButton } from "@/components/ui/icon-button";
import { isAdminRole } from "@/features/account/lib/roles";
import { useMyProfileQuery } from "@/features/account/queries";

import { AnnouncementEditor, type AnnouncementEditorMode } from "./announcement-editor";

import { Plus } from "lucide-react-native/icons";

function AnnouncementsHeaderAction({ mode }: { mode: AnnouncementEditorMode }) {
  const profileQuery = useMyProfileQuery();
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);

  // Only ADMIN / SUPER_ADMIN can post announcements.
  if (!isAdminRole(profileQuery.data?.role)) {
    return null;
  }

  return (
    <>
      <IconButton
        accessibilityLabel="공지사항 작성"
        hitSlop={4}
        icon={Plus}
        size="sm"
        variant="ghost"
        onPress={() => setIsEditorOpen(true)}
      />
      <AnnouncementEditor
        mode={mode}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
      />
    </>
  );
}

export { AnnouncementsHeaderAction };
