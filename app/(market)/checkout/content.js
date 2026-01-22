"use client";

import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { Checkbox } from "../../components/ui/checkbox";
import { Lock, ArrowLeft, Loader2, X } from "lucide-react";
import Link from "next/link";
import MarketplaceHeader from "../../components/marketplace-header";
import PaymentResultModal from "../../components/payment-result-modal";
import Image from "next/image";
import { useCheckout } from "./context";

export default function CheckoutContent() {
  const {
    session,
    openLoginDialog,
    cartItems,
    isLoading,
    isError,
    error,

    searchQuery,
    setSearchQuery,
    activePaymentProvider,
    paymentProviderLoaded,
    startButtonLoaded,
    processing,

    resultModal,
    setResultModal,

    closePos,
    cancelStartButton,

    beginAction,
    beginPending,
    finalizePending,
    handleBeginSubmit,

    existingOrderId,

    formData,
    handleInputChange,

    subtotal,
    total,
    fmt,
  } = useCheckout();

  const selectedProvider = (activePaymentProvider || "startbutton").toString().toLowerCase();
  const providerLabel = selectedProvider === "paystack" ? "Paystack" : "StartButton";
  const requiresStartButton = selectedProvider === "startbutton";

  if (!session) {
    return (
      <div className="min-h-screen bg-background" data-testid="checkout-page">
        <MarketplaceHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={() => {}}
        />
        <div className="container mx-auto px-4 py-8" data-testid="checkout-container">
          <div className="flex items-center gap-2 mb-6" data-testid="checkout-header">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="checkout-back-store">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Store
              </Button>
            </Link>
          </div>
          <div className="flex justify-center">
            <Button
              onClick={openLoginDialog}
              className="bg-tertiary text-white"
              data-testid="checkout-signin"
            >
              Sign in to checkout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full" data-testid="checkout-page">
      {(beginPending || processing) && (
        <>
          <button
            type="button"
            onClick={cancelStartButton}
            className="cursor-pointer fixed z-100005 px-2 py-2 rounded-full bg-background text-foreground text-sm shadow-lg border border-border hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="checkout-cancel-payment"
            style={{
              top: closePos?.top ?? 24,
              left: closePos?.left ?? undefined,
              right: closePos ? "auto" : 24,
            }}
          >
            <X className="h-4 w-4" />
          </button>
          <div
            className="fixed inset-0 z-100005 flex items-center justify-center pointer-events-none"
            data-testid="checkout-processing-overlay"
          >
            <Image
              src="https://res.cloudinary.com/dsuwnvwo1/image/upload/v1731081972/pf6c5fzwp29p8fmloiku.gif"
              alt=""
              width={48}
              height={48}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </>
      )}
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
      />

      <div className="container mx-auto px-4 py-8" data-testid="checkout-container">
        <div className="flex items-center gap-2 mb-6" data-testid="checkout-header">
          <Link href="/cart">
            <Button variant="ghost" size="sm" data-testid="checkout-back-cart">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" data-testid="checkout-layout">
          {/* Checkout Form */}
          <div className="space-y-6">
            <Card data-testid="checkout-card">
              <CardHeader data-testid="checkout-card-header">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Secure Checkout
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action={beginAction}
                  onSubmit={handleBeginSubmit}
                  className="space-y-6"
                  data-testid="checkout-form"
                >
                  <input
                    type="hidden"
                    name="existingOrderId"
                    value={existingOrderId || ""}
                  />
                  {/* Contact Information */}
                  <div className="space-y-4" data-testid="checkout-contact">
                    <h3 className="font-semibold" data-testid="checkout-contact-title">
                      Contact Information
                    </h3>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        placeholder="you@email.com"
                        required
                        data-testid="checkout-email"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={(e) =>
                            handleInputChange("firstName", e.target.value)
                          }
                          required
                          data-testid="checkout-first-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={(e) =>
                            handleInputChange("lastName", e.target.value)
                          }
                          required
                          data-testid="checkout-last-name"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Method (StartButton) */}
                  <div className="space-y-4" data-testid="checkout-payment-method">
                    {/* <h3 className="font-semibold">Payment Method</h3>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <div className="flex items-center space-x-2 p-3 border border-border rounded-lg w-full justify-between">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            value="startbutton"
                            id="startbutton"
                          />
                          <Label
                            htmlFor="startbutton"
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <CreditCard className="h-4 w-4" />
                            Pay with card / bank (StartButton)
                          </Label>
                        </div>
                        {!startButtonLoaded && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading
                            gateway…
                          </span>
                        )}
                      </div>
                    </RadioGroup> */}
                    <div className="text-xs text-muted-foreground" data-testid="checkout-payment-note">
                      You&apos;ll complete your payment securely in a hosted {providerLabel} checkout.
                    </div>
                    <input
                      type="hidden"
                      name="paymentMethod"
                      value={selectedProvider}
                    />
                  </div>

                  <Separator />

                  {/* Billing Address */}
                  <div className="space-y-4" data-testid="checkout-billing">
                    <h3 className="font-semibold" data-testid="checkout-billing-title">
                      Billing Address
                    </h3>
                    <div>
                      <Label htmlFor="billingAddress">Address</Label>
                      <Input
                        id="billingAddress"
                        name="billingAddress"
                        value={formData.billingAddress}
                        onChange={(e) =>
                          handleInputChange("billingAddress", e.target.value)
                        }
                        placeholder="123 Main Street"
                        required
                        data-testid="checkout-address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={(e) =>
                            handleInputChange("city", e.target.value)
                          }
                          required
                          data-testid="checkout-city"
                        />
                      </div>
                      <div>
                        <Label htmlFor="zipCode">ZIP Code</Label>
                        <Input
                          id="zipCode"
                          name="zipCode"
                          value={formData.zipCode}
                          onChange={(e) =>
                            handleInputChange("zipCode", e.target.value)
                          }
                          required
                          data-testid="checkout-zip"
                        />
                      </div>
                    </div>
                    <input
                      type="hidden"
                      name="country"
                      value={formData.country || "NG"}
                    />
                  </div>

                  <div className="flex items-center space-x-2" data-testid="checkout-terms-row">
                    <Checkbox id="terms" required data-testid="checkout-terms" />
                    <Label htmlFor="terms" className="text-sm">
                      I agree to the{" "}
                      <Link
                        href="/terms"
                        className="text-tertiary hover:underline"
                        data-testid="checkout-terms-link"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        className="text-tertiary hover:underline"
                        data-testid="checkout-privacy-link"
                      >
                        Privacy Policy
                      </Link>
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={
                      beginPending ||
                      finalizePending ||
                      processing ||
                      isLoading ||
                      !cartItems?.length ||
                      !paymentProviderLoaded ||
                      (requiresStartButton && !startButtonLoaded)
                    }
                    data-testid="checkout-submit"
                  >
                    {beginPending || finalizePending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                      </span>
                    ) : (
                      <>Complete Purchase - {fmt(total)}</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card data-testid="checkout-summary">
              <CardHeader data-testid="checkout-summary-header">
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4" data-testid="checkout-summary-content">
                <div className="space-y-3" data-testid="checkout-summary-lines">
                  {isLoading && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading cart…
                    </div>
                  )}
                  {isError && (
                    <div className="text-sm text-red-600" data-testid="checkout-summary-error">
                      {error?.message || "Failed to load cart"}
                    </div>
                  )}
                  {!isLoading &&
                    !isError &&
                    cartItems?.map((it) => (
                      <div key={it.id} className="flex justify-between text-sm" data-testid={`checkout-summary-item-${it.id}`}>
                        <span className="truncate pr-2">
                          {it?.product?.title || it?.name || "Item"} ×{" "}
                          {it.quantity}
                        </span>
                        <span>{fmt(it.price)}</span>
                      </div>
                    ))}
                  <Separator />
                  <div className="flex justify-between" data-testid="checkout-summary-subtotal">
                    <span>Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg" data-testid="checkout-summary-total">
                    <span>Total</span>
                    <span>{fmt(total)}</span>
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg" data-testid="checkout-summary-next">
                  <div
                    className="text-sm font-medium text-green-800 mb-1"
                    data-testid="checkout-summary-next-title"
                  >
                    What happens next?
                  </div>
                  <div className="text-xs text-green-700 space-y-1" data-testid="checkout-summary-next-list">
                    <div>✓ Instant receipt sent to your email</div>
                    <div>✓ Access purchases in your account</div>
                    <div>✓ Secure, encrypted payment</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center" data-testid="checkout-summary-security">
                  🔒 Your payment information is secure and encrypted
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <PaymentResultModal
        open={resultModal.open}
        onOpenChange={(o) => setResultModal((s) => ({ ...s, open: o }))}
        type={resultModal.type}
        title={resultModal.title}
        message={resultModal.message}
        orderNumber={resultModal.orderNumber}
        details={resultModal.details}
      />
    </div>
  );
}
