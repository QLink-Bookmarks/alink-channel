import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { closeImportFlow, useImportFlowStore } from "@/stores/import-flow";

function ImportFlowHost() {
  const isOpen = useImportFlowStore((state) => state.request != null);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeImportFlow();
        }
      }}
    >
      <AlertDialogContent className="min-w-[20rem]">
        <AlertDialogHeader>
          <AlertDialogTitle>북마크 가져오기는 웹에서 할 수 있어요</AlertDialogTitle>
          <AlertDialogDescription>
            PC의 웹 브라우저에서 ALink에 들어가 북마크 파일을 올려 주세요. 가져온 기록은 여기서도 볼
            수 있어요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onPress={closeImportFlow}>
            <Text>확인</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ImportFlowHost };
