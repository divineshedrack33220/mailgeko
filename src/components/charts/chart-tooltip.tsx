"use client";

import * as React from "react";
import { formatNumber } from "@/lib/format";

interface TooltipEntry {
  name: string;
  value: number | string;
  color?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; fill?: string }>;
  label?: string;
  formatter?: (value: number | string, name: string) => string;
}) {
  if (!active || !payload?.length) return null;

  const entries: TooltipEntry[] = payload
    .filter((p) => p.value !== undefined && p.value !== null)
    .map((p) => ({
      name: p.name ?? "",
      value: p.value as number | string,
      color: p.color ?? p.fill,
    }));

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 shadow-lg">
      {label && <p className="mb-1.5 text-xs font-medium">{label}</p>}
      <div className="space-y-1">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="text-xs font-semibold tabular-nums">
              {formatter
                ? formatter(entry.value, entry.name)
                : typeof entry.value === "number"
                  ? formatNumber(entry.value)
                  : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const chartColors = {
  primary: "var(--chart-1)",
  lime: "var(--chart-2)",
  blue: "var(--chart-3)",
  amber: "var(--chart-4)",
  violet: "var(--chart-5)",
};

export function getChartColor(index: number): string {
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  return colors[index % colors.length];
}
