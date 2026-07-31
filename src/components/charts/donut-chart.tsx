"use client";

import * as React from "react";
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltipContent, getChartColor } from "@/components/charts/chart-tooltip";
import { CountUp } from "@/components/shared/count-up";

interface DonutChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  height = 220,
  colors,
  innerRadius = 58,
  outerRadius = 82,
  className,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  return (
    <div className={className} style={{ height, position: "relative" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Tooltip content={<ChartTooltipContent />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={colors?.[index] ?? getChartColor(index)} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <CountUp value={centerValue} className="text-xl font-semibold tabular-nums" />
          {centerLabel && (
            <span className="text-muted-foreground text-xs">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
