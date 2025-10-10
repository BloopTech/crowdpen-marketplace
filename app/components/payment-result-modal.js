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
      <DialogContent className="max-w-md bg-white border-0 shadow-2xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            {isSuccess && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </span>
            )}
            {isError && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              </span>
            )}
            <span>{title || (isSuccess ? "Payment successful" : isError ? "Payment failed" : "Processing payment")}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {message || (isSuccess ? "Your order has been placed successfully." : isError ? "We couldn't complete your payment." : "Please wait while we confirm your payment.")}
          </DialogDescription>
        </DialogHeader>

        {orderNumber && (
          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
            <div className="text-gray-700">Order number</div>
            <div className="font-semibold text-gray-900">{orderNumber}</div>
          </div>
        )}

        {details && (
          <div className="mt-4 text-sm text-gray-700 space-y-1">
            {typeof details === "string" ? (
              <p className="break-words">{details}</p>
            ) : (
              <pre className="bg-gray-50 rounded-md p-3 text-xs overflow-auto max-h-48">
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
              <Button variant={isError ? "destructive" : "default"}>{isError ? "Close" : "Continue"}</Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
