import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";

import { LinearGradient } from "@/components/ui/linear-gradient";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type Href, Link } from "expo-router";

export const LANDING_FRAME = "mx-auto w-full max-w-[1280px]";
export const LANDING_TOP_GUTTER = "px-[22px] md:px-6";
export const LANDING_COLOR_VARS = {
  "--landing-header-surface": "#F4EDF6",
  "--landing-hero-foreground": "#292536",
  "--landing-hero-muted": "#595165",
  "--landing-hero-surface": "#FAF6F1",
  "--landing-hero-rose": "#F5DCE5",
  "--landing-hero-lavender": "#EDE4FC",
  "--landing-stage-glow": "#FFF2DF",
  "--landing-stage-rose": "#EFD9E4",
  "--landing-stage-lavender": "#E1D1EF",
  "--landing-device-frame": "#28252D",
  "--landing-device-surface": "#151219",
};

// Clear pastel wash per section so scrolling reads as moving between distinct
// pages. Landing is pinned to light mode, so these fixed tints stay consistent.
export const SECTION_BG = [
  "bg-[#E9ECF3]",
  "bg-[#E1EDFC]",
  "bg-[#EEE6FB]",
  "bg-[#FCEFDE]",
  "bg-[#DFF3E7]",
];
export const FINAL_BG = "bg-[#FBE4EF]";

const SECTION_BLOB = ["#AEB8D4", "#9CC4F2", "#C4A9EE", "#F2C889", "#8FD9AF"];

export const LANDING_FOCUS =
  "web:focus-visible:[outline-style:solid] web:focus-visible:outline-2 web:focus-visible:outline-offset-2 web:focus-visible:outline-foreground";

export function scrollToLandingSection(id: string, focusSection = false) {
  const target = document.getElementById(id);
  if (!target) return;
  if (focusSection) {
    target.tabIndex = -1;
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    target.focus({ preventScroll: true });
  }
  target.scrollIntoView({ block: "start" });
}

export function LandingSectionLink({
  section,
  className,
  ...props
}: Pick<ComponentProps<typeof Pressable>, "accessibilityLabel" | "children" | "className"> & {
  section: string;
}) {
  const id = `landing-${section}`;
  return (
    <Link
      href={`/#${id}`}
      asChild
      onPress={(event) => {
        event.preventDefault();
        scrollToLandingSection(id, true);
      }}
    >
      <Pressable
        {...props}
        className={cn(LANDING_FOCUS, className)}
      />
    </Link>
  );
}

export function StartButton({
  href,
  label,
  className,
}: {
  href: Href;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      asChild
    >
      <Pressable
        className={cn(
          "relative h-12 items-center justify-center overflow-hidden rounded-2xl px-8 shadow-qlink-md active:opacity-95 web:transition-transform web:hover:scale-105",
          LANDING_FOCUS,
          className,
        )}
      >
        <LinearGradient
          accent="pink"
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
          pointerEvents="none"
        />
        <Text className="text-base font-semibold text-primary-foreground">{label}</Text>
      </Pressable>
    </Link>
  );
}

// Ambient section backdrop: a big faded number watermark + two soft color
// blobs. Sits behind the content (overflow-hidden on the section clips it).
export function SectionBackdrop({ index }: { index: number }) {
  const color = SECTION_BLOB[index % SECTION_BLOB.length];
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
    >
      <View
        className="absolute -left-24 top-12 h-72 w-72 rounded-full"
        style={{ backgroundColor: color, opacity: 0.16 }}
      />
      <View
        className="absolute -right-24 bottom-8 h-96 w-96 rounded-full"
        style={{ backgroundColor: color, opacity: 0.12 }}
      />
      <Text className="absolute right-4 top-6 font-mono text-[150px] font-bold leading-none text-foreground/[0.045] md:text-[260px]">
        {`A${index + 1}`}
      </Text>
    </View>
  );
}

// Vertical progress rail (desktop): a dot per page, the active one stretches.
export function ProgressRail({ total, active }: { total: number; active: number }) {
  return (
    <View
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 gap-2.5 md:flex"
    >
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          testID={index === active ? "landing-progress-current" : undefined}
          nativeID={`landing-progress-${index}`}
          className={cn(
            "w-1 rounded-full",
            index === active ? "h-6 bg-primary" : "bg-border-strong h-1.5",
          )}
          style={
            {
              transitionProperty: "height, background-color",
              transitionDuration: "350ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            } as object
          }
        />
      ))}
    </View>
  );
}
