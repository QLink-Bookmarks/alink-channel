import { BottomTabs } from "@/components/layout/bottom-tabs";

import type { MobileTabKey } from "../types";

import { Folder, House, ListTodo, Settings } from "lucide-react-native";

const mobileTabItems = [
  { key: "home", label: "홈", icon: House, href: "/home" },
  { key: "folders", label: "폴더", icon: Folder, href: "/folders" },
  { key: "todos", label: "액션", icon: ListTodo, href: "/todos" },
  { key: "settings", label: "설정", icon: Settings, href: "/settings" },
] as const;

type MobileTabHref = (typeof mobileTabItems)[number]["href"];

function MobileBottomTabs({
  activeTab,
  onNavigate,
}: {
  activeTab: MobileTabKey | null;
  onNavigate: (href: MobileTabHref) => void;
}) {
  const handleTabChange = (value: string) => {
    const item = mobileTabItems.find(({ key }) => key === value);
    if (item) onNavigate(item.href);
  };

  return (
    <BottomTabs
      items={mobileTabItems}
      value={activeTab ?? ""}
      onValueChange={handleTabChange}
    />
  );
}

export { MobileBottomTabs };
