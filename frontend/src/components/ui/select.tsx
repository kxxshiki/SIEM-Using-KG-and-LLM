import * as React from "react";
import { cn } from "@/lib/utils";

/** A normal browser <select>, styled to match the ShadCN look. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";

export { Select };