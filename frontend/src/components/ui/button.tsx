import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default: "bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:bg-purple-500",
        gradient: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:from-purple-500 hover:to-indigo-500",
        destructive: "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20",
        outline: "border border-[#1e1e2d] bg-[#121218] text-gray-200 hover:border-purple-500/40 hover:text-white hover:bg-[#181822]",
        secondary: "bg-[#181822] text-gray-300 border border-[#232333] hover:text-white hover:bg-[#20202d]",
        ghost: "text-gray-400 hover:text-white hover:bg-[#181822]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-3 text-[11px]",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9 p-0 flex items-center justify-center",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };