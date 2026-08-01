import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GeckoMark } from "@/components/brand/gecko-mark";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: React.ComponentType<{ className?: string }>;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  icon: Icon,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center",
        compact ? "py-8" : "py-16",
        className
      )}
    >
      <div className="bg-secondary text-secondary-foreground mb-4 flex size-12 items-center justify-center rounded-2xl">
        {Icon ? <Icon className="size-6" /> : <GeckoMark className="size-7 text-current" />}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel &&
        (actionHref ? (
          <Button asChild className="mt-5">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button onClick={onAction} className="mt-5">
            {actionLabel}
          </Button>
        ))}
    </div>
  );
}
