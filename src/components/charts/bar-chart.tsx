"use client";

import * as React from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { ChartTooltipContent } from "@/components/charts/chart-tooltip";
import { cn } from "@/lib/utils";

interface Series {
  key: string;
  name: string;
  color: string;
}

interface BarChartProps {
  data: Array<Record<string, number | string>>;
  series: Series[];
  height?: number;
  xKey?: string;
  stacked?: boolean;
  className?: string;
  tickFormatter?: (value: number) => string;
  layout?: "horizontal" | "vertical";
}

export function BarChart({
  data,
  series,
  height = 280,
  xKey = "date",
  stacked,
  className,
  tickFormatter,
  layout = "horizontal",
}: BarChartProps) {
  const horizontal = layout === "horizontal";
  return (
    <div className={cn("chart-grow", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          layout={layout}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          {horizontal ? (
            <>
              <XAxis
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={tickFormatter}
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={tickFormatter}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                width={140}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            </>
          )}
          <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
          {series.length > 1 && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
          )}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              stackId={stacked ? "stack" : undefined}
              maxBarSize={24}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
