import { ActivityIndicator } from "@/components/ui/activity-indicator";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

// Three buttons sized to their words so they fit one row on a 320px wide screen; they may
// shrink, and their words stay on one line. `cn` does not see `min-w-button-default` as a
// min width, so `!` is what lifts it. `flex-initial` lets them shrink and replaces the button's
// `shrink-0` and, on native, the cancel button's `flex-1`.
const BUTTON_CLASS = "!min-w-0 flex-initial";

type UnsavedChangesDialogProps = {
  open: boolean;
  saving?: boolean;
  /** Closing it without a choice (`취소`, Esc) keeps the edits where they are. */
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onSave: () => void;
};

// Asked before unsaved edits are left: the 수정 window, the new link form and the
// detail's action editor.
function UnsavedChangesDialog({
  open,
  saving = false,
  onOpenChange,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      {/* The settings and feedback confirm dialogs hold 20rem too. Without it, the web card
          ends up 2rem narrower than its contents and the buttons get squeezed. */}
      <AlertDialogContent className="min-w-[20rem]">
        <AlertDialogHeader>
          <AlertDialogTitle>저장하지 않은 변경사항이 있어요</AlertDialogTitle>
          <AlertDialogDescription>변경사항을 저장할까요?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <AlertDialogCancel
            className={BUTTON_CLASS}
            disabled={saving}
          >
            <Text numberOfLines={1}>취소</Text>
          </AlertDialogCancel>
          <Button
            variant="outline"
            className={BUTTON_CLASS}
            disabled={saving}
            onPress={onDiscard}
          >
            <Text numberOfLines={1}>저장 안 함</Text>
          </Button>
          <Button
            className={BUTTON_CLASS}
            disabled={saving}
            onPress={onSave}
          >
            {saving ? <ActivityIndicator tone="onPrimary" /> : <Text numberOfLines={1}>저장</Text>}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { UnsavedChangesDialog };
