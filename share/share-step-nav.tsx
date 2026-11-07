import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import { ChevronLeft } from "lucide-react-native/icons";

function ShareStepNav({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="-mx-2 -mt-1.5 mb-1.5 h-11 flex-row items-center">
      <Pressable
        accessibilityLabel="뒤로"
        accessibilityRole="button"
        className="size-11 items-center justify-center rounded-full active:bg-accent"
        hitSlop={4}
        onPress={onBack}
      >
        <Icon
          as={ChevronLeft}
          className="text-foreground"
          size={22}
        />
      </Pressable>
      <Text
        accessibilityRole="header"
        className="flex-1 text-center text-[17px] font-semibold text-foreground"
        numberOfLines={1}
      >
        {title}
      </Text>
      <View className="size-11" />
    </View>
  );
}

export { ShareStepNav };
