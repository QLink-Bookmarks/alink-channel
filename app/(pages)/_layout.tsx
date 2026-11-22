import { PrivatePagesLayout } from "@/features/navigation/components/private-pages-layout";
import { ResourceAccess } from "@/features/navigation/components/resource-access";

import { Navigator } from "expo-router";

export default function PagesLayout() {
  return (
    <Navigator>
      <ResourceAccess>
        <PrivatePagesLayout />
      </ResourceAccess>
    </Navigator>
  );
}
