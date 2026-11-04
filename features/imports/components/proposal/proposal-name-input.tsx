import * as React from "react";
import { type TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useWideView } from "@/lib/hooks/use-wide-view";
import { cn } from "@/lib/utils";

import { FOLDER_NAME_MAX, truncateUtf16 } from "../../lib/build-import-candidates";

import { Check, X } from "lucide-react-native/icons";

type NameHintTone = "muted" | "info" | "danger";

type NameHint = { text: string; tone: NameHintTone; isKeyboardOnly?: boolean };

const KEYBOARD_HINT: NameHint = {
  text: "Enter로 저장, Esc로 취소",
  tone: "muted",
  isKeyboardOnly: true,
};

type ProposalNameInputProps = {
  initialValue: string;
  accessibilityLabel: string;
  className?: string;
  inputClassName?: string;
  getHint: (value: string) => NameHint;
  onSubmit: (value: string) => boolean | void;
  onCancel: () => void;
};

const ACTION_BUTTON_CLASS = "h-11 w-11 rounded-xl sm:h-11 sm:w-11 md:h-9 md:w-9";

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
  const actionsRef = React.useRef<View | null>(null);
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
    const node = actionsRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== "function") {
      return;
    }
    const keepInputFocus = (event: MouseEvent) => event.preventDefault();
    node.addEventListener("mousedown", keepInputFocus);
    return () => node.removeEventListener("mousedown", keepInputFocus);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const isWide = useWideView();
  const hint = getHint(value);
  const isHintShown = !hint.isKeyboardOnly || (process.env.EXPO_OS === "web" && isWide);

  return (
    <View
      className={cn("gap-1", className)}
      testID="import-name-input"
    >
      <View className="flex-row items-center gap-1">
        <Input
          ref={inputRef}
          accessibilityLabel={accessibilityLabel}
          className={cn(
            "h-10 min-w-0 flex-1 rounded-xl px-3 text-base font-semibold",
            inputClassName,
          )}
          returnKeyType="done"
          value={value}
          onBlur={() => finish("submit")}
          onChangeText={handleChangeText}
          onSubmitEditing={() => finish("submit")}
        />
        <View
          ref={actionsRef}
          className="flex-row items-center"
        >
          <Button
            accessibilityLabel="이름 확정"
            className={ACTION_BUTTON_CLASS}
            size="icon"
            variant="ghost"
            onPress={() => finish("submit")}
          >
            <Icon
              as={Check}
              className="size-5 text-primary"
            />
          </Button>
          <Button
            accessibilityLabel="취소"
            className={ACTION_BUTTON_CLASS}
            size="icon"
            variant="ghost"
            onPress={() => finish("cancel")}
          >
            <Icon
              as={X}
              className="size-5 text-muted-foreground"
            />
          </Button>
        </View>
      </View>
      <View className="flex-row items-start justify-between gap-3">
        <Text
          accessibilityLiveRegion="polite"
          className={cn("min-w-0 flex-1 text-xs", HINT_TONE_CLASS[hint.tone])}
        >
          {isHintShown ? hint.text : null}
        </Text>
        <Text className="text-xs tabular-nums text-muted-foreground">
          {value.length}/{FOLDER_NAME_MAX}
        </Text>
      </View>
    </View>
  );
}

export { KEYBOARD_HINT, ProposalNameInput };
export type { NameHint, NameHintTone };
