"use client";

import * as React from "react";
import { useCountUp } from "@/hooks/use-count-up";

function parseNumber(value: string): { num: number; decimals: number; suffix: string } | null {
  const match = value.match(/^(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const raw = match[1].replace(/,/g, "");
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;
  const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
  return { num, decimals, suffix: match[2] };
}

export function CountUp({
  value,
  className,
  duration,
}: {
  value: string;
  className?: string;
  duration?: number;
}) {
  const parsed = React.useMemo(() => parseNumber(value), [value]);
  const count = useCountUp(parsed?.num ?? 0, duration);

  if (!parsed) {
    return <span className={className}>{value}</span>;
  }

  const formatted = count.toLocaleString("en-US", {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
  });

  return (
    <span className={className}>
      {formatted}
      {parsed.suffix}
    </span>
  );
}
