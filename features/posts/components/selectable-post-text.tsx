import { Text } from "@/components/ui/text";

type SelectablePostTextProps = {
  children: string;
  className?: string;
};

function SelectablePostText({ children, className }: SelectablePostTextProps) {
  return (
    <Text
      selectable
      className={className}
    >
      {children}
    </Text>
  );
}

export { SelectablePostText };
export type { SelectablePostTextProps };
