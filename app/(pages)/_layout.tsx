import { PrivatePagesLayout } from "@/features/navigation/components/private-pages-layout";

import { Navigator } from "expo-router";

export default function PagesLayout() {
  return (
    <Navigator>
      <PrivatePagesLayout />
    </Navigator>
  );
}
