import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/shared/count-up";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel = "vs last month",
  icon: Icon,
  hint,
  loading,
  className,
}: StatCardProps) {
  const positive = (change ?? 0) >= 0;

  if (loading) {
    return (
      <Card className={cn("gap-3 px-6 py-5", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-32" />
      </Card>
    );
  }

  return (
    <Card className={cn("card-hover gap-3 px-6 py-5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        {Icon && (
          <span className="bg-secondary text-secondary-foreground flex size-8 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <CountUp value={value} className="text-2xl font-semibold tracking-tight" />
        {change !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              positive ? "text-success" : "text-destructive"
            )}
          >
            {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{hint ?? changeLabel}</p>
    </Card>
  );
}
