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
    <div className="px-4 space-y-6 pb-8">
      <Card>
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
              />
            </div>
            <div>
              <label className="block text-xs mb-1">To</label>
              <input
                type="date"
                value={qs.to || ""}
                onChange={(e) => setQs({ to: e.target.value })}
                className="border border-border bg-background text-foreground rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Interval</label>
              <Select
                value={interval}
                onValueChange={(v) => setQs({ interval: v })}
              >
                <SelectTrigger className="w-40">
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
                <SelectTrigger className="w-28">
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

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[84px] w-full" />
              ))}
            </div>
          ) : summaryQuery.error ? (
            <div className="text-sm text-red-500">
              {summaryQuery.error?.message || "Failed to load"}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">Paid Orders</div>
                <div className="text-base font-semibold">
                  {Number(summary.paidOrders || 0).toLocaleString("en-US")}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">Units Sold</div>
                <div className="text-base font-semibold">
                  {Number(summary.unitsSold || 0).toLocaleString("en-US")}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">Gross Revenue</div>
                <div className="text-base font-semibold">
                  {fmtMoney(summary.grossRevenue)}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">AOV</div>
                <div className="text-base font-semibold">
                  {fmtMoney(summary.aov)}
                </div>
              </div>

              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">
                  Refunded Orders
                </div>
                <div className="text-base font-semibold">
                  {Number(summary.refundedOrders || 0).toLocaleString("en-US")}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">
                  Refund Amount
                </div>
                <div className="text-base font-semibold">
                  {fmtMoney(summary.refundRevenue)}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">Net Revenue</div>
                <div className="text-base font-semibold">
                  {fmtMoney(summary.netRevenue)}
                </div>
              </div>
              <div className="rounded border border-border p-3">
                <div className="text-xs text-muted-foreground">
                  Payout Coverage
                </div>
                <div className="text-base font-semibold">
                  {new Intl.NumberFormat("en-US", {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(Number(summary.payoutCoverage || 0) || 0)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Completed payouts vs expected creator payout
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No summary data.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : revenueQuery.error ? (
            <div className="text-sm text-red-500">
              {revenueQuery.error?.message || "Failed to load"}
            </div>
          ) : (
            <div className="space-y-4">
              {revenueTotals && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">
                      Total Revenue
                    </div>
                    <div className="text-base font-semibold">
                      {fmtMoney(totalRevenueValue)}
                    </div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">
                      Crowdpen Share ({crowdpenFeeLabel})
                    </div>
                    <div className="text-base font-semibold">
                      {fmtMoney(totalCrowdpenShare)}
                    </div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">
                      Startbutton Share ({startbuttonFeeLabel})
                    </div>
                    <div className="text-base font-semibold">
                      {fmtMoney(totalStartbuttonShare)}
                    </div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">
                      Merchant Payout
                    </div>
                    <div className="text-base font-semibold">
                      {fmtMoney(totalCreatorShare)}
                    </div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-xs text-muted-foreground">
                      Fee Split
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground">
                      {crowdpenFeeLabel} Crowdpen / {startbuttonFeeLabel} Startbutton
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Based on each transaction&apos;s platform fee
                    </div>
                  </div>
                </div>
              )}

              <ChartContainer
                id="admin-revenue"
                config={chartConfig}
                className="h-[320px]"
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
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Gross Revenue</TableHead>
                        <TableHead className="text-right">
                          Crowdpen Share ({crowdpenFeeLabel})
                        </TableHead>
                        <TableHead className="text-right">
                          Startbutton Share ({startbuttonFeeLabel})
                        </TableHead>
                        <TableHead className="text-right">Merchant Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueData.map((entry) => {
                        const periodLabel = fmtPeriod(entry.period);
                        const revenueValue = Number(entry.revenue || 0);
                        const entryCrowdpen = Number(entry.crowdpenFee || 0) || 0;
                        const entryStartbutton = Number(entry.startbuttonFee || 0) || 0;
                        const entryCreator = Number(entry.creatorPayout || 0) || 0;
                        return (
                          <TableRow key={`${entry.period}-${entry.revenue}`}>
                            <TableCell>{periodLabel}</TableCell>
                            <TableCell className="text-right">
                              {fmtMoney(revenueValue)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtMoney(entryCrowdpen)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtMoney(entryStartbutton)}
                            </TableCell>
                            <TableCell className="text-right">
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
                <div className="text-sm text-muted-foreground">
                  No revenue data for the selected time range.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProductsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : topProductsQuery.error ? (
              <div className="text-sm text-red-500">
                {topProductsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div
                          className="font-medium max-w-[240px] truncate"
                          title={p.title}
                        >
                          {p.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.productId ? `ID: ${p.productId}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.merchantPenName ||
                          p.merchantName ||
                          p.merchantId ||
                          "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(p.unitsSold || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(p.revenue, p.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(p.creatorPayout, p.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(p.crowdpenFee, p.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(p.startbuttonFee, p.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topProducts.length === 0 && (
                    <TableRow>
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

        <Card>
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {topMerchantsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : topMerchantsQuery.error ? (
              <div className="text-sm text-red-500">
                {topMerchantsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Coupon Discounts</TableHead>
                    <TableHead className="text-right">Crowdpen-Funded Discounts</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                    <TableHead className="text-right">Crowdpen Fee ({crowdpenFeeLabel})</TableHead>
                    <TableHead className="text-right">Startbutton Fee ({startbuttonFeeLabel})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMerchants.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">
                          {m.penName || m.name || m.id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.email || ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(m.orderCount || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(m.unitsSold || 0).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(m.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(m.discountTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(m.discountCrowdpenFunded)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(m.creatorPayout)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(m.crowdpenFee)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtMoney(m.startbuttonFee)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topMerchants.length === 0 && (
                    <TableRow>
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
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : funnelQuery.error ? (
              <div className="text-sm text-red-500">
                {funnelQuery.error?.message || "Failed to load"}
              </div>
            ) : funnel?.stages?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Unique Users</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(funnel.stages || []).map((r) => (
                    <TableRow key={r.event_name}>
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
              <div className="text-sm text-muted-foreground">
                No funnel data.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time to Payout</CardTitle>
          </CardHeader>
          <CardContent>
            {timeToPayoutQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : timeToPayoutQuery.error ? (
              <div className="text-sm text-red-500">
                {timeToPayoutQuery.error?.message || "Failed to load"}
              </div>
            ) : timeToPayout?.summary ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    P50 (hours)
                  </div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.p50Hours || 0).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    P90 (hours)
                  </div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.p90Hours || 0).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Average (hours)
                  </div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.avgHours || 0).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Samples</div>
                  <div className="text-2xl font-semibold">
                    {Number(timeToPayout.summary.count || 0).toLocaleString(
                      "en-US"
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No payout allocation data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Refund Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            {refundReasonsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : refundReasonsQuery.error ? (
              <div className="text-sm text-red-500">
                {refundReasonsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Refund Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refundReasonRows.map((r, idx) => (
                    <TableRow key={`${r.reasonCategory}-${r.reason}-${idx}`}>
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
                    <TableRow>
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
        <Card>
          <CardHeader>
            <CardTitle>Payment Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentStatusQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : paymentStatusQuery.error ? (
              <div className="text-sm text-red-500">
                {paymentStatusQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Gross Revenue</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Buyer Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentStatusRows.map((r) => (
                    <TableRow key={r.paymentStatus}>
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
                    <TableRow>
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

        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdownQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : categoryBreakdownQuery.error ? (
              <div className="text-sm text-red-500">
                {categoryBreakdownQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Buyer Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRows.map((c) => (
                    <TableRow key={c.id || c.name}>
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
                    <TableRow>
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
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {customersQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-[84px] w-full" />
                <Skeleton className="h-[84px] w-full" />
                <Skeleton className="h-[84px] w-full" />
              </div>
            ) : customersQuery.error ? (
              <div className="text-sm text-red-500">
                {customersQuery.error?.message || "Failed to load"}
              </div>
            ) : customers ? (
              <div className="space-y-3">
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">
                    Unique Buyers
                  </div>
                  <div className="text-base font-semibold">
                    {Number(customers.uniqueBuyers || 0).toLocaleString(
                      "en-US"
                    )}
                  </div>
                </div>
                <div className="rounded border border-border p-3">
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
                <div className="rounded border border-border p-3">
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
              <div className="text-sm text-muted-foreground">
                No customer data.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Payment Methods (Paid Orders)</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethodQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : paymentMethodQuery.error ? (
              <div className="text-sm text-red-500">
                {paymentMethodQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Gross Revenue</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Buyer Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentMethods.map((r) => (
                    <TableRow key={r.paymentMethod}>
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
                    <TableRow>
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

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Coupons (Paid Orders)</CardTitle>
          </CardHeader>
          <CardContent>
            {couponsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : couponsQuery.error ? (
              <div className="text-sm text-red-500">
                {couponsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <div className="space-y-3">
                {couponTotals && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Coupon Orders
                      </div>
                      <div className="text-base font-semibold">
                        {Number(couponTotals.orderCount || 0).toLocaleString(
                          "en-US"
                        )}
                      </div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Total Discount
                      </div>
                      <div className="text-base font-semibold">
                        {fmtMoney(couponTotals.discountTotal)}
                      </div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">
                        Total Buyer Paid
                      </div>
                      <div className="text-base font-semibold">
                        {fmtMoney(couponTotals.buyerPaid)}
                      </div>
                    </div>
                  </div>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Gross Revenue</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Buyer Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {couponRows.map((r) => (
                      <TableRow key={r.couponCode}>
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
                      <TableRow>
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
        <Card>
          <CardHeader>
            <CardTitle>Cohort Retention (W1/W2/W4)</CardTitle>
          </CardHeader>
          <CardContent>
            {cohortsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : cohortsQuery.error ? (
              <div className="text-sm text-red-500">
                {cohortsQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cohort</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">W1</TableHead>
                    <TableHead className="text-right">W2</TableHead>
                    <TableHead className="text-right">W4</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohortRows.map((r) => (
                    <TableRow key={r.cohortPeriod}>
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
                    <TableRow>
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

        <Card>
          <CardHeader>
            <CardTitle>Inventory Risk</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryRiskQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : inventoryRiskQuery.error ? (
              <div className="text-sm text-red-500">
                {inventoryRiskQuery.error?.message || "Failed to load"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Units (30d)</TableHead>
                    <TableHead className="text-right">
                      Coverage (days)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryRiskRows.map((r) => (
                    <TableRow key={r.id}>
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
                    <TableRow>
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
