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
      <DialogContent className="max-w-md rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            {isSuccess && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </span>
            )}
            {isError && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-6 w-6 text-red-600" />
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              </span>
            )}
            <span>{title || (isSuccess ? "Payment successful" : isError ? "Payment failed" : "Processing payment")}</span>
          </DialogTitle>
          <DialogDescription>
            {message || (isSuccess ? "Your order has been placed successfully." : isError ? "We couldn't complete your payment." : "Please wait while we confirm your payment.")}
          </DialogDescription>
        </DialogHeader>

        {orderNumber && (
          <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <div className="text-muted-foreground">Order number</div>
            <div className="font-semibold text-foreground">{orderNumber}</div>
          </div>
        )}

        {details && (
          <div className="mt-4 space-y-1 text-sm text-foreground">
            {typeof details === "string" ? (
              <p className="break-words">{details}</p>
            ) : (
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(details, null, 2)}
              </pre>
            )}
          </div>
        )}

        <DialogFooter className="mt-6">
          {actions?.length ? (
            actions.map((a, idx) => (
              <Button
                key={idx}
                onClick={a.onClick}
                variant={a.variant || (isError ? "destructive" : "default")}
                className={a.className}
              >
                {a.icon === "external" && <ExternalLink className="h-4 w-4 mr-2" />}
                {a.label}
              </Button>
            ))
          ) : (
            <DialogClose asChild>
              <Button variant={isError ? "destructive" : "default"} asChild>
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
