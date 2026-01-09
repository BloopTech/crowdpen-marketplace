"use client";
import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  DollarSign,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Banknote,
  PiggyBank,
} from "lucide-react";
import { useAccount } from "../context";
import BankDetailsCard from "../bank-card";

export default function PayoutsTab() {
  const { payoutSummary, payoutTransactions } = useAccount();

  const analytics = useMemo(() => {
    const s = payoutSummary || {};
    const lastDate = s?.lastPayoutDate ? new Date(s.lastPayoutDate) : null;
    return {
      totalEarnings: Number(s.totalEarnings || 0),
      settledEarnings: Number(s.settledEarnings || 0),
      pendingPayout: Number(s.availableToWithdraw || 0),
      withdrawalDeficit: Number(s.withdrawalDeficit || 0),
      lastPayout: Number(s.lastPayout || 0),
      lastPayoutDate: lastDate
        ? lastDate.toISOString().slice(0, 10)
        : "-",
      thisMonthEarnings: Number(s.thisMonthEarnings || 0),
      lastMonthEarnings: Number(s.lastMonthEarnings || 0),
      growthPercent: Number(s.growthPercent || 0),
      pendingSettlement: Number(s.pendingSettlement || 0),
    };
  }, [payoutSummary]);

  const transactions = useMemo(() => {
    const rows = Array.isArray(payoutTransactions) ? payoutTransactions : [];
    return rows.map((tx) => {
      const d = tx?.createdAt ? new Date(tx.createdAt) : null;
      return {
        id: tx?.id,
        date: d ? d.toISOString().slice(0, 10) : "-",
        amount: Number(tx?.amount || 0),
        status: String(tx?.status || "").toLowerCase() || "pending",
        reference: tx?.transaction_reference || tx?.id,
      };
    });
  }, [payoutTransactions]);

  const fmt = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (payoutSummary?.currency || "USD").toString().toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-linear-to-br from-emerald-50 to-emerald-100 border-emerald-200 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-medium truncate">Settled Earnings</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-900 dark:text-emerald-300 mt-1">{fmt(analytics.settledEarnings)}</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 truncate">Eligible for payout</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-slate-50 to-slate-100 border-slate-200 dark:from-slate-500/10 dark:to-slate-500/5 dark:border-slate-500/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium truncate">Pending Settlement</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{fmt(analytics.pendingSettlement)}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 truncate">Paid, awaiting settlement</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-slate-500/20 flex items-center justify-center shrink-0">
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-emerald-50 to-emerald-100 border-emerald-200 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-medium truncate">Total Earnings</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-900 dark:text-emerald-300 mt-1">{fmt(analytics.totalEarnings)}</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 truncate">Settled + pending settlement</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Payout */}
        <Card className="bg-linear-to-br from-amber-50 to-amber-100 border-amber-200 dark:from-amber-500/10 dark:to-amber-500/5 dark:border-amber-500/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 font-medium truncate">Available to Withdraw</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-900 dark:text-amber-300 mt-1">{fmt(analytics.pendingPayout)}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {analytics.withdrawalDeficit > 0 ? (
          <Card className="bg-linear-to-br from-red-50 to-red-100 border-red-200 dark:from-red-500/10 dark:to-red-500/5 dark:border-red-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 font-medium truncate">Negative Balance</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-900 dark:text-red-300 mt-1">{fmt(analytics.withdrawalDeficit)}</p>
                  <p className="text-[11px] text-red-700/80 dark:text-red-400/80 mt-1 truncate">
                    Refunds/reversals exceeded settled earnings
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* This Month */}
        <Card className="bg-linear-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-500/10 dark:to-blue-500/5 dark:border-blue-500/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400 font-medium truncate">This Month (Settled)</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-900 dark:text-blue-300 mt-1">{fmt(analytics.thisMonthEarnings)}</p>
                <div className="flex items-center mt-1">
                  {analytics.growthPercent >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-600 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                  )}
                  <span className={`text-xs ${analytics.growthPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.abs(analytics.growthPercent).toFixed(1)}% vs last month
                  </span>
                </div>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Payout */}
        <Card className="bg-linear-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-500/10 dark:to-purple-500/5 dark:border-purple-500/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-400 font-medium truncate">Last Payout</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-900 dark:text-purple-300 mt-1">{fmt(analytics.lastPayout)}</p>
                <p className="text-xs text-purple-600 mt-1">{analytics.lastPayoutDate}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <Banknote className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Details Card */}
      <BankDetailsCard />

      {/* Payout Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payout History
          </CardTitle>
          <CardDescription>
            View your past payout transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PiggyBank className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payout transactions yet</p>
              <p className="text-sm mt-1">Your earnings will appear here once you start making sales</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium">Payout</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{tx.date}</span>
                        <span className="text-xs">•</span>
                        <span className="text-xs">{tx.reference}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold">{fmt(tx.amount)}</span>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
