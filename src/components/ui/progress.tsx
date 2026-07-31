"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  const progressStyle = { width: `${value || 0}%` } as React.CSSProperties;
  (progressStyle as Record<string, string>)["--progress-value"] = `${value || 0}%`;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "bg-primary h-full animate-progress-fill transition-all",
          indicatorClassName
        )}
        style={progressStyle}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
