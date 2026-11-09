import { Platform, Pressable, type PressableStateCallbackType } from "react-native";

import { LinearGradient } from "@/components/ui/linear-gradient";
import { TextClassContext } from "@/components/ui/text";
import type { AccentName } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { type VariantProps, cva } from "class-variance-authority";

const buttonVariants = cva(
  cn(
    "group shrink-0 self-start flex-row items-center justify-center gap-2 rounded-md shadow-none",
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    }),
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary active:bg-primary/90 shadow-sm shadow-black/5",
          Platform.select({ web: "hover:bg-primary/90" }),
        ),
        primary: cn(
          "bg-primary active:bg-primary/90 shadow-qlink-sm",
          Platform.select({ web: "hover:bg-primary/90" }),
        ),
        destructive: cn(
          "bg-destructive active:bg-destructive/90 dark:bg-destructive/60 shadow-sm shadow-black/5",
          Platform.select({
            web: "hover:bg-destructive/90 focus-visible:ring-destructive",
          }),
        ),
        danger: cn(
          "bg-destructive active:bg-destructive/90 dark:bg-destructive/60 shadow-sm shadow-black/5",
          Platform.select({
            web: "hover:bg-destructive/90 focus-visible:ring-destructive",
          }),
        ),
        outline: cn(
          "border-border bg-background active:bg-accent dark:bg-input/30 dark:border-input dark:active:bg-input/50 border shadow-sm shadow-black/5",
          Platform.select({
            web: "hover:bg-accent dark:hover:bg-input/50",
          }),
        ),
        secondary: cn(
          "bg-secondary active:bg-secondary/80 shadow-sm shadow-black/5",
          Platform.select({ web: "hover:bg-secondary/80" }),
        ),
        ghost: cn(
          "active:bg-accent dark:active:bg-accent/50",
          Platform.select({ web: "hover:bg-accent dark:hover:bg-accent/50" }),
        ),
        kakao: cn(
          "bg-accent-yellow active:bg-accent-yellow/90 shadow-sm shadow-black/5",
          Platform.select({ web: "hover:bg-accent-yellow/90" }),
        ),
        social: cn(
          "border-border bg-card active:bg-accent border shadow-sm shadow-black/5",
          Platform.select({ web: "hover:bg-accent" }),
        ),
        gradient: cn(
          "relative overflow-hidden bg-transparent shadow-qlink-sm active:opacity-95",
          Platform.select({ web: "hover:opacity-95" }),
        ),
        link: "",
      },
      size: {
        xs: cn(
          "h-8 min-w-button-xs gap-1 rounded-sm px-2",
          Platform.select({ web: "has-[>svg]:px-2" }),
        ),
        default: cn(
          "h-10 min-w-button-default px-4 py-2 sm:h-9",
          Platform.select({ web: "has-[>svg]:px-3" }),
        ),
        sm: cn(
          "h-9 min-w-button-sm gap-1.5 rounded-md px-3 sm:h-8",
          Platform.select({ web: "has-[>svg]:px-2.5" }),
        ),
        lg: cn(
          "h-11 min-w-button-lg rounded-md px-6 sm:h-10",
          Platform.select({ web: "has-[>svg]:px-4" }),
        ),
        icon: "h-10 w-10 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva(
  cn(
    "text-foreground text-sm font-medium",
    Platform.select({ web: "pointer-events-none transition-colors" }),
  ),
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        primary: "text-primary-foreground",
        destructive: "text-white",
        danger: "text-white",
        outline: cn(
          "group-active:text-accent-foreground",
          Platform.select({ web: "group-hover:text-accent-foreground" }),
        ),
        secondary: "text-secondary-foreground",
        ghost: "group-active:text-accent-foreground",
        kakao: "text-black",
        social: "text-foreground",
        gradient: "text-primary-foreground",
        link: cn(
          "text-primary group-active:underline",
          Platform.select({
            web: "underline-offset-4 hover:underline group-hover:underline",
          }),
        ),
      },
      size: {
        xs: "text-xs",
        default: "",
        sm: "",
        lg: "",
        icon: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    // For variant="gradient": pin the gradient to a specific accent instead of
    // the user's current accent (e.g. always-pink CTA).
    gradientAccent?: AccentName;
  };

function Button({ children, className, variant, size, gradientAccent, ...props }: ButtonProps) {
  const renderChildren = (state: PressableStateCallbackType) => (
    <>
      {variant === "gradient" ? (
        <LinearGradient
          accent={gradientAccent}
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
          pointerEvents="none"
        />
      ) : null}
      {typeof children === "function" ? children(state) : children}
    </>
  );

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn(props.disabled && "opacity-50", buttonVariants({ variant, size }), className)}
        role="button"
        {...props}
      >
        {renderChildren}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
