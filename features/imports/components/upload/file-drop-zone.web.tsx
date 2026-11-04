import * as React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { FileText, Upload } from "lucide-react-native/icons";

type FileDropZoneProps = {
  canDrop: boolean;
  onFile: (file: File) => void;
};

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function useWindowFileDropGuard(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const handleOver = (event: DragEvent) => {
      if (!hasFiles(event) || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "none";
      }
    };
    const handleDrop = (event: DragEvent) => {
      if (hasFiles(event) && !event.defaultPrevented) {
        event.preventDefault();
      }
    };
    window.addEventListener("dragover", handleOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [enabled]);
}

function FileDropZone({ canDrop, onFile }: FileDropZoneProps) {
  const zoneRef = React.useRef<View>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const depthRef = React.useRef(0);
  const [isOver, setIsOver] = React.useState(false);
  const onFileRef = React.useRef(onFile);
  onFileRef.current = onFile;

  React.useEffect(() => {
    const node = zoneRef.current as unknown as HTMLElement | null;
    if (!node || !canDrop) {
      return;
    }
    const handleEnter = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      depthRef.current += 1;
      setIsOver(true);
    };
    const handleOver = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };
    const handleLeave = () => {
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setIsOver(false);
      }
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      depthRef.current = 0;
      setIsOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        onFileRef.current(file);
      }
    };
    node.addEventListener("dragenter", handleEnter);
    node.addEventListener("dragover", handleOver);
    node.addEventListener("dragleave", handleLeave);
    node.addEventListener("drop", handleDrop);
    return () => {
      node.removeEventListener("dragenter", handleEnter);
      node.removeEventListener("dragover", handleOver);
      node.removeEventListener("dragleave", handleLeave);
      node.removeEventListener("drop", handleDrop);
    };
  }, [canDrop]);

  const handlePick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onFileRef.current(file);
    }
  }, []);

  return (
    <View
      ref={zoneRef}
      testID="import-drop-zone"
      className={cn(
        "items-center gap-1.5 rounded-2xl border border-dashed px-5 py-7 web:transition-colors web:motion-reduce:transition-none",
        isOver ? "border-primary bg-accent" : "border-border",
      )}
    >
      <View className="mb-2 size-11 items-center justify-center rounded-xl bg-muted">
        <Icon
          as={Upload}
          className="size-5 text-muted-foreground"
        />
      </View>
      {isOver ? (
        <Text className="text-center text-sm font-semibold text-foreground">
          여기에 놓으면 미리보기를 만들어요
        </Text>
      ) : (
        <>
          <Text className="text-center text-sm font-semibold text-foreground">
            {canDrop
              ? "파일을 끌어다 놓거나 북마크 파일을 선택해 주세요"
              : "북마크 파일을 선택해 주세요"}
          </Text>
          <Text className="text-xs text-muted-foreground">.html · .htm · 10MB 이하</Text>
          <Button
            className="mt-2 h-9 flex-row gap-1.5 self-center rounded-lg px-3.5"
            size="sm"
            variant="outline"
            onPress={handlePick}
          >
            <Icon
              as={FileText}
              className="size-4 text-foreground"
            />
            <Text className="text-sm font-semibold">파일 선택</Text>
          </Button>
        </>
      )}
      <input
        ref={inputRef}
        aria-label="북마크 파일"
        type="file"
        accept=".html,.htm,text/html"
        data-testid="import-file-input"
        style={{ display: "none" }}
        onChange={handleChange}
      />
    </View>
  );
}

export { FileDropZone, useWindowFileDropGuard };
