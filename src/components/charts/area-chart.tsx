"use client";

import * as React from "react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipContent } from "@/components/charts/chart-tooltip";
import { cn } from "@/lib/utils";

interface Series {
  key: string;
  name: string;
  color: string;
  strokeWidth?: number;
}

interface AreaChartProps {
  data: Array<Record<string, number | string>>;
  series: Series[];
  height?: number;
  xKey?: string;
  className?: string;
  tickFormatter?: (value: number) => string;
  xTickFormatter?: (value: string) => string;
}

export function AreaChart({
  data,
  series,
  height = 280,
  xKey = "date",
  className,
  tickFormatter,
  xTickFormatter,
}: AreaChartProps) {
  return (
    <div className={cn("chart-draw min-w-0", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={xTickFormatter}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={tickFormatter}
          />
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 2}
              fill={`url(#grad-${s.key})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
