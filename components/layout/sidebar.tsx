import * as React from "react";
import { Pressable, View } from "react-native";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react-native";

// View scope: 와이드뷰 전용. md >= 769px에서 사용한다.

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
  label,
  labelClassName,
  count,
  meta,
  kbd,
  active,
  onPress,
}: {
  className?: string;
  icon?: LucideIcon;
  label: string;
  labelClassName?: string;
  count?: number | string;
  meta?: string;
  kbd?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      className={cn(
        "group relative min-h-10 flex-row items-center gap-3 overflow-hidden rounded-xl px-3 active:bg-sidebar-surface-2 web:transition-colors web:hover:bg-sidebar-surface-2",
        active && "bg-sidebar-surface-2 shadow-qlink-sm",
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
            active ? "text-primary" : "text-sidebar-muted web:group-hover:text-sidebar-hover",
          )}
        />
      ) : null}
      <Text
        className={cn(
          "flex-1 text-sm font-medium",
          active ? "text-primary" : "text-sidebar-muted web:group-hover:text-sidebar-hover",
          labelClassName,
        )}
      >
        {label}
      </Text>
      {meta ? (
        <Text
          className={cn(
            "text-xs",
            active ? "text-primary/70" : "text-sidebar-muted/70 web:group-hover:text-sidebar-hover",
          )}
        >
          {meta}
        </Text>
      ) : null}
      {count != null ? (
        <Text
          className={cn(
            "text-xs",
            active ? "text-primary" : "text-sidebar-muted web:group-hover:text-sidebar-hover",
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

export { Sidebar, SidebarCTA, SidebarItem, SidebarProfile, SidebarSection };
