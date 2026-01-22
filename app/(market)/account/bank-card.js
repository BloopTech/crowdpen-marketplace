"use client";

import React, { useEffect, useMemo, useState, useActionState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { AlertCircle, Banknote, Check, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "./context";
import { upsertBank } from "./action";

// No manual currency/country selection; currency and country are derived server-side

export default function BankDetailsCard() {
  const {
    bank,
    kyc,
    accountQuery,
    payoutType,
    setPayoutType,
    bankListQuery,
    loadingBanks,
    banks,
  } = useAccount();

  // server action wiring
  const initialState = { success: false, message: "", errors: {} };
  const [actionState, formAction, isPending] = useActionState(
    upsertBank,
    initialState
  );
  useEffect(() => {
    if (
      Object.keys(actionState?.data || {}).length > 0 &&
      actionState.message
    ) {
      toast.success(actionState.message || "Bank details saved");
      accountQuery.refetch();
      setEditing(false);
    } else if (
      Object.keys(actionState?.errors || {}).length > 0 &&
      actionState.message
    ) {
      toast.error(actionState.message);
    }
  }, [actionState, accountQuery]);

  // local form state
  const [currency, setCurrency] = useState(bank?.currency || "");
  const [countryCode, setCountryCode] = useState(bank?.country_code || "");
  const [selectedBank, setSelectedBank] = useState(
    bank?.bank_code
      ? { code: bank.bank_code, id: bank.bank_id, name: bank.bank_name }
      : null
  );
  const [accountNumber, setAccountNumber] = useState(""); // never prefill for safety
  const [msisdn, setMsisdn] = useState(bank?.msisdn || "");
  const [bankFilter, setBankFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [verifying, setVerifying] = useState(false);
  const [verifiedName, setVerifiedName] = useState("");
  const [verified, setVerified] = useState(!!bank?.verified);
  const [editing, setEditing] = useState(!bank); // if no bank, open form by default

  useEffect(() => {
    setCurrency(bank?.currency || "");
    setCountryCode(bank?.country_code || "");
    setSelectedBank(
      bank?.bank_code
        ? { code: bank.bank_code, id: bank.bank_id, name: bank.bank_name }
        : null
    );
    setMsisdn(bank?.msisdn || "");
    setVerified(!!bank?.verified);
    setVerifiedName(bank?.account_name || "");
    setAccountNumber("");
  }, [
    bank?.currency,
    bank?.country_code,
    bank?.bank_code,
    bank?.bank_id,
    bank?.bank_name,
    bank?.msisdn,
    bank?.verified,
    bank?.account_name,
  ]);

  // Load bank list based on server-derived location; no manual currency/country
  useEffect(() => {
    if (bankListQuery?.data?.currency) {
      setCurrency(bankListQuery.data.currency);
    }
    if (bankListQuery?.data?.countryCode) {
      setCountryCode(bankListQuery.data.countryCode);
    }
  }, [bankListQuery?.data?.currency, bankListQuery?.data?.countryCode]);

  // Show loading state or fallback if detection takes too long
  const isDetecting = loadingBanks && !currency;

  useEffect(() => {
    if (payoutType !== "bank" && payoutType !== "mobile_money") {
      setCurrency("");
      setCountryCode("");
    }
  }, [payoutType]);

  // Reset verify state when sensitive inputs change
  useEffect(() => {
    setVerified(false);
    setVerifiedName("");
  }, [selectedBank?.code, accountNumber, currency]);

  const canVerify = useMemo(() => {
    return payoutType === "bank" && !!selectedBank?.code && !!accountNumber;
  }, [payoutType, selectedBank?.code, accountNumber]);

  const filteredBanks = useMemo(() => {
    const f = bankFilter.toLowerCase().trim();
    if (!f) return banks;
    return banks.filter(
      (b) =>
        String(b.name || "")
          .toLowerCase()
          .includes(f) ||
        String(b.code || "")
          .toLowerCase()
          .includes(f)
    );
  }, [bankFilter, banks]);

  const handleVerify = async () => {
    if (!canVerify) return;
    setVerifying(true);
    try {
      const qs = new URLSearchParams({
        bankCode: String(selectedBank.code),
        accountNumber: String(accountNumber),
      });
      if (countryCode) qs.set("countryCode", String(countryCode));
      const res = await fetch(
        `/api/marketplace/startbutton/verify?${qs.toString()}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.status === "success" && data?.data?.account_name) {
        setVerifiedName(data.data.account_name);
        setVerified(true);
        toast.success("Account verified");
      } else {
        setVerified(false);
        setVerifiedName("");
        toast.error(data?.message || "Unable to verify account");
      }
    } catch (err) {
      setVerified(false);
      setVerifiedName("");
      toast.error(
        err?.message === "Failed to fetch"
          ? "Unable to verify account. Please check your connection and try again."
          : (err?.message || "Unable to verify account")
      );
    } finally {
      setVerifying(false);
    }
  };

  const summary = bank
    ? `${bank.bank_name || bank.payout_type?.toUpperCase()} •••• ${bank.account_number_last4 || ""} • ${bank.currency}`
    : "No payout method on file";

  return (
    <Card data-testid="bank-details-card">
      <CardHeader data-testid="bank-details-header">
        <CardTitle
          className="flex items-center gap-2"
          data-testid="bank-details-title"
        >
          <Banknote className="h-5 w-5" /> Payout Bank Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5" data-testid="bank-details-content">
        <div
          className="p-3 rounded-md border border-border bg-muted/50 text-muted-foreground text-sm flex items-start gap-3"
          data-testid="bank-details-info"
        >
          <Shield className="h-4 w-4 mt-0.5 text-emerald-600" />
          <div>
            Your bank details are encrypted at rest and only used when we
            process payouts to you.
          </div>
        </div>

        <div className="flex items-center justify-between" data-testid="bank-details-summary">
          <div className="text-sm text-foreground" data-testid="bank-details-current">
            <span className="font-medium">Current:</span> {summary}
          </div>
          <div className="flex items-center gap-2">
            {bank?.verified ? (
              <Badge variant="secondary" data-testid="bank-details-verified">
                Verified
              </Badge>
            ) : bank ? (
              <Badge variant="outline" data-testid="bank-details-unverified">
                Unverified
              </Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing((v) => !v)}
              data-testid="bank-details-toggle"
            >
              {editing ? "Close" : bank ? "Edit" : "Add"}
            </Button>
          </div>
        </div>

        {editing && (
          <form action={formAction} className="space-y-5" data-testid="bank-details-form">
            <input
              type="hidden"
              name="verified"
              value={verified ? "true" : "false"}
            />
            <input
              type="hidden"
              name="account_name"
              value={verified && verifiedName ? verifiedName : ""}
            />
            <div className="grid sm:grid-cols-3 gap-4">
              <div data-testid="bank-details-payout-type-field">
                <Label data-testid="bank-details-payout-type-label">Payout Type</Label>
                <Select
                  value={payoutType}
                  onValueChange={(v) => setPayoutType(v)}
                >
                  <SelectTrigger data-testid="bank-details-payout-type">
                    <SelectValue placeholder="Select payout type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank" data-testid="bank-details-payout-option-bank">
                      Bank
                    </SelectItem>
                    <SelectItem
                      value="mobile_money"
                      data-testid="bank-details-payout-option-mobile-money"
                    >
                      Mobile Money
                    </SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="payout_type" value={payoutType} />
              </div>
              <div className="sm:col-span-2" data-testid="bank-details-region">
                <Label data-testid="bank-details-region-label">Detected Region</Label>
                <div className="text-sm text-muted-foreground mt-2" data-testid="bank-details-region-status">
                  {currency ? (
                    <span data-testid="bank-details-region-values">
                      Currency: <span className="font-medium">{currency}</span>
                      {countryCode ? (
                        <span className="ml-2">
                          Country:{" "}
                          <span className="font-medium">{countryCode}</span>
                        </span>
                      ) : null}
                    </span>
                  ) : loadingBanks ? (
                    <span
                      className="text-muted-foreground flex items-center gap-2"
                      data-testid="bank-details-region-loading"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" /> Detecting region...
                    </span>
                  ) : (
                    <span className="text-amber-600" data-testid="bank-details-region-fallback">
                      Region not detected. Using default (NGN).
                    </span>
                  )}
                </div>
                <input type="hidden" name="currency" value={currency} />
                <input type="hidden" name="country_code" value={countryCode} />
              </div>
            </div>

            {(payoutType === "bank" || payoutType === "mobile_money") && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div data-testid="bank-details-bank-field">
                  <Label data-testid="bank-details-bank-label">
                    {payoutType === "bank" ? "Bank" : "Operator (MoMo)"}
                  </Label>
                  <Select
                    value={selectedBank?.code ? String(selectedBank.code) : ""}
                    onValueChange={(v) => {
                      const b = banks.find(
                        (x) => String(x.code ?? "") === String(v)
                      );
                      setSelectedBank(b || null);
                    }}
                    onOpenChange={(open) => {
                      if (open) {
                        setVisibleCount(10);
                        setBankFilter("");
                      }
                    }}
                  >
                    <SelectTrigger data-testid="bank-details-bank-select">
                      <SelectValue
                        placeholder={loadingBanks ? "Loading..." : "Select"}
                      />
                    </SelectTrigger>
                    <SelectContent data-testid="bank-details-bank-options">
                      <div className="sticky top-0 z-10 p-2 bg-popover border-b border-border">
                        <Input
                          autoFocus
                          placeholder="Type to search..."
                          value={bankFilter}
                          onChange={(e) => {
                            setBankFilter(e.target.value);
                            setVisibleCount(10);
                          }}
                          data-testid="bank-details-bank-search"
                        />
                      </div>
                      {filteredBanks.slice(0, visibleCount).map((b) => (
                        <SelectItem
                          key={String(b.code)}
                          value={String(b.code)}
                          data-testid={`bank-details-bank-option-${b.code}`}
                        >
                          {b.name} ({b.code})
                        </SelectItem>
                      ))}
                      {filteredBanks.length > visibleCount && (
                        <div
                          className="px-3 py-2 text-center text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setVisibleCount((c) => c + 10);
                          }}
                          data-testid="bank-details-bank-show-more"
                        >
                          Show more ({filteredBanks.length - visibleCount} more)
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="bank_code"
                    value={selectedBank?.code || ""}
                  />
                  <input
                    type="hidden"
                    name="bank_id"
                    value={selectedBank?.id || ""}
                  />
                  <input
                    type="hidden"
                    name="bank_name"
                    value={selectedBank?.name || ""}
                  />
                </div>

                {payoutType === "bank" ? (
                  <div data-testid="bank-details-account-number-field">
                    <Label data-testid="bank-details-account-number-label">Account Number</Label>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder={
                        bank?.account_number_last4
                          ? `•••• ${bank.account_number_last4}`
                          : "Enter account number"
                      }
                      inputMode="numeric"
                      maxLength={16}
                      data-testid="bank-details-account-number"
                    />
                    <input
                      type="hidden"
                      name="account_number"
                      value={accountNumber}
                    />
                  </div>
                ) : (
                  <div data-testid="bank-details-msisdn-field">
                    <Label data-testid="bank-details-msisdn-label">
                      MSISDN (Mobile Number)
                    </Label>
                    <Input
                      value={msisdn}
                      onChange={(e) => setMsisdn(e.target.value)}
                      placeholder="e.g., 0551234567"
                      data-testid="bank-details-msisdn"
                    />
                    <input type="hidden" name="msisdn" value={msisdn} />
                  </div>
                )}
              </div>
            )}

            {payoutType === "bank" && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleVerify}
                  disabled={!canVerify || verifying}
                  data-testid="bank-details-verify"
                >
                  {verifying ? (
                    <span className="inline-flex items-center">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                      Verifying...
                    </span>
                  ) : (
                    "Verify Account"
                  )}
                </Button>
                {verified && (
                  <span
                    className="inline-flex items-center text-emerald-700 text-sm"
                    data-testid="bank-details-verified-name"
                  >
                    <Check className="h-4 w-4 mr-1" />{" "}
                    {verifiedName || "Verified"}
                  </span>
                )}
                {/* No currency gating. If upstream doesn't support it, server will return an informative error. */}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={isPending}
                data-testid="bank-details-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending || (payoutType === "bank" && !selectedBank?.code)
                }
                data-testid="bank-details-save"
              >
                {isPending ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
