import { ResourceAccess } from "@/features/navigation/components/resource-access";

import { Navigator } from "expo-router";

export default function PagesLayout() {
  return (
    <Navigator>
      <ResourceAccess>
        <Navigator.Slot />
      </ResourceAccess>
    </Navigator>
  );
}
