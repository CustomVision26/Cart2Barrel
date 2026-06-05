import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/** Shared field surface for `<Input />`, `<textarea />`, and similar controls. */
export const inputFieldClassName =
  "w-full min-w-0 rounded-lg border border-input bg-muted px-2.5 text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:border-white/25 dark:bg-secondary dark:text-foreground dark:disabled:bg-secondary/60 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        inputFieldClassName,
        "h-8 py-1 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
