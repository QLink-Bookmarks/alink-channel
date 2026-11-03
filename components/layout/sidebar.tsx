import * as React from "react";
import { Pressable, View } from "react-native";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react-native";

// View scope: 와이드뷰 전용. md >= 769px에서 사용한다.

const SIDEBAR_ITEM_HEIGHT = 40;
const isWeb = process.env.EXPO_OS === "web";

function getSelectionProps(active?: boolean) {
  return (
    isWeb
      ? active
        ? { "aria-current": "page" }
        : {}
      : { accessibilityState: { selected: Boolean(active) } }
  ) as React.ComponentProps<typeof Pressable>;
}

function Sidebar({
  className,
  collapsed,
  children,
  ...props
}: React.ComponentProps<typeof View> & { collapsed?: boolean }) {
  return (
    <View
      className={cn(
        "hidden h-full border-r border-sidebar-border bg-sidebar p-3 md:flex",
        collapsed ? "w-20" : "w-72",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

function SidebarItem({
  className,
  icon,
  emoji,
  label,
  labelClassName,
  count,
  meta,
  metaIcon,
  kbd,
  active,
  accessibilityLabel,
  onPress,
}: {
  className?: string;
  icon?: LucideIcon;
  emoji?: string;
  label: string;
  labelClassName?: string;
  count?: number | string;
  meta?: string;
  metaIcon?: LucideIcon;
  kbd?: string;
  active?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const selectionProps = getSelectionProps(active);
  const metaTextClassName = active
    ? "text-sidebar-hover"
    : "text-sidebar-muted web:group-hover:text-sidebar-hover";

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      {...selectionProps}
      // shadow-none: NativeWind가 transform/shadow 클래스가 처음 붙을 때 컴포넌트를 바꿔 끼워 iOS에서 Couldn't find a navigation context 오류가 난다. 기본값을 늘 붙여 둔다. 지우지 말 것.
      className={cn(
        "group relative min-h-10 flex-row items-center gap-3 overflow-hidden rounded-xl px-3 active:bg-sidebar-surface-2 web:transition-colors web:hover:bg-sidebar-surface-2",
        active ? "bg-sidebar-surface-2 shadow-qlink-sm" : "shadow-none",
        className,
      )}
      onPress={onPress}
    >
      {active ? (
        <View className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-primary" />
      ) : null}
      {icon ? (
        <Icon
          as={icon}
          className={cn(
            "size-4",
            active
              ? "text-sidebar-accent-foreground"
              : "text-sidebar-muted web:group-hover:text-sidebar-hover",
          )}
        />
      ) : null}
      {emoji ? (
        <Text
          className="w-[18px] shrink-0 text-center text-sm"
          aria-hidden
        >
          {emoji}
        </Text>
      ) : null}
      <Text
        className={cn(
          "min-w-0 flex-1 text-sm font-medium",
          active ? "text-sidebar-hover" : "text-sidebar-muted web:group-hover:text-sidebar-hover",
          labelClassName,
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      {meta ? (
        <View className="shrink-0 flex-row items-center gap-[3px]">
          {metaIcon ? (
            <Icon
              as={metaIcon}
              className={cn("size-3", metaTextClassName)}
            />
          ) : null}
          <Text className={cn("text-xs tabular-nums", metaTextClassName)}>{meta}</Text>
        </View>
      ) : null}
      {count != null ? (
        <Text
          className={cn(
            "shrink-0 text-xs tabular-nums",
            active ? "text-sidebar-hover" : "text-sidebar-muted web:group-hover:text-sidebar-hover",
          )}
        >
          {count}
        </Text>
      ) : null}
      {kbd ? <Kbd size="xs">{kbd}</Kbd> : null}
    </Pressable>
  );
}

function SidebarSection({
  className,
  title,
  actionLabel,
  onActionPress,
  children,
}: React.ComponentProps<typeof View> & {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  return (
    <View className={cn("gap-2 border-t border-sidebar-border pt-3", className)}>
      <View className="flex-row items-center justify-between px-2">
        <Text className="text-xs font-semibold uppercase text-muted-foreground">{title}</Text>
        {actionLabel ? (
          <Pressable onPress={onActionPress}>
            <Text className="text-xs font-medium text-primary">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SidebarProfile({
  className,
  avatarUrl,
  name,
  email,
  onPress,
}: {
  className?: string;
  avatarUrl?: string;
  name: string;
  email: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center gap-3 rounded-xl p-2 active:bg-sidebar-accent",
        className,
      )}
      onPress={onPress}
    >
      <Avatar alt={`${name} avatar`}>
        {avatarUrl ? <AvatarImage source={{ uri: avatarUrl }} /> : null}
        <AvatarFallback>
          <Text className="text-xs font-semibold">{name.slice(0, 1)}</Text>
        </AvatarFallback>
      </Avatar>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-sm font-semibold"
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          className="text-xs text-muted-foreground"
        >
          {email}
        </Text>
      </View>
    </Pressable>
  );
}

function SidebarCTA({
  className,
  label,
  onPress,
}: {
  className?: string;
  label: React.ReactNode;
  onPress?: () => void;
}) {
  const content =
    typeof label === "string" ? (
      <Text className="font-semibold text-primary-foreground">{label}</Text>
    ) : (
      label
    );

  return (
    <Button
      className={cn(
        "min-h-11 w-full rounded-2xl px-4 shadow-qlink-md web:transition-all web:hover:-translate-y-0.5 web:hover:shadow-qlink-lg",
        className,
      )}
      onPress={onPress}
      size="lg"
      variant="gradient"
    >
      <View className="flex-row items-center justify-center gap-3">{content}</View>
    </Button>
  );
}

function SidebarRail({ className, children, ...props }: React.ComponentProps<typeof View>) {
  return (
    <Sidebar
      collapsed
      className={cn("h-full w-full p-0", className)}
      {...props}
    >
      {children}
    </Sidebar>
  );
}

type SidebarRailButtonProps = React.ComponentProps<typeof Pressable> & {
  icon?: LucideIcon;
  emoji?: string;
  active?: boolean;
  className?: string;
  children?: React.ReactNode;
};

function SidebarRailButton({
  icon,
  emoji,
  active,
  className,
  children,
  ...props
}: SidebarRailButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...getSelectionProps(active)}
      // shadow-none: NativeWind가 transform/shadow 클래스가 처음 붙을 때 컴포넌트를 바꿔 끼워 iOS에서 Couldn't find a navigation context 오류가 난다. 기본값을 늘 붙여 둔다. 지우지 말 것.
      className={cn(
        "group relative size-11 items-center justify-center rounded-xl active:bg-sidebar-surface-2 web:transition-colors web:hover:bg-sidebar-surface-2 web:motion-reduce:transition-none",
        active ? "bg-sidebar-surface-2 shadow-qlink-sm" : "shadow-none",
        className,
      )}
      {...props}
    >
      {active ? (
        <View className="absolute bottom-2.5 left-0 top-2.5 w-1 rounded-full bg-primary" />
      ) : null}
      {children ??
        (icon ? (
          <Icon
            as={icon}
            className={cn(
              "size-[18px]",
              active ? "text-primary" : "text-sidebar-muted web:group-hover:text-sidebar-hover",
            )}
          />
        ) : emoji ? (
          <Text
            className="text-lg leading-none"
            aria-hidden
          >
            {emoji}
          </Text>
        ) : null)}
    </Pressable>
  );
}

function SidebarRailCTA({
  icon,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { icon: LucideIcon }) {
  return (
    <Button
      className={cn(
        "size-11 min-w-0 self-center rounded-2xl p-0 shadow-qlink-md sm:h-11",
        className,
      )}
      size="icon"
      variant="gradient"
      {...props}
    >
      <View className="relative z-10 items-center justify-center">
        <Icon
          as={icon}
          className="size-[18px] text-primary-foreground"
        />
      </View>
    </Button>
  );
}

function SidebarRailTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: React.ReactElement;
}) {
  if (!isWeb) {
    return children;
  }
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        className="max-w-80 bg-foreground"
        side="right"
        sideOffset={10}
      >
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold text-background">{label}</Text>
          {shortcut ? (
            <Kbd
              size="xs"
              variant="inverse"
            >
              {shortcut}
            </Kbd>
          ) : null}
        </View>
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarRailItem({
  label,
  shortcut,
  accessibilityLabel,
  ...props
}: SidebarRailButtonProps & { label: string; shortcut?: string }) {
  return (
    <SidebarRailTooltip
      label={label}
      shortcut={shortcut}
    >
      <SidebarRailButton
        accessibilityLabel={accessibilityLabel ?? label}
        {...props}
      />
    </SidebarRailTooltip>
  );
}

function SidebarRailSeparator({ className }: { className?: string }) {
  return <View className={cn("my-1 h-px w-8 shrink-0 bg-sidebar-border", className)} />;
}

export {
  Sidebar,
  SidebarCTA,
  SidebarItem,
  SidebarProfile,
  SidebarRail,
  SidebarRailButton,
  SidebarRailCTA,
  SidebarRailItem,
  SidebarRailSeparator,
  SidebarRailTooltip,
  SidebarSection,
  SIDEBAR_ITEM_HEIGHT,
};
export type { SidebarRailButtonProps };
