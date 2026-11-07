import { Platform, View } from "react-native";

import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Slot } from "@rn-primitives/slot";

import { type VariantProps, cva } from "class-variance-authority";

const badgeVariants = cva(
  cn(
    "border-border group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-[10px] border px-2 py-0.5",
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive aria-invalid:border-destructive w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3",
    }),
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary border-transparent",
          Platform.select({ web: "[a&]:hover:bg-primary/90" }),
        ),
        tag: "border-border-soft bg-surface-elevated",
        status: "border-primary/20 bg-primary/10",
        todo: "border-primary/20 bg-primary/10",
        public: "border-primary/20 bg-primary/10",
        private: "border-border-soft bg-muted",
        folder: "border-border-soft bg-card",
        overdue: "border-destructive/20 bg-destructive/10",
        success: "border-success/20 bg-success/10",
        warning: "border-warning/20 bg-warning/10",
        secondary: cn(
          "bg-secondary border-transparent",
          Platform.select({ web: "[a&]:hover:bg-secondary/90" }),
        ),
        destructive: cn(
          "bg-destructive border-transparent",
          Platform.select({ web: "[a&]:hover:bg-destructive/90" }),
        ),
        outline: cn(
          "rounded-[10px]",
          Platform.select({
            web: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
          }),
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const badgeTextVariants = cva("text-xs font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      tag: "text-muted-foreground",
      status: "text-primary",
      todo: "text-primary",
      public: "text-primary",
      private: "text-muted-foreground",
      folder: "text-foreground",
      overdue: "text-destructive",
      success: "text-success",
      warning: "text-warning",
      secondary: "text-secondary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type BadgeProps = React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    asChild?: boolean;
    dot?: boolean;
  } & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, dot, children, ...props }: BadgeProps) {
  const Component = asChild ? Slot : View;
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Component
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      >
        {dot && <View className="size-1.5 rounded-full bg-current" />}
        {children}
      </Component>
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
