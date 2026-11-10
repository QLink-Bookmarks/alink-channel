import * as React from "react";
import { Pressable, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ConnectedAuthProvider } from "@/features/account/types";
import { cn } from "@/lib/utils";

import { useConnectFeedback } from "../hooks/use-connect-feedback";
import { useConnectSocial } from "../hooks/use-connect-social";
import {
  PROVIDER_BRANDS,
  SOCIAL_PROVIDER_ORDER,
  type SocialProvider,
  normalizeSocialProvider,
} from "../lib/provider-brand";
import { LoginButton } from "./login-buttons";

import { Plus } from "lucide-react-native/icons";

type ConnectProvidersMode = "wide" | "mobile";

function ProviderChip({ provider }: { provider: SocialProvider }) {
  const brand = PROVIDER_BRANDS[provider];
  const Logo = brand.Logo;
  return (
    <View
      className={cn("size-8 items-center justify-center rounded-full", brand.chipClassName)}
      accessibilityLabel={`${brand.provider} 연결됨`}
    >
      <Logo size={15} />
    </View>
  );
}

function ConnectProviderButton({
  provider,
  loading,
  onPress,
}: {
  provider: SocialProvider;
  loading: boolean;
  onPress: () => void;
}) {
  const brand = PROVIDER_BRANDS[provider];
  const Logo = brand.Logo;
  return (
    <LoginButton
      containerClassName={brand.containerClassName}
      disabled={loading}
      onPress={onPress}
    >
      {loading ? <ActivityIndicator size="small" /> : <Logo size={brand.logoSize} />}
      <Text className={cn("text-base", brand.textClassName)}>{brand.connectLabel}</Text>
    </LoginButton>
  );
}

function ConnectProviderOverlay({
  mode,
  open,
  missing,
  onOpenChange,
}: {
  mode: ConnectProvidersMode;
  open: boolean;
  missing: SocialProvider[];
  onOpenChange: (open: boolean) => void;
}) {
  const { connect, pendingProvider } = useConnectSocial();
  const applyOutcome = useConnectFeedback();

  const handleConnect = React.useCallback(
    async (provider: SocialProvider) => {
      const outcome = await connect(provider);
      if (!outcome) return;
      // Close before the toast on every result, failures included, so the
      // toast is never left behind this sheet. A cancel keeps the sheet open.
      onOpenChange(false);
      applyOutcome(outcome);
    },
    [applyOutcome, connect, onOpenChange],
  );

  const body = (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        연결할 소셜 계정을 선택하면 로그인 후 계정에 연결돼요.
      </Text>
      {missing.map((provider) => (
        <ConnectProviderButton
          key={provider}
          provider={provider}
          loading={pendingProvider === provider}
          onPress={() => handleConnect(provider)}
        />
      ))}
    </View>
  );

  if (mode === "wide") {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>계정 연결</DialogTitle>
            <DialogDescription>다른 소셜 계정을 추가로 연결해요.</DialogDescription>
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
      <Text className="text-lg font-semibold text-foreground">계정 연결</Text>
      {body}
    </Sheet>
  );
}

// Horizontal row of connected-provider chips with a trailing circular add
// button that opens the connect sheet/dialog.
function ConnectedProvidersRow({
  mode,
  connectedProviders,
}: {
  mode: ConnectProvidersMode;
  connectedProviders: ConnectedAuthProvider[];
}) {
  const [open, setOpen] = React.useState(false);

  const connectedTypes = React.useMemo(() => {
    const set = new Set<SocialProvider>();
    for (const item of connectedProviders) {
      const normalized = normalizeSocialProvider(item.type);
      if (normalized) set.add(normalized);
    }
    return set;
  }, [connectedProviders]);

  const connected = SOCIAL_PROVIDER_ORDER.filter((provider) => connectedTypes.has(provider));
  const missing = SOCIAL_PROVIDER_ORDER.filter((provider) => !connectedTypes.has(provider));

  return (
    <View className="gap-2 pl-2">
      <Text className="text-xs text-muted-foreground">연결된 계정</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        {connected.map((provider) => (
          <ProviderChip
            key={provider}
            provider={provider}
          />
        ))}
        {missing.length ? (
          <Pressable
            accessibilityLabel="계정 연결 추가"
            className="size-8 items-center justify-center rounded-full border border-dashed border-border bg-card active:bg-accent web:hover:bg-accent"
            onPress={() => setOpen(true)}
          >
            <Icon
              as={Plus}
              size={15}
              className="text-muted-foreground"
            />
          </Pressable>
        ) : null}
      </View>
      <ConnectProviderOverlay
        mode={mode}
        open={open}
        missing={missing}
        onOpenChange={setOpen}
      />
    </View>
  );
}

export { ConnectedProvidersRow };
