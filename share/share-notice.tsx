import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react-native";

type ShareNoticeProps = {
  icon: LucideIcon;
  message: string;
  actionLabel: string;
  actionTone: "solid" | "outline";
  onAction: () => void;
};

function ShareNotice({ icon, message, actionLabel, actionTone, onAction }: ShareNoticeProps) {
  return (
    <View>
      <View className="items-center gap-3 px-3 py-6">
        <View className="size-[52px] items-center justify-center rounded-full bg-muted">
          <Icon
            as={icon}
            className="text-muted-foreground"
            size={24}
          />
        </View>
        <Text className="text-center text-[17px] font-semibold leading-[23px] text-foreground">
          {message}
        </Text>
      </View>
      <View className="pt-3.5">
        <Button
          className={cn(
            "h-12 w-full self-stretch rounded-xl",
            actionTone === "solid" ? "bg-primary" : "border border-border bg-background",
          )}
          variant={actionTone === "solid" ? "default" : "outline"}
          onPress={onAction}
        >
          <Text
            className={cn(
              "text-base font-semibold",
              actionTone === "solid" ? "text-primary-foreground" : "text-foreground",
            )}
          >
            {actionLabel}
          </Text>
        </Button>
      </View>
    </View>
  );
}

export { ShareNotice };
