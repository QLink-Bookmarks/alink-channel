import * as React from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { Image } from "expo-image";
import { cssInterop } from "nativewind";

// expo-image is a third-party component, so NativeWind does not map `className`
// to `style` on native by default — without this the image receives no
// dimensions and renders blank (web is unaffected). Register the interop once.
cssInterop(Image, { className: "style" });

type FaviconProps = React.ComponentProps<typeof View> & {
  url?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  shape?: "rounded" | "circle";
};

function Favicon({
  url,
  fallback,
  size = "md",
  shape = "rounded",
  className,
  ...props
}: FaviconProps) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const showImage = Boolean(url) && failedUrl !== url;
  const sizeClass = size === "sm" ? "size-6" : size === "lg" ? "size-10" : "size-8";

  return (
    <View
      className={cn(
        "items-center justify-center overflow-hidden border border-border-soft bg-muted",
        sizeClass,
        shape === "circle" ? "rounded-full" : "rounded-lg",
        className,
      )}
      {...props}
    >
      {showImage ? (
        <Image
          source={{ uri: url }}
          className="size-full"
          contentFit="cover"
          onError={() => setFailedUrl(url ?? null)}
        />
      ) : (
        <Text className="text-xs font-semibold text-muted-foreground">{fallback ?? "?"}</Text>
      )}
    </View>
  );
}

export { Favicon };
export type { FaviconProps };
