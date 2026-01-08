"use client";

import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../../components/ui/chart";

export default function MerchantRevenueChart({ rows }) {
  const chartConfig = useMemo(
    () => ({
      revenue: {
        label: "Revenue",
        color: "hsl(var(--primary))",
      },
    }),
    []
  );

  const data = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return arr
      .map((r) => {
        const d = r?.period ? new Date(r.period) : null;
        const label = d && Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
        return {
          period: label,
          revenue: Number(r?.revenue || 0) || 0,
          unitsSold: Number(r?.unitsSold || 0) || 0,
        };
      })
      .filter((r) => r.period);
  }, [rows]);

  const fmtUsd = (v) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));
  };

  return (
    <ChartContainer className="h-[240px] w-full" config={chartConfig}>
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => fmtUsd(v)}
          width={90}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                if (name === "revenue") {
                  return (
                    <div className="flex w-full flex-1 justify-between leading-none">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {fmtUsd(value)}
                      </span>
                    </div>
                  );
                }
                if (name === "unitsSold") {
                  return (
                    <div className="flex w-full flex-1 justify-between leading-none">
                      <span className="text-muted-foreground">Units</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {Number(value || 0).toLocaleString("en-US")}
                      </span>
                    </div>
                  );
                }
                return null;
              }}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
