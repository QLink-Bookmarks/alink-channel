import * as React from "react";
import { TextInput } from "react-native";

import { cn } from "@/lib/utils";

import { type InputVariantProps, inputVariants } from "./input-variants";
import { useControlledValueMirror } from "./use-controlled-value-mirror";

function Input({
  className,
  variant,
  size,
  onBlur,
  onFocus,
  onChangeText,
  style,
  value,
  defaultValue,
  ref,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput> & InputVariantProps) {
  const isComposingRef = React.useRef(false);
  const { inputValue, inputDefaultValue, handleChangeText, commit } = useControlledValueMirror({
    value,
    defaultValue,
    onChangeText,
    isComposingRef,
  });

  const innerRef = React.useRef<TextInput | null>(null);
  const setRef = React.useCallback(
    (node: TextInput | null) => {
      innerRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<TextInput | null>).current = node;
      }
    },
    [ref],
  );

  React.useEffect(() => {
    const node = innerRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const handleStart = () => {
      isComposingRef.current = true;
    };
    const handleEnd = (event: Event) => {
      isComposingRef.current = false;
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (target) {
        commit(target.value);
      }
    };
    node.addEventListener("compositionstart", handleStart);
    node.addEventListener("compositionend", handleEnd);
    return () => {
      node.removeEventListener("compositionstart", handleStart);
      node.removeEventListener("compositionend", handleEnd);
    };
  }, [commit]);

  return (
    <TextInput
      ref={setRef}
      className={cn(
        inputVariants({ variant, size }),
        props.editable === false &&
          "opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
        "outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground md:text-sm",
        "focus-visible:outline-none focus-visible:ring-0",
        variant !== "inline" && "focus:border-ring",
        "aria-invalid:ring-destructive aria-invalid:border-destructive",
        className,
      )}
      onBlur={onBlur}
      onFocus={onFocus}
      onChangeText={handleChangeText}
      value={inputValue}
      defaultValue={inputDefaultValue}
      style={style}
      {...props}
    />
  );
}

export { Input };
