import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";

const SETTINGS_PATH = "/settings";

function ImportBreadcrumb() {
  return (
    <View
      role="navigation"
      aria-label="경로"
      className="-mb-3 flex-row items-center gap-1"
    >
      <Link
        href={SETTINGS_PATH}
        asChild
      >
        <Text className="-ml-1.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground web:outline-none web:hover:text-foreground web:hover:underline web:focus-visible:ring-2 web:focus-visible:ring-ring">
          설정
        </Text>
      </Link>
      <Icon
        as={ChevronRight}
        size={14}
        className="text-muted-foreground"
      />
      <Text
        aria-current="page"
        className="text-sm font-medium text-foreground"
      >
        북마크 가져오기
      </Text>
    </View>
  );
}

export { ImportBreadcrumb };
