import type * as React from "react";

import { SidebarRailButton, SidebarRailTooltip } from "@/components/layout/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useDisplaySettings } from "@/stores/display-settings";

import { Palette } from "lucide-react-native";

type PopoverSide = React.ComponentProps<typeof PopoverContent>["side"];

const THEME_POPOVER_SIDE = (process.env.EXPO_OS === "web" ? "right" : "top") as PopoverSide;

type ThemePopoverButtonProps = {
  sideOffset?: number;
};

function ThemePopoverButton({ sideOffset = 8 }: ThemePopoverButtonProps) {
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const setAccent = useDisplaySettings((state) => state.setAccent);
  const setTheme = useDisplaySettings((state) => state.setTheme);

  return (
    <Popover>
      <SidebarRailTooltip label="모드 · 강조색">
        <PopoverTrigger asChild>
          <SidebarRailButton
            accessibilityLabel="모드와 강조색"
            icon={Palette}
          />
        </PopoverTrigger>
      </SidebarRailTooltip>
      <PopoverContent
        accessibilityLabel="모드와 강조색"
        align="end"
        className="w-60 gap-2 rounded-2xl p-2.5 shadow-qlink-lg"
        side={THEME_POPOVER_SIDE}
        sideOffset={sideOffset}
      >
        <Text className="px-0.5 text-sm font-semibold text-muted-foreground">모드 · 강조색</Text>
        <ThemeSwitcher
          accent={accent}
          mode={theme}
          variant="switch"
          onAccentChange={setAccent}
          onModeChange={setTheme}
        />
      </PopoverContent>
    </Popover>
  );
}

export { ThemePopoverButton };
export type { ThemePopoverButtonProps };
