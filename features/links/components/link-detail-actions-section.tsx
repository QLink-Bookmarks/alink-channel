import * as React from "react";
import { View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TodoDraftListEditor } from "@/features/todos/components/todo-draft-list-editor";
import { TodoErrorSummary } from "@/features/todos/components/todo-error-summary";
import { TodoItem } from "@/features/todos/components/todo-item/todo-item";
import { formatTodoSchedule } from "@/features/todos/lib/todo-schedule-label";
import { cn } from "@/lib/utils";
import { type LeaveGuard, requestLeave, useLeaveGuard } from "@/stores/leave-guard";

import { useLinkTodoEdit } from "../hooks/use-link-todo-edit";
import { getLinkTodoTitle, isLinkTodoDone } from "../lib/link-todo-save-plan";
import type { LinkTodo } from "../types";
import { DetailRow, DetailRowAddButton } from "./link-detail-parts";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

import { CircleAlert } from "lucide-react-native/icons";

const SAVE_FAILED_MESSAGE = "액션을 저장하지 못했어요. 잠시 후 다시 시도해주세요.";

type LinkDetailActionsSectionProps = {
  linkId: number;
  todos: LinkTodo[];
  mode: "panel" | "screen";
  /** Tells the detail when editing starts and ends, to turn the other commands off. */
  onEditingChange: (editing: boolean) => void;
};

function LinkTodoCard({
  todo,
  nowMs,
  onEdit,
  onToggleDone,
}: {
  todo: LinkTodo;
  nowMs: number;
  onEdit: (todoId: LinkTodo["id"]) => void;
  onToggleDone: (todoId: LinkTodo["id"], done: boolean) => void;
}) {
  const done = isLinkTodoDone(todo);
  const schedule = formatTodoSchedule({ ...todo, done }, nowMs);
  return (
    <TodoItem
      done={done}
      overdue={schedule.overdue}
      reminderLabel={schedule.label}
      scheduleKind={schedule.kind}
      text={getLinkTodoTitle(todo)}
      variant="display"
      onPress={() => onEdit(todo.id)}
      onToggle={(next) => onToggleDone(todo.id, next)}
    />
  );
}

function SaveFailedAlert() {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="flex-row items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5"
      testID="link-detail-todos-save-failed"
    >
      <Icon
        as={CircleAlert}
        className="size-4 shrink-0 text-destructive"
      />
      <Text className="min-w-0 flex-1 text-[13px] font-medium text-foreground">
        {SAVE_FAILED_MESSAGE}
      </Text>
    </View>
  );
}

// The 액션 row of `내 정리`. In view mode its cards open the editor right where they are;
// the checkbox only toggles done. In edit mode the same place holds the action editor
// with `취소`·`저장`.
function LinkDetailActionsSection({
  linkId,
  todos,
  mode,
  onEditingChange,
}: LinkDetailActionsSectionProps) {
  const edit = useLinkTodoEdit({ linkId, todos });
  const isEditing = edit.mode === "edit";
  const isWide = mode === "panel";

  React.useEffect(() => {
    onEditingChange(isEditing);
  }, [isEditing, onEditingChange]);

  React.useEffect(() => () => onEditingChange(false), [onEditingChange]);

  const { cancel, isDirty, isSaving, save } = edit;
  // The leave waiting on the unsaved changes dialog.
  const pendingLeaveRef = React.useRef<(() => void) | null>(null);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = React.useState(false);
  const leaveGuard = React.useMemo<LeaveGuard | null>(
    () =>
      // A save on its way is not held: it finishes even if the detail closes.
      isEditing && isDirty && !isSaving
        ? (leave) => {
            pendingLeaveRef.current = leave;
            setIsLeaveConfirmOpen(true);
          }
        : null,
    [isDirty, isEditing, isSaving],
  );
  useLeaveGuard(leaveGuard);

  // The dialog lives in the editor; a leave asked for it never outlives the editor.
  React.useEffect(() => {
    if (isEditing) return;
    pendingLeaveRef.current = null;
    setIsLeaveConfirmOpen(false);
  }, [isEditing]);

  const handleLeaveConfirmOpenChange = React.useCallback((open: boolean) => {
    setIsLeaveConfirmOpen(open);
    if (!open) pendingLeaveRef.current = null;
  }, []);
  const handleDiscardAndLeave = React.useCallback(() => {
    const leave = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setIsLeaveConfirmOpen(false);
    cancel();
    leave?.();
  }, [cancel]);
  const handleSaveAndLeave = React.useCallback(async () => {
    const leave = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setIsLeaveConfirmOpen(false);
    if (await save()) leave?.();
  }, [save]);

  // Web: Esc leaves the editor (asking first when something changed) before the panel
  // sees it; a dialog or popover opened from the editor takes its own Esc.
  React.useEffect(() => {
    if (!isEditing || process.env.EXPO_OS !== "web" || typeof document === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      requestLeave(cancel);
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [cancel, isEditing]);

  const leaveConfirm = (
    <UnsavedChangesDialog
      open={isLeaveConfirmOpen}
      onDiscard={handleDiscardAndLeave}
      onOpenChange={handleLeaveConfirmOpenChange}
      onSave={() => void handleSaveAndLeave()}
    />
  );

  if (!isEditing && todos.length === 0) {
    return (
      <DetailRow
        label="액션"
        testID="link-detail-todos"
      >
        <DetailRowAddButton
          accessibilityLabel="액션 추가"
          testID="link-detail-todos-add"
          onPress={edit.startAdd}
        />
      </DetailRow>
    );
  }

  const nowMs = Date.now();

  return (
    <View
      className="gap-1 border-t border-border-soft py-2.5"
      testID="link-detail-todos"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-xs font-semibold leading-8 text-muted-foreground">액션</Text>
        <DetailRowAddButton
          accessibilityLabel="액션 추가"
          align="end"
          disabled={edit.isSaving}
          testID="link-detail-todos-add"
          onPress={edit.startAdd}
        />
      </View>
      {isEditing ? (
        <View
          className="gap-3"
          testID="link-detail-todos-editor"
        >
          <TodoDraftListEditor
            check
            disabled={edit.isSaving}
            focusTodoId={edit.focusTodoId}
            host={isWide ? "surface" : "background"}
            openTodoId={edit.openTodoId}
            pickerMode={isWide ? "wide" : "mobile"}
            showAddButton={false}
            todos={edit.drafts}
            onChangeTodoDate={edit.handleChangeDate}
            onChangeTodoDone={edit.handleChangeDone}
            onChangeTodoMode={edit.handleChangeMode}
            onChangeTodoTime={edit.handleChangeTime}
            onChangeTodoTitle={edit.handleChangeTitle}
            onChangeTodoWeekdays={edit.handleChangeWeekdays}
            onOpenTodoChange={edit.setOpenTodoId}
            onRemoveTodo={edit.handleRemove}
          />
          {leaveConfirm}
          {edit.saveFailed ? <SaveFailedAlert /> : null}
          {isWide ? null : <TodoErrorSummary count={edit.errorCount} />}
          <View className="flex-row items-center gap-3 pt-1">
            {isWide ? (
              <TodoErrorSummary
                className="min-w-0 flex-1"
                count={edit.errorCount}
              />
            ) : null}
            <View className="ml-auto flex-row gap-2">
              <Button
                className={cn("min-w-[72px] rounded-xl", isWide ? "h-10" : "h-11")}
                disabled={edit.isSaving}
                testID="link-detail-todos-cancel"
                variant="outline"
                onPress={edit.cancel}
              >
                <Text>취소</Text>
              </Button>
              <Button
                accessibilityState={{ busy: edit.isSaving }}
                className={cn("min-w-[72px] rounded-xl", isWide ? "h-10" : "h-11")}
                disabled={edit.isSaving}
                testID="link-detail-todos-save"
                variant="gradient"
                onPress={() => void edit.save()}
              >
                {edit.isSaving ? (
                  <ActivityIndicator
                    accessibilityLabel="저장 중"
                    tone="onPrimary"
                  />
                ) : (
                  <Text>저장</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <View
          className="gap-2"
          testID="link-detail-todo-list"
        >
          {todos.map((todo) => (
            <LinkTodoCard
              key={todo.id}
              nowMs={nowMs}
              todo={todo}
              onEdit={edit.startEdit}
              onToggleDone={edit.toggleDone}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export { LinkDetailActionsSection };
