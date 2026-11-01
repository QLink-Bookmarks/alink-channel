import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { uploadImage } from "@/features/images/api";
import type { ImageUploadInput } from "@/features/images/types";
import { getApiErrorMessage } from "@/features/posts/lib";
import { useCreatePostMutation } from "@/features/posts/mutations";
import { reportError } from "@/lib/error-reporting";
import { useToastStore } from "@/stores/toast-store";

import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native/icons";

type FeedbackEditorMode = "wide" | "mobile";

const TITLE_MAX_LENGTH = 100;
const CONTENTS_MAX_LENGTH = 2000;
const MAX_IMAGES = 10;

type FeedbackImage = {
  id: string;
  uri: string;
  status: "uploading" | "done" | "error";
  url?: string;
};

function FeedbackEditor({
  mode,
  open,
  onOpenChange,
}: {
  mode: FeedbackEditorMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [contents, setContents] = React.useState("");
  const [titleError, setTitleError] = React.useState<string | undefined>();
  const [contentsError, setContentsError] = React.useState<string | undefined>();
  const [images, setImages] = React.useState<FeedbackImage[]>([]);
  const [isDiscardGuardOpen, setIsDiscardGuardOpen] = React.useState(false);
  const [isSendConfirmOpen, setIsSendConfirmOpen] = React.useState(false);
  const imageIdRef = React.useRef(0);
  const mutation = useCreatePostMutation();
  const resetMutation = mutation.reset;
  const showToast = useToastStore((state) => state.showToast);

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setContents("");
      setTitleError(undefined);
      setContentsError(undefined);
      setImages([]);
      setIsDiscardGuardOpen(false);
      setIsSendConfirmOpen(false);
      resetMutation();
    }
  }, [open, resetMutation]);

  const isUploading = images.some((image) => image.status === "uploading");
  const isDirty = title.trim().length > 0 || contents.trim().length > 0 || images.length > 0;

  const handleRemoveImage = React.useCallback((id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
  }, []);

  const uploadPickedImage = React.useCallback(
    async (id: string, file: ImageUploadInput) => {
      try {
        const response = await uploadImage(file, "POST");
        const url = response.data.url;
        // Map (not append) so a tile the user already removed stays removed even
        // if its upload finishes afterwards.
        setImages((prev) =>
          prev.map((image) => (image.id === id ? { ...image, status: "done", url } : image)),
        );
      } catch (error) {
        reportError(error, { area: "feedback:image-upload" });
        setImages((prev) => prev.filter((image) => image.id !== id));
        showToast({
          title: "이미지 업로드에 실패했어요",
          variant: "error",
          sourceKey: "feedback-image-upload",
          dismissible: true,
          durationMs: 3000,
        });
      }
    },
    [showToast],
  );

  const handlePickImages = React.useCallback(async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled) {
      return;
    }

    const picked = result.assets.slice(0, remaining).map((asset) => {
      const id = String((imageIdRef.current += 1));
      const type = asset.mimeType ?? "image/jpeg";
      const name = asset.fileName ?? `feedback-${id}.${type.split("/")[1] ?? "jpg"}`;
      // Web exposes a real File on the asset; RN FormData needs the {uri,name,type}
      // descriptor. Sending the descriptor on web serializes to "[object Object]".
      const uploadInput: ImageUploadInput =
        process.env.EXPO_OS === "web" && asset.file ? asset.file : { uri: asset.uri, name, type };
      return { id, uri: asset.uri, uploadInput };
    });

    setImages((prev) => [
      ...prev,
      ...picked.map(({ id, uri }) => ({ id, uri, status: "uploading" as const })),
    ]);
    picked.forEach(({ id, uploadInput }) => {
      void uploadPickedImage(id, uploadInput);
    });
  }, [images.length, uploadPickedImage]);

  const handleRequestSend = React.useCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedContents = contents.trim();
    let hasError = false;
    if (!trimmedTitle) {
      setTitleError("제목을 입력해주세요.");
      hasError = true;
    }
    if (!trimmedContents) {
      setContentsError("내용을 입력해주세요.");
      hasError = true;
    }
    if (hasError) {
      return;
    }
    setIsSendConfirmOpen(true);
  }, [contents, title]);

  const handleSend = React.useCallback(async () => {
    const imageUrls = images
      .filter((image) => image.status === "done" && image.url)
      .map((image) => image.url as string);

    try {
      await mutation.mutateAsync({
        title: title.trim(),
        contents: contents.trim(),
        type: "FEEDBACK",
        imageUrls,
      });
      setIsSendConfirmOpen(false);
      onOpenChange(false);
      showToast({
        title: "소중한 의견 감사드려요",
        description: "빠른 시일 내로 검토하겠습니다.",
        variant: "success",
        sourceKey: "feedback-send",
        dismissible: true,
        durationMs: 4000,
      });
    } catch (error) {
      reportError(error, { area: "feedback:create" });
      setIsSendConfirmOpen(false);
      showToast({
        title: "피드백 전송에 실패했어요",
        description: getApiErrorMessage(error) ?? "잠시 후 다시 시도해주세요.",
        variant: "error",
        sourceKey: "feedback-send",
        dismissible: true,
        durationMs: 4000,
      });
    }
  }, [contents, images, mutation, onOpenChange, showToast, title]);

  const handleCancelPress = React.useCallback(() => {
    if (isDirty) {
      setIsDiscardGuardOpen(true);
      return;
    }
    onOpenChange(false);
  }, [isDirty, onOpenChange]);

  const body = (
    <View className="gap-4">
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-muted-foreground">제목</Text>
          <Text className="text-xs text-muted-foreground">
            {title.length}/{TITLE_MAX_LENGTH}
          </Text>
        </View>
        <Input
          className="h-10 rounded-xl px-4 text-base"
          maxLength={TITLE_MAX_LENGTH}
          placeholder="제목을 입력해주세요"
          value={title}
          onChangeText={(next) => {
            setTitle(next);
            if (titleError) {
              setTitleError(undefined);
            }
          }}
        />
        {titleError ? (
          <Text className="text-sm font-medium text-destructive">{titleError}</Text>
        ) : null}
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-muted-foreground">내용</Text>
          <Text className="text-xs text-muted-foreground">
            {contents.length}/{CONTENTS_MAX_LENGTH}
          </Text>
        </View>
        <Textarea
          className="min-h-32 resize-none rounded-xl bg-card px-4 py-3 text-base dark:bg-card"
          maxLength={CONTENTS_MAX_LENGTH}
          placeholder="자유롭게 의견을 남겨주세요"
          value={contents}
          onChangeText={(next) => {
            setContents(next);
            if (contentsError) {
              setContentsError(undefined);
            }
          }}
        />
        {contentsError ? (
          <Text className="text-sm font-medium text-destructive">{contentsError}</Text>
        ) : null}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">
          이미지 ({images.length}/{MAX_IMAGES})
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {images.map((image) => (
            <View
              key={image.id}
              className="relative size-20 overflow-hidden rounded-lg border border-border"
            >
              <Image
                source={{ uri: image.uri }}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
              {image.status === "uploading" ? (
                <View className="absolute inset-0 items-center justify-center bg-black/45">
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                </View>
              ) : null}
              <Pressable
                className="absolute right-1 top-1 size-5 items-center justify-center rounded-full bg-black/60"
                hitSlop={6}
                onPress={() => handleRemoveImage(image.id)}
              >
                <Icon
                  as={X}
                  size={12}
                  className="text-white"
                />
              </Pressable>
            </View>
          ))}
          {images.length < MAX_IMAGES ? (
            <Pressable
              className="size-20 items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border active:bg-accent web:hover:bg-accent"
              onPress={handlePickImages}
            >
              <Icon
                as={ImagePlus}
                size={22}
                className="text-muted-foreground"
              />
              <Text className="text-[10px] text-muted-foreground">이미지 첨부</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="flex-row justify-end gap-2">
        <Button
          className="h-10"
          disabled={mutation.isPending}
          variant="outline"
          onPress={handleCancelPress}
        >
          <Text>취소</Text>
        </Button>
        <Button
          className="h-10"
          disabled={mutation.isPending || isUploading}
          onPress={handleRequestSend}
        >
          <Text>확인</Text>
        </Button>
      </View>
    </View>
  );

  return (
    <>
      {mode === "wide" ? (
        <Dialog
          open={open}
          onOpenChange={onOpenChange}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>피드백 보내기</DialogTitle>
            </DialogHeader>
            <ScrollView
              className="max-h-[65vh]"
              showsVerticalScrollIndicator={false}
            >
              {body}
            </ScrollView>
          </DialogContent>
        </Dialog>
      ) : open ? (
        <Sheet
          open={open}
          fitContent
          onOpenChange={onOpenChange}
        >
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">피드백 보내기</Text>
            {body}
          </View>
        </Sheet>
      ) : null}

      <AlertDialog
        open={isDiscardGuardOpen}
        onOpenChange={setIsDiscardGuardOpen}
      >
        <AlertDialogContent className="min-w-[20rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>작성 중이던 피드백이 사라져요</AlertDialogTitle>
            <AlertDialogDescription>
              지금 닫으면 작성한 내용이 저장되지 않아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel>
              <Text>계속하기</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onPress={() => {
                setIsDiscardGuardOpen(false);
                onOpenChange(false);
              }}
            >
              <Text className="text-white">닫기</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isSendConfirmOpen}
        onOpenChange={setIsSendConfirmOpen}
      >
        <AlertDialogContent className="min-w-[20rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>피드백을 보내시겠어요?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel disabled={mutation.isPending}>
              <Text>취소</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onPress={handleSend}
            >
              <Text className="text-primary-foreground">
                {mutation.isPending ? "전송 중..." : "보내기"}
              </Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { FeedbackEditor };
export type { FeedbackEditorMode };
