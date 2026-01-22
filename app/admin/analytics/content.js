"use client";
import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "../../components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useAdminAnalytics } from "./context";

export default function AdminAnalyticsContent(props) {
  const {
    loading,
    revenueTotals,
    topMerchants,
    topProducts,
    chartConfig,
    chartData,
    timeToPayout,
    refundReasonRows,
    funnel,
    inventoryRiskRows,
    cohortRows,
    summary,
    couponTotals,
    couponRows,
    paymentMethods,
    customers,
    categoryRows,
    paymentStatusRows,
    setQs,
    revenueQuery,
    topMerchantsQuery,
    topProductsQuery,
    summaryQuery,
    funnelQuery,
    cohortsQuery,
    couponsQuery,
    paymentStatusQuery,
    categoryBreakdownQuery,
    customersQuery,
    paymentMethodQuery,
    inventoryRiskQuery,
    timeToPayoutQuery,
    refundReasonsQuery,
    qs,
    fmtMoney,
    fmtPeriod,
    revenueData,
    crowdpenFeePercent,
    startbuttonFeePercent,
    interval
  } = useAdminAnalytics();

  const crowdpenFeeLabel = `${Math.round(crowdpenFeePercent * 100)}%`;
  const startbuttonFeeLabel = `${Math.round(startbuttonFeePercent * 100)}%`;

  const totalRevenueValue = Number(revenueTotals?.revenue || 0);
  const totalCrowdpenShare = Number(revenueTotals?.crowdpenFee || 0) || 0;
  const totalStartbuttonShare = Number(revenueTotals?.startbuttonFee || 0) || 0;
  const totalCreatorShare = Number(revenueTotals?.creatorPayout || 0) || 0;

  const grossRevenueValue = Number(summary?.grossRevenue || 0);
  const netRevenueValue = Number(summary?.netRevenue || 0);
  const refundRevenueValue = Number(summary?.refundRevenue || 0);
  const aovValue = Number(summary?.aov || 0);

  return (
    <div className="px-4 space-y-6 pb-8" data-testid="admin-analytics-page">
      <Card data-testid="admin-analytics-filters-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Analytics</CardTitle>
            <Button
              onClick={() => {
                revenueQuery.refetch();
                summaryQuery.refetch();
                topProductsQuery.refetch();
                topMerchantsQuery.refetch();
                paymentStatusQuery.refetch();
                categoryBreakdownQuery.refetch();
                customersQuery.refetch();
                paymentMethodQuery.refetch();
                couponsQuery.refetch();
                cohortsQuery.refetch();
                inventoryRiskQuery.refetch();
                funnelQuery.refetch();
                refundReasonsQuery.refetch();
                timeToPayoutQuery.refetch();
              }}
              disabled={loading}
              data-testid="admin-analytics-refresh"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs mb-1">From</label>
              <input
                type="date"
                value={qs.from || ""}
                onChange={(e) => setQs({ from: e.target.value })}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-analytics-from"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={qs.to || ""}
                onChange={(e) => setQs({ to: e.target.value })}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="admin-analytics-to"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Interval</label>
              <Select
                value={interval}
                onValueChange={(v) => setQs({ interval: v })}
              >
                <SelectTrigger className="w-40" data-testid="admin-analytics-interval">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs mb-1">Top list size</label>
              <Select
                value={String(qs.limit || 10)}
                onValueChange={(v) => setQs({ limit: Number(v) })}
              >
                <SelectTrigger className="w-28" data-testid="admin-analytics-limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="admin-analytics-summary-card">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryQuery.isLoading ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              data-testid="admin-analytics-summary-loading"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[84px] w-full" />
              ))}
            </div>
          ) : summaryQuery.error ? (
            <div className="text-sm text-red-500" data-testid="admin-analytics-summary-error">
              {summaryQuery.error?.message || "Failed to load"}
            </div>
          ) : summary ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              data-testid="admin-analytics-summary-grid"
            >
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-paid-orders"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-paid-orders-label"
                >
                  Paid Orders
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-paid-orders-value"
                >
                  {Number(summary.paidOrders || 0).toLocaleString("en-US")}
                </div>
              </div>
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-units"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-units-label"
                >
                  Units Sold
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-units-value"
                >
                  {Number(summary.unitsSold || 0).toLocaleString("en-US")}
                </div>
              </div>
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-gross"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-gross-label"
                >
                  Gross Revenue
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-gross-value"
                >
                  {fmtMoney(summary.grossRevenue)}
                </div>
              </div>
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-aov"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-aov-label"
                >
                  AOV
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-aov-value"
                >
                  {fmtMoney(summary.aov)}
                </div>
              </div>
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-refunded-orders"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-refunded-orders-label"
                >
                  Refunded Orders
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-refunded-orders-value"
                >
                  {Number(summary.refundedOrders || 0).toLocaleString("en-US")}
                </div>
              </div>
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-refund-amount"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-refund-amount-label"
                >
                  Refund Amount
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-refund-amount-value"
                >
                  {fmtMoney(summary.refundRevenue)}
                </div>
              </div>
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-net"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-net-label"
                >
                  Net Revenue
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-net-value"
                >
                  {fmtMoney(summary.netRevenue)}
                </div>
              </div>
              <div
                className="rounded border border-border p-3"
                data-testid="admin-analytics-summary-payout-coverage"
              >
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-payout-coverage-label"
                >
                  Payout Coverage
                </div>
                <div
                  className="text-base font-semibold"
                  data-testid="admin-analytics-summary-payout-coverage-value"
                >
                  {new Intl.NumberFormat("en-US", {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(Number(summary.payoutCoverage || 0) || 0)}
                </div>
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="admin-analytics-summary-payout-coverage-note"
                >
                  Completed payouts vs expected creator payout
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground" data-testid="admin-analytics-summary-empty">
              No summary data.
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="admin-analytics-revenue-card">
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueQuery.isLoading ? (
            <div className="space-y-3" data-testid="admin-analytics-revenue-loading">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : revenueQuery.error ? (
            <div className="text-sm text-red-500" data-testid="admin-analytics-revenue-error">
              {revenueQuery.error?.message || "Failed to load"}
            </div>
          ) : (
            <div className="space-y-4">
              {revenueTotals && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
                  data-testid="admin-analytics-revenue-totals"
                >
                  <div
                    className="rounded border border-border p-3"
                    data-testid="admin-analytics-revenue-total"
                  >
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid="admin-analytics-revenue-total-label"
                    >
                      Total Revenue
                    </div>
                    <div
                      className="text-base font-semibold"
                      data-testid="admin-analytics-revenue-total-value"
                    >
                      {fmtMoney(totalRevenueValue)}
                    </div>
                  </div>
                  <div
                    className="rounded border border-border p-3"
                    data-testid="admin-analytics-revenue-crowdpen"
                  >
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid="admin-analytics-revenue-crowdpen-label"
                    >
                      Crowdpen Share ({crowdpenFeeLabel})
                    </div>
                    <div
                      className="text-base font-semibold"
                      data-testid="admin-analytics-revenue-crowdpen-value"
                    >
                      {fmtMoney(totalCrowdpenShare)}
                    </div>
                  </div>
                  <div
                    className="rounded border border-border p-3"
                    data-testid="admin-analytics-revenue-startbutton"
                  >
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid="admin-analytics-revenue-startbutton-label"
                    >
                      Startbutton Share ({startbuttonFeeLabel})
                    </div>
                    <div
                      className="text-base font-semibold"
                      data-testid="admin-analytics-revenue-startbutton-value"
                    >
                      {fmtMoney(totalStartbuttonShare)}
                    </div>
                  </div>
                  <div
                    className="rounded border border-border p-3"
                    data-testid="admin-analytics-revenue-merchant"
                  >
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid="admin-analytics-revenue-merchant-label"
                    >
                      Merchant Payout
                    </div>
                    <div
                      className="text-base font-semibold"
                      data-testid="admin-analytics-revenue-merchant-value"
                    >
                      {fmtMoney(totalCreatorShare)}
                    </div>
                  </div>
                  <div
                    className="rounded border border-border p-3"
                    data-testid="admin-analytics-revenue-split"
                  >
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid="admin-analytics-revenue-split-label"
                    >
                      Fee Split
                    </div>
                    <div
                      className="text-sm font-semibold text-muted-foreground"
                      data-testid="admin-analytics-revenue-split-value"
                    >
                      {crowdpenFeeLabel} Crowdpen / {startbuttonFeeLabel} Startbutton
                    </div>
                    <div
                      className="text-xs text-muted-foreground"
                      data-testid="admin-analytics-revenue-split-note"
                    >
                      Based on each transaction&apos;s platform fee
                    </div>
                  </div>
                </div>
              )}

              <ChartContainer
                id="admin-revenue"
                config={chartConfig}
                className="h-[320px]"
                data-testid="admin-analytics-revenue-chart"
              >
                <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={fmtPeriod}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(Number(v || 0))
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          const label =
                            chartConfig?.[name]?.label || String(name);
                          return (
                            <div className="flex flex-1 justify-between gap-4">
                              <span className="text-muted-foreground">
                                {label}
                              </span>
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                {fmtMoney(value)}
                              </span>
                            </div>
                          );
                        }}
                        labelFormatter={(v) => fmtPeriod(v)}
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
                  <Line
                    type="monotone"
                    dataKey="creatorPayout"
                    stroke="var(--color-creatorPayout)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="crowdpenFee"
                    stroke="var(--color-crowdpenFee)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="startbuttonFee"
                    stroke="var(--color-startbuttonFee)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </LineChart>
              </ChartContainer>

              {revenueData.length > 0 && (
                <div
                  className="overflow-x-auto rounded-md border border-border"
                  data-testid="admin-analytics-revenue-table"
                >
                  <Table data-testid="admin-analytics-revenue-table-inner">
                    <TableHeader data-testid="admin-analytics-revenue-table-head">
                      <TableRow data-testid="admin-analytics-revenue-table-head-row">
                        <TableHead data-testid="admin-analytics-revenue-table-head-period">
                          Period
                        </TableHead>
                        <TableHead
                          className="text-right"
                          data-testid="admin-analytics-revenue-table-head-gross"
                        >
                          Gross Revenue
                        </TableHead>
                        <TableHead
                          className="text-right"
                          data-testid="admin-analytics-revenue-table-head-crowdpen"
                        >
                          Crowdpen Share ({crowdpenFeeLabel})
                        </TableHead>
                        <TableHead
                          className="text-right"
                          data-testid="admin-analytics-revenue-table-head-startbutton"
                        >
                          Startbutton Share ({startbuttonFeeLabel})
                        </TableHead>
                        <TableHead
                          className="text-right"
                          data-testid="admin-analytics-revenue-table-head-payout"
                        >
                          Merchant Payout
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody data-testid="admin-analytics-revenue-table-body">
                      {revenueData.map((entry) => {
                        const periodLabel = fmtPeriod(entry.period);
                        const revenueValue = Number(entry.revenue || 0);
                        const entryCrowdpen = Number(entry.crowdpenFee || 0) || 0;
                        const entryStartbutton = Number(entry.startbuttonFee || 0) || 0;
                        const entryCreator = Number(entry.creatorPayout || 0) || 0;
                        return (
                          <TableRow
                            key={`${entry.period}-${entry.revenue}`}
                            data-testid={`admin-analytics-revenue-row-${entry.period}`}
                          >
                            <TableCell data-testid={`admin-analytics-revenue-row-${entry.period}-period`}>
                              {periodLabel}
                            </TableCell>
                            <TableCell
                              className="text-right"
                              data-testid={`admin-analytics-revenue-row-${entry.period}-gross`}
                            >
                              {fmtMoney(revenueValue)}
                            </TableCell>
                            <TableCell
                              className="text-right"
                              data-testid={`admin-analytics-revenue-row-${entry.period}-crowdpen`}
                            >
                              {fmtMoney(entryCrowdpen)}
                            </TableCell>
                            <TableCell
                              className="text-right"
                              data-testid={`admin-analytics-revenue-row-${entry.period}-startbutton`}
                            >
                              {fmtMoney(entryStartbutton)}
                            </TableCell>
                            <TableCell
                              className="text-right"
                              data-testid={`admin-analytics-revenue-row-${entry.period}-payout`}
                            >
                              {fmtMoney(entryCreator)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {revenueData.length === 0 && (
                <div
                  className="text-sm text-muted-foreground"
                  data-testid="admin-analytics-revenue-empty"
                >
                  No revenue data for the selected time range.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="admin-analytics-top-products-card">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProductsQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-top-products-loading"
              />
            ) : topProductsQuery.error ? (
              <div className="text-sm text-red-500" data-testid="admin-analytics-top-products-error">
                {topProductsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-top-products-table">
                <TableHeader data-testid="admin-analytics-top-products-head">
                  <TableRow data-testid="admin-analytics-top-products-head-row">
                    <TableHead data-testid="admin-analytics-top-products-head-product">Product</TableHead>
                    <TableHead data-testid="admin-analytics-top-products-head-merchant">Merchant</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-products-head-units"
                    >
                      Units
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-products-head-revenue"
                    >
                      Revenue
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-products-head-payout"
                    >
                      Payout
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-top-products-body">
                  {topProducts.map((p) => (
                    <TableRow key={p.id} data-testid={`admin-analytics-top-product-row-${p.id}`}>
                      <TableCell data-testid={`admin-analytics-top-product-row-${p.id}-product`}>
                        <div
                          className="font-medium max-w-[240px] truncate"
                          title={p.title}
                          data-testid={`admin-analytics-top-product-row-${p.id}-title`}
                        >
                          {p.title}
                        </div>
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid={`admin-analytics-top-product-row-${p.id}-product-id`}
                        >
                          {p.productId ? `ID: ${p.productId}` : ""}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`admin-analytics-top-product-row-${p.id}-merchant`}>
                        {p.merchantPenName ||
                          p.merchantName ||
                          p.merchantId ||
                          "-"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-product-row-${p.id}-units`}
                      >
                        {Number(p.unitsSold || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-product-row-${p.id}-revenue`}
                      >
                        {fmtMoney(p.revenue, p.currency)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-product-row-${p.id}-payout`}
                      >
                        {fmtMoney(p.creatorPayout, p.currency)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-product-row-${p.id}-crowdpen`}
                      >
                        {fmtMoney(p.crowdpenFee, p.currency)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-product-row-${p.id}-startbutton`}
                      >
                        {fmtMoney(p.startbuttonFee, p.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topProducts.length === 0 && (
                    <TableRow data-testid="admin-analytics-top-products-empty">
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No products.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card data-testid="admin-analytics-top-merchants-card">
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {topMerchantsQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-top-merchants-loading"
              />
            ) : topMerchantsQuery.error ? (
              <div
                className="text-sm text-red-500"
                data-testid="admin-analytics-top-merchants-error"
              >
                {topMerchantsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-top-merchants-table">
                <TableHeader data-testid="admin-analytics-top-merchants-head">
                  <TableRow data-testid="admin-analytics-top-merchants-head-row">
                    <TableHead data-testid="admin-analytics-top-merchants-head-merchant">
                      Merchant
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-orders"
                    >
                      Orders
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-units"
                    >
                      Units
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-revenue"
                    >
                      Revenue
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-coupon"
                    >
                      Coupon Discounts
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-crowdpen-discount"
                    >
                      Crowdpen-Funded Discounts
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-payout"
                    >
                      Payout
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-crowdpen-fee"
                    >
                      Crowdpen Fee ({crowdpenFeeLabel})
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-top-merchants-head-startbutton-fee"
                    >
                      Startbutton Fee ({startbuttonFeeLabel})
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-top-merchants-body">
                  {topMerchants.map((m) => (
                    <TableRow key={m.id} data-testid={`admin-analytics-top-merchant-row-${m.id}`}>
                      <TableCell data-testid={`admin-analytics-top-merchant-row-${m.id}-merchant`}>
                        <div
                          className="font-medium"
                          data-testid={`admin-analytics-top-merchant-row-${m.id}-name`}
                        >
                          {m.penName || m.name || m.id}
                        </div>
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid={`admin-analytics-top-merchant-row-${m.id}-email`}
                        >
                          {m.email || ""}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-orders`}
                      >
                        {Number(m.orderCount || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-units`}
                      >
                        {Number(m.unitsSold || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-revenue`}
                      >
                        {fmtMoney(m.revenue)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-coupon`}
                      >
                        {fmtMoney(m.discountTotal)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-crowdpen-discount`}
                      >
                        {fmtMoney(m.discountCrowdpenFunded)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-payout`}
                      >
                        {fmtMoney(m.creatorPayout)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-crowdpen-fee`}
                      >
                        {fmtMoney(m.crowdpenFee)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        data-testid={`admin-analytics-top-merchant-row-${m.id}-startbutton-fee`}
                      >
                        {fmtMoney(m.startbuttonFee)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topMerchants.length === 0 && (
                    <TableRow data-testid="admin-analytics-top-merchants-empty">
                      <TableCell
                        colSpan={9}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No merchants.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card data-testid="admin-analytics-funnel-card">
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelQuery.isLoading ? (
              <Skeleton className="h-64 w-full" data-testid="admin-analytics-funnel-loading" />
            ) : funnelQuery.error ? (
              <div className="text-sm text-red-500" data-testid="admin-analytics-funnel-error">
                {funnelQuery.error?.message || "Failed to load"}
              </div>
            ) : funnel?.stages?.length ? (
              <Table data-testid="admin-analytics-funnel-table">
                <TableHeader data-testid="admin-analytics-funnel-head">
                  <TableRow data-testid="admin-analytics-funnel-head-row">
                    <TableHead data-testid="admin-analytics-funnel-head-stage">Stage</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-funnel-head-users"
                    >
                      Unique Users
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-funnel-body">
                  {(funnel.stages || []).map((r) => (
                    <TableRow
                      key={r.event_name}
                      data-testid={`admin-analytics-funnel-row-${r.event_name}`}
                    >
                      <TableCell className="capitalize">
                        {String(r.event_name || "").replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.count || 0).toLocaleString("en-US")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div
                className="text-sm text-muted-foreground"
                data-testid="admin-analytics-funnel-empty"
              >
                No funnel data.
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="admin-analytics-time-to-payout-card">
          <CardHeader>
            <CardTitle>Time to Payout</CardTitle>
          </CardHeader>
          <CardContent>
            {timeToPayoutQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-time-to-payout-loading"
              />
            ) : timeToPayoutQuery.error ? (
              <div
                className="text-sm text-red-500"
                data-testid="admin-analytics-time-to-payout-error"
              >
                {timeToPayoutQuery.error?.message || "Failed to load"}
              </div>
            ) : timeToPayout?.summary ? (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                data-testid="admin-analytics-time-to-payout-summary"
              >
                <div data-testid="admin-analytics-time-to-payout-p50">
                  <div className="text-sm text-muted-foreground">
                    P50 (hours)
                  </div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.p50Hours || 0).toFixed(1)}
                  </div>
                </div>
                <div data-testid="admin-analytics-time-to-payout-p90">
                  <div className="text-sm text-muted-foreground">
                    P90 (hours)
                  </div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.p90Hours || 0).toFixed(1)}
                  </div>
                </div>
                <div data-testid="admin-analytics-time-to-payout-average">
                  <div className="text-sm text-muted-foreground">
                    Average (hours)
                  </div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.avgHours || 0).toFixed(1)}
                  </div>
                </div>
                <div data-testid="admin-analytics-time-to-payout-count">
                  <div className="text-sm text-muted-foreground">Samples</div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.count || 0).toLocaleString(
                      "en-US"
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="text-sm text-muted-foreground"
                data-testid="admin-analytics-time-to-payout-empty"
              >
                No payout allocation data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card data-testid="admin-analytics-refunds-card">
          <CardHeader>
            <CardTitle>Refund Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            {refundReasonsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" data-testid="admin-analytics-refunds-loading" />
            ) : refundReasonsQuery.error ? (
              <div className="text-sm text-red-500" data-testid="admin-analytics-refunds-error">
                {refundReasonsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-refunds-table">
                <TableHeader data-testid="admin-analytics-refunds-head">
                  <TableRow data-testid="admin-analytics-refunds-head-row">
                    <TableHead data-testid="admin-analytics-refunds-head-category">Category</TableHead>
                    <TableHead data-testid="admin-analytics-refunds-head-reason">Reason</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-refunds-head-count"
                    >
                      Count
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-refunds-head-amount"
                    >
                      Refund Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-refunds-body">
                  {refundReasonRows.map((r, idx) => (
                    <TableRow
                      key={`${r.reasonCategory}-${r.reason}-${idx}`}
                      data-testid={`admin-analytics-refund-row-${idx}`}
                    >
                      <TableCell>{r.reasonCategory}</TableCell>
                      <TableCell>{r.reason}</TableCell>
                      <TableCell className="text-right">
                        {Number(r.count || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(Number(r.refundAmount || 0), "USD")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {refundReasonRows.length === 0 && (
                    <TableRow data-testid="admin-analytics-refunds-empty">
                      <TableCell
                        colSpan={4}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No refunds found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="admin-analytics-payment-status-card">
          <CardHeader>
            <CardTitle>Payment Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentStatusQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-payment-status-loading"
              />
            ) : paymentStatusQuery.error ? (
              <div
                className="text-sm text-red-500"
                data-testid="admin-analytics-payment-status-error"
              >
                {paymentStatusQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-payment-status-table">
                <TableHeader data-testid="admin-analytics-payment-status-head">
                  <TableRow data-testid="admin-analytics-payment-status-head-row">
                    <TableHead data-testid="admin-analytics-payment-status-head-status">Status</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-status-head-orders"
                    >
                      Orders
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-status-head-revenue"
                    >
                      Gross Revenue
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-status-head-discount"
                    >
                      Discount
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-status-head-paid"
                    >
                      Buyer Paid
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-payment-status-body">
                  {paymentStatusRows.map((r) => (
                    <TableRow
                      key={r.paymentStatus}
                      data-testid={`admin-analytics-payment-status-row-${r.paymentStatus}`}
                    >
                      <TableCell className="capitalize">
                        {r.paymentStatus}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.orderCount || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.grossRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.discountTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.buyerPaid)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paymentStatusRows.length === 0 && (
                    <TableRow data-testid="admin-analytics-payment-status-empty">
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No orders.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card data-testid="admin-analytics-categories-card">
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdownQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-categories-loading"
              />
            ) : categoryBreakdownQuery.error ? (
              <div
                className="text-sm text-red-500"
                data-testid="admin-analytics-categories-error"
              >
                {categoryBreakdownQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-categories-table">
                <TableHeader data-testid="admin-analytics-categories-head">
                  <TableRow data-testid="admin-analytics-categories-head-row">
                    <TableHead data-testid="admin-analytics-categories-head-category">Category</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-categories-head-units"
                    >
                      Units
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-categories-head-paid"
                    >
                      Buyer Paid
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-categories-body">
                  {categoryRows.map((c) => (
                    <TableRow
                      key={c.id || c.name}
                      data-testid={`admin-analytics-category-row-${c.id || c.name}`}
                    >
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-right">
                        {Number(c.unitsSold || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(c.buyerPaid ?? c.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {categoryRows.length === 0 && (
                    <TableRow data-testid="admin-analytics-categories-empty">
                      <TableCell
                        colSpan={3}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No categories.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1" data-testid="admin-analytics-customers-card">
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {customersQuery.isLoading ? (
              <div className="space-y-3" data-testid="admin-analytics-customers-loading">
                <Skeleton className="h-[84px] w-full" />
                <Skeleton className="h-[84px] w-full" />
                <Skeleton className="h-[84px] w-full" />
              </div>
            ) : customersQuery.error ? (
              <div className="text-sm text-red-500" data-testid="admin-analytics-customers-error">
                {customersQuery.error?.message || "Failed to load"}
              </div>
            ) : customers ? (
              <div className="space-y-3" data-testid="admin-analytics-customers-summary">
                <div
                  className="rounded border border-border p-3"
                  data-testid="admin-analytics-customers-unique"
                >
                  <div className="text-xs text-muted-foreground">
                    Unique Buyers
                  </div>
                  <div className="text-base font-semibold">
                    {Number(customers.uniqueBuyers || 0).toLocaleString(
                      "en-US"
                    )}
                  </div>
                </div>
                <div
                  className="rounded border border-border p-3"
                  data-testid="admin-analytics-customers-repeat"
                >
                  <div className="text-xs text-muted-foreground">
                    Repeat Buyers
                  </div>
                  <div className="text-base font-semibold">
                    {Number(customers.repeatBuyers || 0).toLocaleString(
                      "en-US"
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat("en-US", {
                      style: "percent",
                      maximumFractionDigits: 0,
                    }).format(Number(customers.repeatRate || 0) || 0)}{" "}
                    repeat rate
                  </div>
                </div>
                <div
                  className="rounded border border-border p-3"
                  data-testid="admin-analytics-customers-first-time"
                >
                  <div className="text-xs text-muted-foreground">
                    First-time Buyers
                  </div>
                  <div className="text-base font-semibold">
                    {Number(customers.firstTimeBuyers || 0).toLocaleString(
                      "en-US"
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(customers.ordersPerBuyer || 0).toFixed(2)}{" "}
                    orders/buyer
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="text-sm text-muted-foreground"
                data-testid="admin-analytics-customers-empty"
              >
                No customer data.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="admin-analytics-payment-methods-card">
          <CardHeader>
            <CardTitle>Payment Methods (Paid Orders)</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethodQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-payment-methods-loading"
              />
            ) : paymentMethodQuery.error ? (
              <div
                className="text-sm text-red-500"
                data-testid="admin-analytics-payment-methods-error"
              >
                {paymentMethodQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-payment-methods-table">
                <TableHeader data-testid="admin-analytics-payment-methods-head">
                  <TableRow data-testid="admin-analytics-payment-methods-head-row">
                    <TableHead data-testid="admin-analytics-payment-methods-head-method">Method</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-methods-head-orders"
                    >
                      Orders
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-methods-head-revenue"
                    >
                      Gross Revenue
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-methods-head-discount"
                    >
                      Discount
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-payment-methods-head-paid"
                    >
                      Buyer Paid
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-payment-methods-body">
                  {paymentMethods.map((r) => (
                    <TableRow
                      key={r.paymentMethod}
                      data-testid={`admin-analytics-payment-method-row-${r.paymentMethod}`}
                    >
                      <TableCell className="capitalize">
                        {r.paymentMethod}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.orderCount || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.grossRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.discountTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(r.buyerPaid)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paymentMethods.length === 0 && (
                    <TableRow data-testid="admin-analytics-payment-methods-empty">
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No paid orders.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="admin-analytics-coupons-card">
          <CardHeader>
            <CardTitle>Coupons (Paid Orders)</CardTitle>
          </CardHeader>
          <CardContent>
            {couponsQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-coupons-loading"
              />
            ) : couponsQuery.error ? (
              <div className="text-sm text-red-500" data-testid="admin-analytics-coupons-error">
                {couponsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <div className="space-y-3">
                {couponTotals && (
                  <div
                    className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                    data-testid="admin-analytics-coupons-totals"
                  >
                    <div
                      className="rounded border border-border p-3"
                      data-testid="admin-analytics-coupons-orders"
                    >
                      <div className="text-xs text-muted-foreground">
                        Coupon Orders
                      </div>
                      <div className="text-base font-semibold">
                        {Number(couponTotals.orderCount || 0).toLocaleString(
                          "en-US"
                        )}
                      </div>
                    </div>
                    <div
                      className="rounded border border-border p-3"
                      data-testid="admin-analytics-coupons-discount"
                    >
                      <div className="text-xs text-muted-foreground">
                        Total Discount
                      </div>
                      <div className="text-base font-semibold">
                        {fmtMoney(couponTotals.discountTotal)}
                      </div>
                    </div>
                    <div
                      className="rounded border border-border p-3"
                      data-testid="admin-analytics-coupons-buyer-paid"
                    >
                      <div className="text-xs text-muted-foreground">
                        Total Buyer Paid
                      </div>
                      <div className="text-base font-semibold">
                        {fmtMoney(couponTotals.buyerPaid)}
                      </div>
                    </div>
                  </div>
                )}

                <Table data-testid="admin-analytics-coupons-table">
                  <TableHeader data-testid="admin-analytics-coupons-head">
                    <TableRow data-testid="admin-analytics-coupons-head-row">
                      <TableHead data-testid="admin-analytics-coupons-head-code">Code</TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-analytics-coupons-head-orders"
                      >
                        Orders
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-analytics-coupons-head-revenue"
                      >
                        Gross Revenue
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-analytics-coupons-head-discount"
                      >
                        Discount
                      </TableHead>
                      <TableHead
                        className="text-right"
                        data-testid="admin-analytics-coupons-head-paid"
                      >
                        Buyer Paid
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody data-testid="admin-analytics-coupons-body">
                    {couponRows.map((r) => (
                      <TableRow
                        key={r.couponCode}
                        data-testid={`admin-analytics-coupon-row-${r.couponCode}`}
                      >
                        <TableCell className="font-mono">
                          {r.couponCode}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.orderCount || 0).toLocaleString("en-US")}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(r.grossRevenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(r.discountTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(r.buyerPaid)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {couponRows.length === 0 && (
                      <TableRow data-testid="admin-analytics-coupons-empty">
                        <TableCell
                          colSpan={5}
                          className="text-center text-sm text-muted-foreground"
                        >
                          No coupon usage.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="admin-analytics-cohorts-card">
          <CardHeader>
            <CardTitle>Cohort Retention (W1/W2/W4)</CardTitle>
          </CardHeader>
          <CardContent>
            {cohortsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" data-testid="admin-analytics-cohorts-loading" />
            ) : cohortsQuery.error ? (
              <div className="text-sm text-red-500" data-testid="admin-analytics-cohorts-error">
                {cohortsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-cohorts-table">
                <TableHeader data-testid="admin-analytics-cohorts-head">
                  <TableRow data-testid="admin-analytics-cohorts-head-row">
                    <TableHead data-testid="admin-analytics-cohorts-head-cohort">Cohort</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-cohorts-head-users"
                    >
                      Users
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-analytics-cohorts-head-w1">
                      W1
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-analytics-cohorts-head-w2">
                      W2
                    </TableHead>
                    <TableHead className="text-right" data-testid="admin-analytics-cohorts-head-w4">
                      W4
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-cohorts-body">
                  {cohortRows.map((r) => (
                    <TableRow
                      key={r.cohortPeriod}
                      data-testid={`admin-analytics-cohort-row-${r.cohortPeriod}`}
                    >
                      <TableCell>
                        {r.cohortPeriod
                          ? new Date(r.cohortPeriod).toLocaleDateString(
                              "en-US",
                              { timeZone: "UTC" }
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.cohortSize || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat("en-US", {
                          style: "percent",
                          maximumFractionDigits: 0,
                        }).format(Number(r.retainedRateW1 || 0) || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat("en-US", {
                          style: "percent",
                          maximumFractionDigits: 0,
                        }).format(Number(r.retainedRateW2 || 0) || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat("en-US", {
                          style: "percent",
                          maximumFractionDigits: 0,
                        }).format(Number(r.retainedRateW4 || 0) || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cohortRows.length === 0 && (
                    <TableRow data-testid="admin-analytics-cohorts-empty">
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No cohort data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card data-testid="admin-analytics-inventory-card">
          <CardHeader>
            <CardTitle>Inventory Risk</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryRiskQuery.isLoading ? (
              <Skeleton
                className="h-64 w-full"
                data-testid="admin-analytics-inventory-loading"
              />
            ) : inventoryRiskQuery.error ? (
              <div
                className="text-sm text-red-500"
                data-testid="admin-analytics-inventory-error"
              >
                {inventoryRiskQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table data-testid="admin-analytics-inventory-table">
                <TableHeader data-testid="admin-analytics-inventory-head">
                  <TableRow data-testid="admin-analytics-inventory-head-row">
                    <TableHead data-testid="admin-analytics-inventory-head-risk">Risk</TableHead>
                    <TableHead data-testid="admin-analytics-inventory-head-product">Product</TableHead>
                    <TableHead data-testid="admin-analytics-inventory-head-merchant">Merchant</TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-inventory-head-stock"
                    >
                      Stock
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-inventory-head-units"
                    >
                      Units (30d)
                    </TableHead>
                    <TableHead
                      className="text-right"
                      data-testid="admin-analytics-inventory-head-coverage"
                    >
                      Coverage (days)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="admin-analytics-inventory-body">
                  {inventoryRiskRows.map((r) => (
                    <TableRow key={r.id} data-testid={`admin-analytics-inventory-row-${r.id}`}>
                      <TableCell className="capitalize">{r.risk}</TableCell>
                      <TableCell>
                        <div
                          className="font-medium max-w-[220px] truncate"
                          title={r.title}
                        >
                          {r.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.productId ? `ID: ${r.productId}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.merchantPenName ||
                          r.merchantName ||
                          r.merchantId ||
                          "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.stock == null
                          ? "-"
                          : Number(r.stock).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.unitsSoldWindow || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.coverageDays == null
                          ? "-"
                          : Number(r.coverageDays).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {inventoryRiskRows.length === 0 && (
                    <TableRow data-testid="admin-analytics-inventory-empty">
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No inventory risks found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
