import * as React from "react";
import { cn } from "@/lib/utils";

/** A normal browser <select>, styled to match the dark dashboard theme. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-xl border border-[#1e1e2d] bg-[#14141c] px-3 py-1.5 text-xs text-white focus-visible:outline-none focus-visible:border-purple-500/50 focus-visible:ring-1 focus-visible:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 cursor-pointer",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";

export { Select };