import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#1F2937] text-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:bg-[#111827] hover:shadow-[0_2px_6px_rgba(0,0,0,0.14),0_8px_20px_rgba(0,0,0,0.10)]",
        destructive: "bg-[#DC2626] text-white shadow-[0_1px_3px_rgba(220,38,38,0.2)] hover:-translate-y-0.5 hover:bg-[#B91C1C]",
        outline: "border border-[#D1D5DB] bg-white text-[#374151] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#111827]",
        secondary: "bg-[#F3F4F6] text-[#374151] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#E5E7EB]",
        ghost: "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]",
        link: "text-[#374151] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-xl px-4 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
