import type { WideSidebarKey } from "../types";

import { BookCopyIcon, CheckSquare, LucideHome, type LucideIcon } from "lucide-react-native";

type WidePrimaryItem = {
  href: string;
  key: WideSidebarKey;
  label: string;
  icon: LucideIcon;
};

const WIDE_PRIMARY_ITEMS: WidePrimaryItem[] = [
  { href: "/home", key: "home", label: "홈", icon: LucideHome },
  { href: "/links", key: "links", label: "전체", icon: BookCopyIcon },
  { href: "/todos", key: "todos", label: "할일", icon: CheckSquare },
];

export { WIDE_PRIMARY_ITEMS };
export type { WidePrimaryItem };
