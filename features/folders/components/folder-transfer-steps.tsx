import { View } from "react-native";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import type { FolderMember } from "../types";
import { FolderChoiceGroup } from "./folder-link-choice";

import { Users } from "lucide-react-native/icons";

function MemberAvatar({ member }: { member: FolderMember }) {
  return (
    <Avatar
      alt={member.userNickname}
      size="md"
    >
      {member.avatarUrl ? <AvatarImage source={{ uri: member.avatarUrl }} /> : null}
      <AvatarFallback>
        <Text className="text-lg">{member.avatarEmoji ?? "🙂"}</Text>
      </AvatarFallback>
    </Avatar>
  );
}

/** New owner picker: the folder's members without the owner, one choice. */
function FolderTransferMemberPicker({
  members,
  selectedUserId,
  onSelect,
}: {
  members: FolderMember[];
  selectedUserId: number | null;
  onSelect: (userId: number) => void;
}) {
  if (members.length === 0) {
    return (
      <View className="items-center gap-2 py-5">
        <Icon
          as={Users}
          className="size-6 text-muted-foreground"
        />
        <Text className="text-center text-sm text-muted-foreground">위임할 멤버가 없어요.</Text>
      </View>
    );
  }

  return (
    <FolderChoiceGroup<string>
      accessibilityLabel="새 소유자"
      options={members.map((member) => ({
        value: String(member.userId),
        title: member.userNickname,
        leading: <MemberAvatar member={member} />,
      }))}
      value={selectedUserId == null ? null : String(selectedUserId)}
      onValueChange={(value) => onSelect(Number(value))}
    />
  );
}

function getTransferConfirmTitle(nickname: string) {
  return `${nickname}님에게 위임할까요?`;
}

function getTransferConfirmDescription(nickname: string) {
  return `${nickname}님이 새 소유자가 되고 나는 이 폴더에서 나가요. 내가 넣은 링크는 폴더에 남아요.`;
}

function getTransferSuccessToast(nickname: string) {
  return `${nickname}님에게 위임하고 폴더에서 나왔어요.`;
}

export {
  FolderTransferMemberPicker,
  getTransferConfirmDescription,
  getTransferConfirmTitle,
  getTransferSuccessToast,
};
