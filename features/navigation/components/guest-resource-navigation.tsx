import type { ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/layout/brand-header";
import { Sidebar, SidebarItem } from "@/components/layout/sidebar";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { useWideView } from "@/lib/hooks/use-wide-view";
import type { ThemeMode } from "@/lib/theme";
import { getNativeThemeVars } from "@/lib/theme-vars";

import { rememberReturnDestination } from "../lib/return-destination";

import { usePathname, useRouter } from "expo-router";
import { LogIn, Menu } from "lucide-react-native/icons";

function GuestResourceNavigation({
  children,
  theme,
}: {
  children: (headerAction?: ReactNode) => ReactNode;
  theme: ThemeMode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isWide = useWideView();
  const insets = useSafeAreaInsets();

  const handleLoginPress = () => {
    rememberReturnDestination(pathname);
    router.push("/login");
  };

  const sidebarContent = (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow justify-between gap-4 p-3"
      contentContainerStyle={{ paddingTop: 12 + insets.top, paddingBottom: 12 + insets.bottom }}
    >
      <BrandHeader
        mode={theme}
        accent="gray"
        className="pt-0"
      />
      <View className="border-t border-sidebar-border pt-3">
        <SidebarItem
          icon={LogIn}
          label="로그인"
          onPress={handleLoginPress}
        />
      </View>
    </ScrollView>
  );

  if (isWide) {
    return (
      <View className="flex-1 flex-row bg-background">
        <Sidebar
          aria-label="사이드바"
          role="navigation"
          className="w-[15%] min-w-56 max-w-80 p-0"
        >
          {sidebarContent}
        </Sidebar>
        <View className="min-w-0 flex-1">{children()}</View>
      </View>
    );
  }

  return children(
    <Dialog className="shrink-0">
      <DialogTrigger asChild>
        <IconButton
          accessibilityLabel="사이드바 열기"
          hitSlop={4}
          icon={Menu}
          size="sm"
          variant="ghost"
        />
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="m-0 h-full w-72 max-w-[calc(100%-3rem)] gap-0 rounded-none border-y-0 border-l-0 border-sidebar-border bg-sidebar p-0 web:zoom-in-100 sm:max-w-72"
        overlayClassName="z-50 items-start justify-start p-0"
        style={getNativeThemeVars(theme, "gray") as ViewStyle}
      >
        <DialogTitle className="sr-only">사이드바</DialogTitle>
        {sidebarContent}
      </DialogContent>
    </Dialog>,
  );
}

export { GuestResourceNavigation };
