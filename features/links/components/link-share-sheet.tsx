import * as React from "react";
import { View } from "react-native";

import { Sheet, SheetHeader } from "@/components/layout/sheet";

type LinkShareSheetProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onCloseFocus: () => void;
  onOpenChange: (open: boolean) => void;
};

function LinkShareSheetFocus({
  title,
  children,
  onCloseFocus,
  onOpenChange,
}: Omit<LinkShareSheetProps, "open">) {
  const body = React.useRef<View>(null);
  React.useEffect(() => {
    const start = body.current;
    if (!(start instanceof HTMLElement)) return;
    const scope = start.closest('[aria-label="Bottom Sheet"]')?.parentElement ?? start;
    const attributes = { role: "dialog", "aria-modal": "true", "aria-label": title };
    const previous = Object.keys(attributes).map(
      (name) => [name, scope.getAttribute(name)] as const,
    );
    Object.entries(attributes).forEach(([name, value]) => scope.setAttribute(name, value));
    start.focus();

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !scope.contains(event.target)) start.focus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      event.preventDefault();
      const stops = Array.from(
        scope.querySelectorAll<HTMLElement>('button, [tabindex="0"]'),
      ).filter(
        (element) =>
          !element.matches(':disabled, [aria-disabled="true"], [aria-label="Bottom Sheet"]') &&
          element.tabIndex >= 0 &&
          element.getClientRects().length > 0,
      );
      const index = stops.findIndex((element) => element === document.activeElement);
      const next = event.shiftKey
        ? index <= 0
          ? stops.length - 1
          : index - 1
        : (index + 1) % stops.length;
      (stops[next] ?? start).focus();
    };
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown, true);
      previous.forEach(([name, value]) =>
        value === null ? scope.removeAttribute(name) : scope.setAttribute(name, value),
      );
      onCloseFocus();
    };
  }, [onCloseFocus, onOpenChange, title]);

  return (
    <View
      ref={body}
      className="web:focus:outline-none"
      tabIndex={-1}
    >
      {children}
    </View>
  );
}

function LinkShareSheet({
  open,
  title,
  children,
  onCloseFocus,
  onOpenChange,
}: LinkShareSheetProps) {
  return (
    <Sheet
      fitContent
      fixedHeader
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetHeader title={title} />
      {open && process.env.EXPO_OS === "web" ? (
        <LinkShareSheetFocus
          title={title}
          onCloseFocus={onCloseFocus}
          onOpenChange={onOpenChange}
        >
          {children}
        </LinkShareSheetFocus>
      ) : (
        children
      )}
    </Sheet>
  );
}

export { LinkShareSheet };
export type { LinkShareSheetProps };
