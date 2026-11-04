import * as React from "react";
import { type TextInput, View } from "react-native";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { FOLDER_NAME_MAX, truncateUtf16 } from "../../lib/build-import-candidates";

type NameHintTone = "muted" | "info" | "danger";

type NameHint = { text: string; tone: NameHintTone };

type ProposalNameInputProps = {
  initialValue: string;
  accessibilityLabel: string;
  className?: string;
  inputClassName?: string;
  getHint: (value: string) => NameHint;
  onSubmit: (value: string) => boolean | void;
  onCancel: () => void;
};

const HINT_TONE_CLASS: Record<NameHintTone, string> = {
  muted: "text-muted-foreground",
  info: "font-semibold text-foreground",
  danger: "font-semibold text-destructive",
};

function readNodeValue(node: unknown, fallback: string) {
  const element = node as HTMLInputElement | null;
  return typeof element?.value === "string" ? element.value : fallback;
}

function ProposalNameInput({
  initialValue,
  accessibilityLabel,
  className,
  inputClassName,
  getHint,
  onSubmit,
  onCancel,
}: ProposalNameInputProps) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<TextInput | null>(null);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const doneRef = React.useRef(false);
  const handlersRef = React.useRef({ onSubmit, onCancel });
  handlersRef.current = { onSubmit, onCancel };

  const finish = React.useCallback((kind: "submit" | "cancel") => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    if (kind === "cancel") {
      handlersRef.current.onCancel();
      return;
    }
    const submitted = truncateUtf16(
      readNodeValue(inputRef.current, valueRef.current),
      FOLDER_NAME_MAX,
    );
    const isDone = handlersRef.current.onSubmit(submitted);
    if (isDone === false) {
      doneRef.current = false;
    }
  }, []);

  const handleChangeText = React.useCallback((text: string) => {
    setValue(truncateUtf16(text, FOLDER_NAME_MAX));
  }, []);

  React.useEffect(() => {
    const node = inputRef.current as unknown as HTMLElement | null;
    if (!node || typeof window === "undefined" || typeof node.addEventListener !== "function") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== node) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish("cancel");
        return;
      }
      if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        event.stopPropagation();
        finish("submit");
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [finish]);

  React.useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const hint = getHint(value);

  return (
    <View className={cn("gap-1", className)}>
      <Input
        ref={inputRef}
        accessibilityLabel={accessibilityLabel}
        className={cn("h-10 rounded-xl px-3 text-base font-semibold", inputClassName)}
        returnKeyType="done"
        value={value}
        onBlur={() => finish("submit")}
        onChangeText={handleChangeText}
        onSubmitEditing={() => finish("submit")}
      />
      <View className="flex-row items-start justify-between gap-3">
        <Text
          accessibilityLiveRegion="polite"
          className={cn("min-w-0 flex-1 text-xs", HINT_TONE_CLASS[hint.tone])}
        >
          {hint.text}
        </Text>
        <Text className="text-xs tabular-nums text-muted-foreground">
          {value.length}/{FOLDER_NAME_MAX}
        </Text>
      </View>
    </View>
  );
}

export { ProposalNameInput };
export type { NameHint, NameHintTone };
