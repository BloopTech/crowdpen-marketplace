"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function PaymentResultModal({
  open,
  onOpenChange,
  type = "success", // 'success' | 'error' | 'processing'
  title,
  message,
  details,
  orderNumber,
  actions = [], // [{ label, onClick, variant }]
}) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const isProcessing = type === "processing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl p-6 shadow-2xl"
        data-testid="payment-result-modal"
      >
        <DialogHeader data-testid="payment-result-header">
          <DialogTitle
            className="flex items-center gap-3 text-xl font-bold"
            data-testid="payment-result-title"
          >
            {isSuccess && (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10"
                data-testid="payment-result-icon-success"
              >
                <CheckCircle className="h-6 w-6 text-green-600" />
              </span>
            )}
            {isError && (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10"
                data-testid="payment-result-icon-error"
              >
                <XCircle className="h-6 w-6 text-red-600" />
              </span>
            )}
            {isProcessing && (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10"
                data-testid="payment-result-icon-processing"
              >
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              </span>
            )}
            <span>{title || (isSuccess ? "Payment successful" : isError ? "Payment failed" : "Processing payment")}</span>
          </DialogTitle>
          <DialogDescription data-testid="payment-result-message">
            {message || (isSuccess ? "Your order has been placed successfully." : isError ? "We couldn't complete your payment." : "Please wait while we confirm your payment.")}
          </DialogDescription>
        </DialogHeader>

        {orderNumber && (
          <div
            className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm"
            data-testid="payment-result-order"
          >
            <div className="text-muted-foreground" data-testid="payment-result-order-label">
              Order number
            </div>
            <div className="font-semibold text-foreground" data-testid="payment-result-order-value">
              {orderNumber}
            </div>
          </div>
        )}

        {details && (
          <div
            className="mt-4 space-y-1 text-sm text-foreground"
            data-testid="payment-result-details"
          >
            {typeof details === "string" ? (
              <p className="wrap-break-word" data-testid="payment-result-details-text">
                {details}
              </p>
            ) : (
              <pre
                className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs"
                data-testid="payment-result-details-json"
              >
                {JSON.stringify(details, null, 2)}
              </pre>
            )}
          </div>
        )}

        <DialogFooter className="mt-6" data-testid="payment-result-actions">
          {actions?.length ? (
            actions.map((a, idx) => (
              <Button
                key={idx}
                onClick={a.onClick}
                variant={a.variant || (isError ? "destructive" : "default")}
                className={a.className}
                data-testid={`payment-result-action-${idx}`}
              >
                {a.icon === "external" && <ExternalLink className="h-4 w-4 mr-2" />}
                {a.label}
              </Button>
            ))
          ) : (
            <DialogClose asChild>
              <Button
                variant={isError ? "destructive" : "default"}
                asChild
                data-testid="payment-result-close"
              >
                {isError ? (
                  "Close"
                ) : (
                  <Link href="/account" className="flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Account
                  </Link>
                )}
              </Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
