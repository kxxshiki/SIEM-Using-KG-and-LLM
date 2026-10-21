import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-xl border border-[#1e1e2d] bg-[#14141c] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:border-purple-500/50 focus-visible:ring-1 focus-visible:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
        className
      )}
      {--props}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };