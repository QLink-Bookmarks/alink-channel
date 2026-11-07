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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>저장하지 않은 변경사항이 있어요</AlertDialogTitle>
          <AlertDialogDescription>변경사항을 저장할까요?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <AlertDialogCancel
            className="flex-none"
            disabled={saving}
          >
            <Text>취소</Text>
          </AlertDialogCancel>
          <Button
            variant="outline"
            disabled={saving}
            onPress={onDiscard}
          >
            <Text>저장 안 함</Text>
          </Button>
          <Button
            disabled={saving}
            onPress={onSave}
          >
            {saving ? <ActivityIndicator tone="onPrimary" /> : <Text>저장</Text>}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { UnsavedChangesDialog };
