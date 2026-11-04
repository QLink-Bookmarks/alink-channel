import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { Minus, Plus } from "lucide-react-native";

function ChangeMark({ kind, className }: { kind: "add" | "remove"; className?: string }) {
  const isAdd = kind === "add";
  return (
    <View
      aria-hidden
      className={cn(
        "size-5 items-center justify-center rounded-md",
        isAdd ? "bg-success/15" : "bg-destructive/15",
        className,
      )}
    >
      <Icon
        as={isAdd ? Plus : Minus}
        size={13}
        strokeWidth={2.5}
        className={isAdd ? "text-success" : "text-destructive"}
      />
    </View>
  );
}

export { ChangeMark };
