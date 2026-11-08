import * as React from "react";
import { Pressable, type TextInput, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { formatTagLabel } from "@/features/links/lib/format-tag-label";
import { reportError } from "@/lib/error-reporting";
import { cn } from "@/lib/utils";

import {
  DetailRow,
  DetailRowAddButton,
  DetailRowEditButton,
  FOCUS_RING_CLASS_NAME,
} from "./link-detail-parts";

import { Check, X } from "lucide-react-native/icons";

type LinkFieldsUpdate = { memo?: string | null; tags?: string[] };

type LinkDetailMyNotesProps = {
  linkId: number;
  folderName?: string | null;
  folderEmoji?: string | null;
  tags: string[];
  memo?: string | null;
  /** While the 액션 row is being edited, the other rows cannot be opened. */
  isEditingActions: boolean;
  onOpenFolderMove: () => void;
  /** Saves the tags or the memo; rejects when the request fails. */
  onUpdateLink: (update: LinkFieldsUpdate) => Promise<void>;
  /** The 액션 row, which keeps its own edit state. */
  children: React.ReactNode;
};

function TagBadge({
  tag,
  pending,
  removable,
  onRemove,
}: {
  tag: string;
  pending: boolean;
  removable: boolean;
  onRemove: (tag: string) => void;
}) {
  return (
    <View className="relative">
      <Badge
        className="px-3 py-1"
        variant="tag"
      >
        {pending ? <ActivityIndicator size="small" /> : <Text>{formatTagLabel(tag)}</Text>}
      </Badge>
      {removable && !pending ? (
        <Pressable
          accessibilityLabel={`${formatTagLabel(tag)} 태그 삭제`}
          accessibilityRole="button"
          className={cn(
            "absolute -right-2 -top-2 size-5 items-center justify-center rounded-full bg-foreground",
            FOCUS_RING_CLASS_NAME,
          )}
          hitSlop={6}
          onPress={() => onRemove(tag)}
        >
          <Icon
            as={X}
            size={12}
            className="text-background"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function TagsRow({
  linkId,
  tags,
  disabled,
  onUpdateLink,
}: {
  linkId: number;
  tags: string[];
  disabled: boolean;
  onUpdateLink: LinkDetailMyNotesProps["onUpdateLink"];
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [pendingTag, setPendingTag] = React.useState<string | null>(null);
  const isPending = pendingTag != null;
  // Submit and blur can both fire for one entry; the refs make the second one a no-op.
  const draftRef = React.useRef("");
  const tagsRef = React.useRef(tags);
  // One tag change at a time: each one sends the whole list.
  const isBusyRef = React.useRef(false);

  React.useLayoutEffect(() => {
    tagsRef.current = tags;
  });

  const handleChangeDraft = React.useCallback((value: string) => {
    draftRef.current = value;
    setDraft(value);
  }, []);

  const handleAdd = React.useCallback(async () => {
    const nextTag = draftRef.current.trim();
    const currentTags = tagsRef.current;
    if (!nextTag || isBusyRef.current) return;
    draftRef.current = "";
    setDraft("");
    if (currentTags.includes(nextTag)) return;
    isBusyRef.current = true;
    setPendingTag(nextTag);
    try {
      await onUpdateLink({ tags: [...currentTags, nextTag] });
    } catch (error: unknown) {
      // Give the typed tag back so it can be sent again.
      handleChangeDraft(nextTag);
      reportError(error, { area: "link-detail-view:add-tag", extra: { linkId, tag: nextTag } });
    } finally {
      isBusyRef.current = false;
      setPendingTag(null);
    }
  }, [handleChangeDraft, linkId, onUpdateLink]);

  const handleRemove = React.useCallback(
    async (tagToRemove: string) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;
      setPendingTag(tagToRemove);
      try {
        await onUpdateLink({ tags: tagsRef.current.filter((tag) => tag !== tagToRemove) });
      } catch (error: unknown) {
        reportError(error, {
          area: "link-detail-view:remove-tag",
          extra: { linkId, tag: tagToRemove },
        });
      } finally {
        isBusyRef.current = false;
        setPendingTag(null);
      }
    },
    [linkId, onUpdateLink],
  );

  const isEmpty = tags.length === 0 && !isEditing && !isPending;

  return (
    <DetailRow
      label="태그"
      testID="link-detail-tags"
      trailing={
        isEmpty ? null : (
          <DetailRowEditButton
            disabled={!isEditing && disabled}
            icon={isEditing ? Check : undefined}
            label={isEditing ? "태그 편집 완료" : "태그 편집"}
            testID="link-detail-tags-edit"
            onPress={() => setIsEditing((current) => !current)}
          />
        )
      }
    >
      {isEmpty ? (
        <DetailRowAddButton
          accessibilityLabel="태그 추가"
          disabled={disabled}
          testID="link-detail-tags-add"
          onPress={() => setIsEditing(true)}
        />
      ) : (
        <View className="flex-row flex-wrap items-center gap-1.5 py-1">
          {tags.map((tag) => (
            <TagBadge
              key={tag}
              pending={pendingTag === tag}
              removable={isEditing && !isPending}
              tag={tag}
              onRemove={handleRemove}
            />
          ))}
          {pendingTag && !tags.includes(pendingTag) ? (
            <Badge
              className="px-3 py-1"
              variant="tag"
            >
              <ActivityIndicator size="small" />
            </Badge>
          ) : null}
          {isEditing ? (
            <View className="min-w-28 flex-row items-center gap-1 rounded-[10px] border border-border bg-card px-3">
              <Text className="text-xs font-medium text-muted-foreground">#</Text>
              <Input
                autoFocus
                accessibilityLabel="새 태그"
                className="h-7 min-w-16 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none dark:bg-transparent"
                editable={!isPending}
                placeholder="태그"
                returnKeyType="done"
                submitBehavior="submit"
                testID="link-detail-tag-input"
                value={draft}
                onBlur={() => void handleAdd()}
                onChangeText={handleChangeDraft}
                onSubmitEditing={() => void handleAdd()}
              />
            </View>
          ) : null}
        </View>
      )}
    </DetailRow>
  );
}

function MemoRow({
  linkId,
  memo,
  disabled,
  onUpdateLink,
}: {
  linkId: number;
  memo?: string | null;
  disabled: boolean;
  onUpdateLink: LinkDetailMyNotesProps["onUpdateLink"];
}) {
  const inputRef = React.useRef<TextInput>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(memo ?? "");
  const [isSaving, setIsSaving] = React.useState(false);
  const isSavingRef = React.useRef(false);

  React.useEffect(() => {
    if (!isEditing) setDraft(memo ?? "");
  }, [isEditing, memo]);

  React.useEffect(() => {
    if (!isEditing) return;
    const timeoutId = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeoutId);
  }, [isEditing]);

  const handleStart = React.useCallback(() => {
    setDraft(memo ?? "");
    setIsEditing(true);
  }, [memo]);

  const handleCancel = React.useCallback(() => {
    setDraft(memo ?? "");
    setIsEditing(false);
  }, [memo]);

  const handleSave = React.useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onUpdateLink({ memo: draft.trim() ? draft.trim() : null });
      setIsEditing(false);
    } catch (error: unknown) {
      reportError(error, { area: "link-detail-view:update-memo", extra: { linkId } });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [draft, linkId, onUpdateLink]);

  return (
    <DetailRow
      label="메모"
      testID="link-detail-memo"
      trailing={
        memo && !isEditing ? (
          <DetailRowEditButton
            disabled={disabled}
            label="메모 수정"
            testID="link-detail-memo-edit"
            onPress={handleStart}
          />
        ) : null
      }
    >
      {isEditing ? (
        <View className="gap-2 py-1">
          <Textarea
            ref={inputRef}
            accessibilityLabel="메모"
            className="min-h-24 rounded-xl border-border bg-card px-3 py-2.5 text-[13px] leading-5"
            editable={!isSaving}
            placeholder="메모를 입력해주세요"
            testID="link-detail-memo-input"
            value={draft}
            variant="memo"
            onChangeText={setDraft}
          />
          <View className="flex-row justify-end gap-2">
            <Button
              className="h-8 rounded-[10px] px-3"
              disabled={isSaving}
              size="sm"
              variant="outline"
              onPress={handleCancel}
            >
              <Text>취소</Text>
            </Button>
            <Button
              className="h-8 min-w-14 rounded-[10px] px-3"
              disabled={isSaving}
              size="sm"
              testID="link-detail-memo-save"
              onPress={() => void handleSave()}
            >
              {isSaving ? <ActivityIndicator tone="onPrimary" /> : <Text>저장</Text>}
            </Button>
          </View>
        </View>
      ) : memo ? (
        <Text
          selectable
          className="py-1.5 text-[13px] leading-5 text-foreground"
          testID="link-detail-memo-text"
        >
          {memo}
        </Text>
      ) : (
        <DetailRowAddButton
          accessibilityLabel="메모 추가"
          disabled={disabled}
          testID="link-detail-memo-add"
          onPress={handleStart}
        />
      )}
    </DetailRow>
  );
}

// What I attached to the link: folder, tags, memo and actions, one row each. A filled row
// has a pencil at its right, an empty one `+ 추가` in its value.
function LinkDetailMyNotes({
  linkId,
  folderName,
  folderEmoji,
  tags,
  memo,
  isEditingActions,
  onOpenFolderMove,
  onUpdateLink,
  children,
}: LinkDetailMyNotesProps) {
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
      <DetailRow
        first
        label="폴더"
        testID="link-detail-folder-row"
        trailing={
          <DetailRowEditButton
            disabled={isEditingActions}
            label="폴더 이동"
            testID="link-detail-folder-move"
            onPress={onOpenFolderMove}
          />
        }
      >
        {folderName ? (
          <Text
            className="text-[13px] font-semibold leading-5 text-foreground"
            numberOfLines={2}
            testID="link-detail-folder-name"
          >
            {`${folderEmoji ?? "📁"} ${folderName}`}
          </Text>
        ) : (
          <Text
            className="text-[13px] leading-5 text-muted-foreground"
            testID="link-detail-folder-name"
          >
            폴더 없음
          </Text>
        )}
      </DetailRow>
      <TagsRow
        disabled={isEditingActions}
        linkId={linkId}
        tags={tags}
        onUpdateLink={onUpdateLink}
      />
      <MemoRow
        disabled={isEditingActions}
        linkId={linkId}
        memo={memo}
        onUpdateLink={onUpdateLink}
      />
      {children}
    </View>
  );
}

export { LinkDetailMyNotes };
export type { LinkFieldsUpdate };
