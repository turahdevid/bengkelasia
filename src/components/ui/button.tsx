import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-in-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
  {
    variants: {
      variant: {
        default:
          "bg-orange-400 text-white shadow hover:shadow-lg hover:scale-[1.02] active:scale-[0.99]",
        secondary:
          "bg-white/30 text-neutral-900 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.15)] hover:shadow-lg hover:scale-[1.02]",
        ghost: "bg-transparent text-neutral-900 hover:bg-white/20",
      },
      size: {
        default: "h-11 px-4",
        lg: "h-12 px-5",
        icon: "h-11 w-11",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
