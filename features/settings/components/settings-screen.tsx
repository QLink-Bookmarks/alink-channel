import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { Sheet } from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
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
import { AppStoreBadge } from "@/components/ui/app-store-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Emoji } from "@/components/ui/emoji";
import { EmojiPickerGrid } from "@/components/ui/emoji-picker-grid";
import { Icon } from "@/components/ui/icon";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { isAdminRole } from "@/features/account/lib/roles";
import {
  useDeleteMyAccountMutation,
  useUpdateMyProfileMutation,
} from "@/features/account/mutations";
import {
  accountQueryKeys,
  useMyProfileQuery,
  useMySettingsQuery,
} from "@/features/account/queries";
import type { ConnectedAuthProvider } from "@/features/account/types";
import {
  AiProviderPickerList,
  type AiProviderSelection,
  getProviderLabel,
} from "@/features/ai/components/ai-provider-picker-list";
import { resolveProviderRequest } from "@/features/ai/lib/resolve-provider-request";
import { useAiProviderCatalogQuery, useMyAiProvidersQuery } from "@/features/ai/queries";
import { signOut as signOutApi } from "@/features/auth/api";
import { ConnectedProvidersRow } from "@/features/auth/components/connect-providers";
import { logoutNaver } from "@/features/auth/lib/native-naver-logout";
import { FeedbackEditor } from "@/features/feedback/components/feedback-editor";
import { useUploadImageMutation } from "@/features/images/mutations";
import type { ImageUploadInput } from "@/features/images/types";
import { DeviceNotificationNotice } from "@/features/notifications/components/device-notification-notice";
import { unregisterDevice } from "@/features/notifications/lib/unregister-device";
import { reportError } from "@/lib/error-reporting";
import { useAuthStore } from "@/stores/auth";
import { useDisplaySettings } from "@/stores/display-settings";
import { useToastStore } from "@/stores/toast-store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSettingsAutosave } from "../hooks/use-settings-autosave";

import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import {
  Camera,
  ChevronRight,
  Info,
  Megaphone,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRoundX,
  X,
} from "lucide-react-native/icons";

type SettingsScreenMode = "wide" | "mobile";

function SettingsScreen({ mode }: { mode: SettingsScreenMode }) {
  const profileQuery = useMyProfileQuery();
  const settingsQuery = useMySettingsQuery();
  const profile = profileQuery.data;
  const settings = settingsQuery.data;

  // Hydrate the local store the moment settings come back.
  const hydrateFromServer = useDisplaySettings((state) => state.hydrateFromServer);
  const hasHydrated = useDisplaySettings((state) => state.hasHydratedFromServer);
  React.useEffect(() => {
    if (settings && !hasHydrated) {
      hydrateFromServer(settings);
    }
  }, [settings, hasHydrated, hydrateFromServer]);

  const isLoading = profileQuery.isLoading || settingsQuery.isLoading;

  const body = (
    <View className="mx-auto w-full gap-4 px-4 pb-12 pt-4 md:max-w-3xl md:px-6 md:pb-20 md:pt-0">
      {mode === "wide" ? (
        <PageHeader
          className="px-0"
          title="설정"
          icon={Settings}
          meta="프로필, AI 제공자, 알림 설정을 관리해요."
        />
      ) : null}

      {isLoading ? (
        <ActivityIndicator
          size="large"
          className="py-16"
        />
      ) : (
        <View className="gap-4">
          <ProfileSection
            mode={mode}
            nickname={profile?.nickname ?? "사용자"}
            username={profile?.username ?? ""}
            avatarUrl={profile?.avatarUrl ?? null}
            avatarFromApi={profile?.avatarEmoji ?? null}
            connectedProviders={settings?.providers ?? []}
          />

          {mode === "mobile" ? <DisplaySection /> : null}

          <AiProviderSection mode={mode} />

          <BehaviorSection />

          <AppInfoSection mode={mode} />
        </View>
      )}
    </View>
  );

  if (mode === "wide") {
    return (
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>
    );
  }

  // Mobile: own ScrollView so the shell's AppHeader/BottomTabs are not displaced
  // and the content scrolls correctly behind the tab bar.
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  );
}

// Section title sits outside the card as a quiet group label (iOS grouped-list
// style). The card holds borderless rows separated by spacing only — no inner
// boxes, no dividers.
function SettingsSectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="px-2 text-sm font-semibold text-muted-foreground">{title}</Text>
      <Card
        density="compact"
        className="px-5"
      >
        {children}
      </Card>
    </View>
  );
}

function ProfileSection({
  mode,
  nickname,
  username,
  avatarUrl,
  avatarFromApi,
  connectedProviders,
}: {
  mode: SettingsScreenMode;
  nickname: string;
  username: string;
  avatarUrl: string | null;
  avatarFromApi: string | null;
  connectedProviders: ConnectedAuthProvider[];
}) {
  const avatarOverride = useDisplaySettings((state) => state.profile.avatarEmoji);
  const setAvatarEmoji = useDisplaySettings((state) => state.setAvatarEmoji);
  const avatar = avatarOverride ?? avatarFromApi ?? "🌸";
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [logoutOpen, setLogoutOpen] = React.useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();
  const signOutStore = useAuthStore((state) => state.signOut);
  const showToast = useToastStore((state) => state.showToast);
  const signOutMutation = useMutation({
    mutationFn: () => signOutApi({ refreshToken: useAuthStore.getState().refreshToken }),
  });
  const handleConfirmLogout = React.useCallback(async () => {
    // Capture the auth token before sign-out clears it, then detach this device
    // from the account (best-effort, fire-and-forget).
    const authToken = useAuthStore.getState().accessToken;
    if (authToken) {
      void unregisterDevice(authToken);
    }
    try {
      await signOutMutation.mutateAsync();
    } catch (error) {
      reportError(error, { area: "settings:sign-out" });
    } finally {
      signOutStore();
      queryClient.clear();
      setAvatarEmoji(null);
      setLogoutOpen(false);
      router.replace("/" as Href);
      // Background cleanup — must never block or revert the sign-out above.
      void logoutNaver(connectedProviders);
      showToast({
        title: "로그아웃 되었어요",
        variant: "success",
        sourceKey: "settings-logout",
        dismissible: true,
      });
    }
  }, [
    connectedProviders,
    queryClient,
    router,
    setAvatarEmoji,
    showToast,
    signOutMutation,
    signOutStore,
  ]);

  return (
    <>
      <SettingsSectionCard title="프로필">
        <View className="flex-row items-center gap-4">
          <Pressable
            className="min-w-0 flex-1 flex-row items-center gap-4 rounded-xl px-2 py-2 active:bg-accent web:hover:bg-accent"
            onPress={() => setProfileOpen(true)}
          >
            <Avatar
              alt={`${nickname} avatar`}
              size="lg"
            >
              {avatarUrl ? <AvatarImage source={{ uri: avatarUrl }} /> : null}
              <AvatarFallback>
                <Emoji className="text-2xl">{avatar}</Emoji>
              </AvatarFallback>
            </Avatar>
            <View className="min-w-0 flex-1">
              <Text
                numberOfLines={1}
                className="text-base font-semibold text-foreground"
              >
                {nickname}
              </Text>
              <Text
                numberOfLines={1}
                className="text-sm text-muted-foreground"
              >
                {username}
              </Text>
            </View>
          </Pressable>
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            onPress={() => setLogoutOpen(true)}
          >
            <Text>로그아웃</Text>
          </Button>
        </View>
        <ConnectedProvidersRow
          mode={mode}
          connectedProviders={connectedProviders}
        />
      </SettingsSectionCard>

      <ProfileEditOverlay
        mode={mode}
        open={profileOpen}
        avatarEmoji={avatar}
        avatarUrl={avatarUrl}
        nickname={nickname}
        username={username}
        onOpenChange={setProfileOpen}
        onSaved={(nextAvatarEmoji) => {
          setAvatarEmoji(nextAvatarEmoji);
          setProfileOpen(false);
        }}
      />

      <AlertDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
      >
        <AlertDialogContent className="min-w-[20rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>로그아웃 할까요?</AlertDialogTitle>
            <AlertDialogDescription>로그아웃하면 다시 로그인해야 해요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel disabled={signOutMutation.isPending}>
              <Text>취소</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={signOutMutation.isPending}
              onPress={handleConfirmLogout}
            >
              <Text>로그아웃</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProfileEditOverlay({
  mode,
  open,
  avatarEmoji,
  avatarUrl,
  username,
  nickname,
  onOpenChange,
  onSaved,
}: {
  mode: SettingsScreenMode;
  open: boolean;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  username: string;
  nickname: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (avatarEmoji: string | null) => void;
}) {
  const [draftAvatarEmoji, setDraftAvatarEmoji] = React.useState<string | null>(avatarEmoji);
  const [draftUsername, setDraftUsername] = React.useState(username);
  const [draftNickname, setDraftNickname] = React.useState(nickname);
  const [draftAvatarUploadedUrl, setDraftAvatarUploadedUrl] = React.useState<string | null>(null);
  const [isAvatarCleared, setIsAvatarCleared] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | undefined>();
  const queryClient = useQueryClient();
  const mutation = useUpdateMyProfileMutation();
  const resetMutation = mutation.reset;
  const uploadImageMutation = useUploadImageMutation();
  const resetUploadMutation = uploadImageMutation.reset;
  const showToast = useToastStore((state) => state.showToast);

  React.useEffect(() => {
    if (open) {
      setDraftAvatarEmoji(avatarEmoji);
      setDraftUsername(username);
      setDraftNickname(nickname);
      setDraftAvatarUploadedUrl(null);
      setIsAvatarCleared(false);
      setValidationError(undefined);
      resetMutation();
      resetUploadMutation();
    }
  }, [avatarEmoji, nickname, open, resetMutation, resetUploadMutation, username]);

  const handleUsernameChange = React.useCallback((next: string) => {
    setDraftUsername(next);
    setValidationError(undefined);
  }, []);
  const handleNicknameChange = React.useCallback((next: string) => {
    setDraftNickname(next);
    setValidationError(undefined);
  }, []);

  const handleAvatarPicked = React.useCallback(
    async (file: ImageUploadInput) => {
      try {
        const response = await uploadImageMutation.mutateAsync({ file, purpose: "PROFILE" });
        const uploadedUrl = response.data?.url;
        if (uploadedUrl) {
          setDraftAvatarUploadedUrl(uploadedUrl);
          setIsAvatarCleared(false);
          setDraftAvatarEmoji(null);
        }
      } catch {
        showToast({
          description: "이미지 업로드에 실패했어요. 잠시 후 다시 시도해주세요.",
          dismissible: true,
          durationMs: 3000,
          sourceKey: "settings-profile-avatar",
          title: "업로드 실패",
          variant: "warning",
        });
      }
    },
    [showToast, uploadImageMutation],
  );

  const handleAvatarPress = React.useCallback(() => {
    const target = isAvatarCleared ? null : (draftAvatarUploadedUrl ?? avatarUrl);
    if (!target) {
      return;
    }
    void Linking.openURL(target);
  }, [avatarUrl, draftAvatarUploadedUrl, isAvatarCleared]);

  const handleClearAvatar = React.useCallback(() => {
    setDraftAvatarUploadedUrl(null);
    setIsAvatarCleared(true);
  }, []);

  const handleEmojiChange = React.useCallback((next: string | null) => {
    setDraftAvatarEmoji(next);
    if (next) {
      setDraftAvatarUploadedUrl(null);
      setIsAvatarCleared(true);
    }
  }, []);

  const handleClearEmoji = React.useCallback(() => {
    setDraftAvatarEmoji(null);
  }, []);

  const handleSave = React.useCallback(async () => {
    const trimmedUsername = draftUsername.trim();
    const trimmedNickname = draftNickname.trim();
    if (!trimmedUsername || !trimmedNickname) {
      setValidationError("아이디와 닉네임을 모두 입력해주세요.");
      return;
    }

    try {
      const response = await mutation.mutateAsync({
        avatarEmoji: draftAvatarEmoji,
        nickname: trimmedNickname,
        username: trimmedUsername,
        avatarUrl: isAvatarCleared ? null : (draftAvatarUploadedUrl ?? avatarUrl),
      });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.myProfile() });
      onSaved(response.data?.avatarEmoji ?? draftAvatarEmoji);
      showToast({
        description: "프로필 정보가 업데이트되었어요.",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "settings-profile",
        title: "수정 완료",
        variant: "success",
      });
    } catch {
      showToast({
        description: "프로필 수정에 실패했어요. 잠시 후 다시 시도해주세요.",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "settings-profile",
        title: "수정 실패",
        variant: "warning",
      });
    }
  }, [
    avatarUrl,
    draftAvatarEmoji,
    draftAvatarUploadedUrl,
    draftNickname,
    draftUsername,
    isAvatarCleared,
    mutation,
    onSaved,
    queryClient,
    showToast,
  ]);

  const displayAvatarUrl = isAvatarCleared ? null : (draftAvatarUploadedUrl ?? avatarUrl);

  const renderBody = (pickerMaxHeight: number, pickerFixedHeight: boolean) => (
    <View className="gap-4">
      <View className="items-center">
        <View className="relative">
          <Pressable
            accessibilityRole="button"
            disabled={!displayAvatarUrl || uploadImageMutation.isPending}
            onPress={handleAvatarPress}
          >
            <Avatar
              alt={`${draftNickname || nickname} avatar`}
              size="xl"
            >
              {displayAvatarUrl ? <AvatarImage source={{ uri: displayAvatarUrl }} /> : null}
              <AvatarFallback>
                <Emoji className="text-3xl">
                  {uploadImageMutation.isPending ? "⏳" : (draftAvatarEmoji ?? "🌸")}
                </Emoji>
              </AvatarFallback>
            </Avatar>
          </Pressable>
          {uploadImageMutation.isPending ? (
            <View className="pointer-events-none absolute inset-0 items-center justify-center rounded-full bg-black/40">
              <ActivityIndicator size="small" />
            </View>
          ) : null}
          {displayAvatarUrl && !uploadImageMutation.isPending ? (
            <Pressable
              accessibilityLabel="아바타 초기화"
              className="absolute -left-2 -top-2 size-7 items-center justify-center rounded-full border border-border bg-background shadow-sm active:bg-accent web:hover:bg-accent"
              hitSlop={8}
              onPress={handleClearAvatar}
            >
              <Icon
                as={X}
                size={14}
                className="text-foreground"
              />
            </Pressable>
          ) : null}
          {!displayAvatarUrl && !uploadImageMutation.isPending && draftAvatarEmoji ? (
            <Pressable
              accessibilityLabel="이모지 제거"
              className="absolute -left-2 -top-2 size-7 items-center justify-center rounded-full border border-border bg-background shadow-sm active:bg-accent web:hover:bg-accent"
              hitSlop={8}
              onPress={handleClearEmoji}
            >
              <Icon
                as={X}
                size={14}
                className="text-foreground"
              />
            </Pressable>
          ) : null}
          <ImageUploader
            className="absolute -bottom-2 -right-2 size-9 items-center justify-center rounded-full border border-border bg-background shadow-sm active:bg-accent web:hover:bg-accent"
            hitSlop={8}
            onImagePicked={handleAvatarPicked}
          >
            <Icon
              as={Camera}
              size={16}
              className="text-foreground"
            />
          </ImageUploader>
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">아이디</Text>
        <Input
          className="h-10 rounded-xl px-4 text-base"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="아이디"
          value={draftUsername}
          onChangeText={handleUsernameChange}
        />
        <Text className="text-xs text-muted-foreground">공유 프로필과 계정 식별에 사용돼요.</Text>
      </View>
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">닉네임</Text>
        <Input
          className="h-10 rounded-xl px-4 text-base"
          placeholder="닉네임"
          value={draftNickname}
          onChangeText={handleNicknameChange}
        />
        <Text className="text-xs text-muted-foreground">앱 안에서 표시되는 이름이에요.</Text>
      </View>
      {validationError ? (
        <Text className="text-sm font-medium text-destructive">{validationError}</Text>
      ) : null}
      <EmojiPickerGrid
        value={draftAvatarEmoji}
        onChange={handleEmojiChange}
        maxHeight={pickerMaxHeight}
        fixedHeight={pickerFixedHeight}
      />
      <View className="flex-row justify-end gap-2">
        <Button
          variant="outline"
          onPress={() => onOpenChange(false)}
        >
          <Text>취소</Text>
        </Button>
        <Button
          disabled={mutation.isPending}
          onPress={handleSave}
        >
          {mutation.isPending ? <ActivityIndicator size="small" /> : null}
          <Text>수정하기</Text>
        </Button>
      </View>
    </View>
  );

  if (mode === "wide") {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <DialogContent className="scrollbar-none max-h-[80vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>프로필 수정</DialogTitle>
            <DialogDescription>아이디, 닉네임, 대표 이모지를 수정해요.</DialogDescription>
          </DialogHeader>
          {renderBody(452, true)}
        </DialogContent>
      </Dialog>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <Sheet
      open={open}
      fitContent
      maxDynamicContentSize={560}
      onOpenChange={onOpenChange}
    >
      <Text className="text-lg font-semibold text-foreground">프로필 수정</Text>
      {renderBody(220, false)}
    </Sheet>
  );
}

function DisplaySection() {
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const setAccent = useDisplaySettings((state) => state.setAccent);
  const setTheme = useDisplaySettings((state) => state.setTheme);

  return (
    <SettingsSectionCard title="화면 표시">
      <ThemeSwitcher
        accent={accent}
        mode={theme}
        variant="switch"
        className="border-0 bg-transparent p-0"
        onAccentChange={setAccent}
        onModeChange={setTheme}
      />
    </SettingsSectionCard>
  );
}

function BehaviorSection() {
  const allowsReminder = useDisplaySettings((state) => state.behavior.allowsReminderNotification);
  const setAllowsReminder = useDisplaySettings((state) => state.setAllowsReminderNotification);

  return (
    <SettingsSectionCard title="알림">
      <DeviceNotificationNotice />
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-sm font-semibold text-foreground">리마인더 알림</Text>
          <Text className="text-xs text-muted-foreground">할 일이 다가오면 알림을 보내요.</Text>
        </View>
        <Switch
          checked={allowsReminder}
          onCheckedChange={setAllowsReminder}
        />
      </View>
    </SettingsSectionCard>
  );
}

function AppInfoSection({ mode }: { mode: SettingsScreenMode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOutStore = useAuthStore((state) => state.signOut);
  const setAvatarEmoji = useDisplaySettings((state) => state.setAvatarEmoji);
  const showToast = useToastStore((state) => state.showToast);
  const settingsQuery = useMySettingsQuery();
  const connectedProviders = React.useMemo(
    () => settingsQuery.data?.providers ?? [],
    [settingsQuery.data?.providers],
  );
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const profileQuery = useMyProfileQuery();
  const isAdmin = isAdminRole(profileQuery.data?.role);
  const deleteAccountMutation = useDeleteMyAccountMutation();

  const appVersion = Constants.expoConfig?.version ?? "—";

  const handleConfirmWithdraw = React.useCallback(async () => {
    // Detach this device while still authenticated, before the account is gone.
    const authToken = useAuthStore.getState().accessToken;
    if (authToken) {
      void unregisterDevice(authToken);
    }
    try {
      await deleteAccountMutation.mutateAsync();
      signOutStore();
      queryClient.clear();
      setAvatarEmoji(null);
      setWithdrawOpen(false);
      router.replace("/" as Href);
      // Background cleanup — the account is already gone; don't block the UI on it.
      void logoutNaver(connectedProviders);
      showToast({
        title: "회원 탈퇴가 완료됐어요",
        variant: "success",
        sourceKey: "settings-withdraw",
        dismissible: true,
      });
    } catch (error) {
      reportError(error, { area: "settings:withdraw" });
      showToast({
        title: "회원 탈퇴에 실패했어요",
        description: "잠시 후 다시 시도해주세요.",
        variant: "error",
        sourceKey: "settings-withdraw",
        dismissible: true,
      });
    }
  }, [
    connectedProviders,
    deleteAccountMutation,
    queryClient,
    router,
    setAvatarEmoji,
    showToast,
    signOutStore,
  ]);

  return (
    <>
      <SettingsSectionCard title="앱 정보">
        <Pressable
          className="-mx-2 flex-row items-center justify-between gap-3 rounded-xl px-2 py-1.5 active:bg-accent web:hover:bg-accent"
          onPress={() => router.push("/announcements" as Href)}
        >
          <View className="flex-row items-center gap-2">
            <Icon
              as={Megaphone}
              size={16}
              className="text-muted-foreground"
            />
            <Text className="text-sm font-semibold text-foreground">공지사항</Text>
          </View>
          <Icon
            as={ChevronRight}
            size={18}
            className="text-muted-foreground"
          />
        </Pressable>

        <Pressable
          className="-mx-2 flex-row items-center justify-between gap-3 rounded-xl px-2 py-1.5 active:bg-accent web:hover:bg-accent"
          onPress={() => {
            // Admins manage feedback in a list page; regular users write feedback.
            if (isAdmin) {
              router.push("/feedbacks" as Href);
            } else {
              setFeedbackOpen(true);
            }
          }}
        >
          <View className="flex-row items-center gap-2">
            <Icon
              as={MessageSquareText}
              size={16}
              className="text-muted-foreground"
            />
            <Text className="text-sm font-semibold text-foreground">피드백</Text>
          </View>
          <Icon
            as={ChevronRight}
            size={18}
            className="text-muted-foreground"
          />
        </Pressable>

        <Pressable
          className="-mx-2 flex-row items-center justify-between gap-3 rounded-xl px-2 py-1.5 active:bg-accent web:hover:bg-accent"
          onPress={() => router.push("/privacy" as Href)}
        >
          <View className="flex-row items-center gap-2">
            <Icon
              as={ShieldCheck}
              size={16}
              className="text-muted-foreground"
            />
            <Text className="text-sm font-semibold text-foreground">개인정보처리방침</Text>
          </View>
          <Icon
            as={ChevronRight}
            size={18}
            className="text-muted-foreground"
          />
        </Pressable>

        <View className="-mx-2 flex-row items-center justify-between gap-3 px-2 py-1.5">
          <View className="flex-row items-center gap-2">
            <Icon
              as={Info}
              size={16}
              className="text-muted-foreground"
            />
            <Text className="text-sm font-semibold text-foreground">앱 버전</Text>
          </View>
          <Text className="text-sm text-muted-foreground">{appVersion}</Text>
        </View>

        <Pressable
          className="-mx-2 flex-row items-center gap-2 self-start rounded-xl px-2 py-1.5 active:bg-accent web:hover:bg-accent"
          onPress={() => setWithdrawOpen(true)}
        >
          <Icon
            as={UserRoundX}
            size={14}
            className="text-destructive"
          />
          <Text className="text-xs font-semibold text-destructive">회원 탈퇴</Text>
        </Pressable>
      </SettingsSectionCard>

      <View className="items-center pt-1">
        <AppStoreBadge />
      </View>

      <AlertDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
      >
        <AlertDialogContent className="min-w-[20rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>회원 탈퇴할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              탈퇴하면 저장한 링크와 폴더, 할 일이 모두 삭제되며 되돌릴 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel disabled={deleteAccountMutation.isPending}>
              <Text>취소</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteAccountMutation.isPending}
              onPress={handleConfirmWithdraw}
            >
              <Text className="text-white">
                {deleteAccountMutation.isPending ? "처리 중..." : "탈퇴"}
              </Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FeedbackEditor
        mode={mode}
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
      />
    </>
  );
}

function AiProviderSection({ mode }: { mode: SettingsScreenMode }) {
  const defaultProvider = useDisplaySettings((state) => state.ai.defaultProvider);
  const setDefaultProvider = useDisplaySettings((state) => state.setDefaultProvider);
  const setDefaultModel = useDisplaySettings((state) => state.setDefaultModel);
  const providersQuery = useAiProviderCatalogQuery();
  const providers = React.useMemo(() => providersQuery.data ?? [], [providersQuery.data]);
  const myProvidersQuery = useMyAiProvidersQuery();
  const myProviders = myProvidersQuery.data;

  const [pickerOpen, setPickerOpen] = React.useState(false);

  const selectedProvider = providers.find((provider) => provider.providerId === defaultProvider.id);
  const providerNameLabel = selectedProvider ? getProviderLabel(selectedProvider) : null;

  const handleSelect = React.useCallback(
    (selection: AiProviderSelection) => {
      const provider = providers.find((entry) => entry.providerId === selection.providerId);
      if (provider) {
        setDefaultProvider({ id: provider.providerId, type: provider.providerType });
      }
      // Persist the model the server actually runs for this user, not a catalog row.
      const target = resolveProviderRequest(myProviders, selection.providerId);
      setDefaultModel({ id: target?.modelId ?? null, model: null });
      setPickerOpen(false);
    },
    [myProviders, providers, setDefaultModel, setDefaultProvider],
  );

  return (
    <>
      <SettingsSectionCard title="AI 제공자">
        <Pressable
          className="-mx-2 flex-row items-center justify-between gap-3 rounded-xl px-2 py-1.5 active:bg-accent web:hover:bg-accent"
          onPress={() => setPickerOpen(true)}
        >
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Icon
                as={Sparkles}
                size={14}
                className="text-primary"
              />
              <Text
                numberOfLines={1}
                className="text-xs font-semibold uppercase text-muted-foreground"
              >
                기본 제공자
              </Text>
            </View>
            <Text
              numberOfLines={1}
              className="text-lg font-semibold text-foreground"
            >
              {providerNameLabel ?? "제공자 미선택"}
            </Text>
          </View>
          <Icon
            as={ChevronRight}
            size={18}
            className="text-muted-foreground"
          />
        </Pressable>
      </SettingsSectionCard>

      <AiPickerOverlay
        mode={mode}
        open={pickerOpen}
        selectedProviderId={defaultProvider.id}
        onOpenChange={setPickerOpen}
        onSelect={handleSelect}
      />
    </>
  );
}

function AiPickerOverlay({
  mode,
  open,
  selectedProviderId,
  onOpenChange,
  onSelect,
}: {
  mode: SettingsScreenMode;
  open: boolean;
  selectedProviderId: number | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: AiProviderSelection) => void;
}) {
  const body = (
    <AiProviderPickerList
      selectedProviderId={selectedProviderId}
      onSelect={onSelect}
    />
  );

  if (mode === "wide") {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI 제공자</DialogTitle>
            <DialogDescription>요약에 사용할 기본 제공자를 선택해요.</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <Sheet
      open={open}
      fitContent
      onOpenChange={onOpenChange}
    >
      <Text className="text-lg font-semibold text-foreground">AI 제공자</Text>
      {body}
    </Sheet>
  );
}

function SettingsScreenWithAutosave({ mode }: { mode: SettingsScreenMode }) {
  useSettingsAutosave();
  return <SettingsScreen mode={mode} />;
}

export { SettingsScreenWithAutosave as SettingsScreen };
export type { SettingsScreenMode };
