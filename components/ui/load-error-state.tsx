import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";

type LoadErrorStateProps = {
  // What failed, e.g. "링크를 불러오지 못했어요".
  title: string;
  onRetry: () => void;
  // True while the retry runs; the button is disabled meanwhile.
  isRetrying?: boolean;
  className?: string;
};

/** A list that failed to load: ⚠️, the title, a network hint and a retry button, in the list's place. */
function LoadErrorState({ title, onRetry, isRetrying = false, className }: LoadErrorStateProps) {
  return (
    <EmptyState
      className={className}
      emoji="⚠️"
      title={title}
      description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
      actions={
        <Button
          disabled={isRetrying}
          variant="outline"
          onPress={onRetry}
        >
          <Text>다시 시도</Text>
        </Button>
      }
    />
  );
}

export { LoadErrorState };
export type { LoadErrorStateProps };
