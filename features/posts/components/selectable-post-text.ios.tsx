import { TextInput } from "react-native";

import { cn } from "@/lib/utils";

import type { SelectablePostTextProps } from "./selectable-post-text";

function SelectablePostText({ children, className }: SelectablePostTextProps) {
  return (
    <TextInput
      value={children}
      editable={false}
      multiline
      scrollEnabled={false}
      className={cn("m-0 p-0 text-foreground", className)}
    />
  );
}

export { SelectablePostText };
