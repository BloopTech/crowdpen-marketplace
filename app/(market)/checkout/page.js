"use client"

import React, { useEffect, useMemo, useRef, useState, useActionState, useCallback } from "react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Separator } from "../../components/ui/separator"
import { Checkbox } from "../../components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group"
import { CreditCard, Lock, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import MarketplaceHeader from "../../components/marketplace-header"
import Script from "next/script"
import PaymentResultModal from "../../components/payment-result-modal"
import { CartContextProvider, useCart } from "../cart/context"
import { useSession } from "next-auth/react"
import { useHome } from "../../context"
import { beginCheckout, finalizeOrder } from "./actions"

function CheckoutContent() {
  const { data: session } = useSession()
  const { openLoginDialog } = useHome()
  const { cartItems, cartSummary, isLoading, isError, error } = useCart()

  const [searchQuery, setSearchQuery] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("startbutton")
  const [startButtonLoaded, setStartButtonLoaded] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [resultModal, setResultModal] = useState({ open: false, type: "success", title: "", message: "", orderNumber: "", details: null })
  const launchedRef = useRef(false)
  const currentOrderRef = useRef(null)
  const finalizeStartedRef = useRef(false)

  const [beginState, beginAction, beginPending] = useActionState(beginCheckout, { success: false, message: "" })
  const [finalState, finalizeAction, finalizePending] = useActionState(finalizeOrder, { success: false, message: "" })

  const [formData, setFormData] = useState({
    email: session?.user?.email || "",
    firstName: session?.user?.name?.split(" ")?.[0] || "",
    lastName: session?.user?.name?.split(" ")?.slice(1).join(" ") || "",
    billingAddress: "",
    city: "",
    zipCode: "",
    country: "",
  })

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      email: session?.user?.email || prev.email,
      firstName: session?.user?.name?.split(" ")?.[0] || prev.firstName,
      lastName: session?.user?.name?.split(" ")?.slice(1).join(" ") || prev.lastName,
    }))
  }, [session?.user?.email, session?.user?.name])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const total = useMemo(() => Number(cartSummary?.total || 0) || 0, [cartSummary?.total])
  const subtotal = useMemo(() => Number(cartSummary?.subtotal || 0) || 0, [cartSummary?.subtotal])
  const tax = useMemo(() => Number(cartSummary?.tax || 0) || 0, [cartSummary?.tax])

  // Define finalize and StartButton helpers BEFORE effects that reference them
  const finalize = useCallback(async (status, payload) => {
    try {
      const order = currentOrderRef.current
      if (!order) throw new Error("Missing order context")
      const fd = new FormData()
      fd.set("orderId", order.orderId)
      fd.set("status", status)
      fd.set("reference", payload?.reference || payload?.data?.reference || payload?.txRef || payload?.ref || "")
      fd.set("payload", JSON.stringify(payload || {}))
      fd.set("email", formData.email)
      finalizeStartedRef.current = true
      finalizeAction(fd)
    } finally {
      setProcessing(false)
    }
  }, [finalizeAction, formData.email])

  function getStartButtonApi() {
    if (typeof window === "undefined") return null
    console.log("window START", window.StartButton || window.SBCheckout || window.sb || window.StartButtonCheckout)
    return window.StartButton || window.SBCheckout || window.sb || window.StartButtonCheckout || null
  }

  const openStartButton = useCallback((order) => {
    try {
      const api = getStartButtonApi()
      console.log("start API", api)
      if (!api) throw new Error("Payment gateway not available")

      const config = {
        amount: order.amount,
        currency: order.currency,
        reference: order.orderNumber,
        customer: {
          email: order.customer?.email || formData.email,
          name: `${order.customer?.firstName || formData.firstName} ${order.customer?.lastName || formData.lastName}`.trim(),
        },
        metadata: { orderId: order.orderId },
      }

      const callbacks = {
        onSuccess: (res) => finalize("success", res),
        onError: (err) => finalize("error", err),
        onClose: () => setProcessing(false),
      }

      let ret
      if (typeof api === "function") ret = api(config, callbacks)
      else if (typeof api.open === "function") ret = api.open(config, callbacks)
      else if (typeof api.checkout === "function") ret = api.checkout(config, callbacks)
      else if (typeof api.start === "function") ret = api.start(config, callbacks)
      else throw new Error("Unsupported payment SDK interface")

      if (ret && typeof ret.then === "function") {
        ret.then((r) => finalize("success", r)).catch((e) => finalize("error", e))
      }

      const handleMessage = (event) => {
        try {
          const d = event?.data
          const isSB = typeof d === "object" && (d?.source === "startbutton" || d?.provider === "startbutton")
          if (!isSB) return
          if (d?.status === "success") finalize("success", d)
          else if (d?.status === "error") finalize("error", d)
        } catch {}
      }
      window.addEventListener("message", handleMessage, { once: true })
    } catch (e) {
      setProcessing(false)
      setResultModal({ open: true, type: "error", title: "Payment unavailable", message: e?.message || "Payment SDK not available" })
    }
  }, [finalize, formData.email, formData.firstName, formData.lastName])

  // Detect StartButton SDK readiness without inline onLoad handler
  useEffect(() => {
    let tries = 0
    const maxTries = 40 // ~10s at 250ms interval
    const id = setInterval(() => {
      const api = getStartButtonApi()
      if (api) {
        setStartButtonLoaded(true)
        clearInterval(id)
      } else if (++tries >= maxTries) {
        clearInterval(id)
      }
    }, 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (beginState?.success && !launchedRef.current) {
      launchedRef.current = true
      const order = {
        orderId: beginState.orderId,
        orderNumber: beginState.orderNumber,
        amount: beginState.amount,
        currency: beginState.currency || "GHS",
        customer: beginState.customer,
      }
      currentOrderRef.current = order
      setProcessing(true)
      openStartButton(order)
    } else if (beginState?.message && beginState?.success === false && !beginPending) {
      setResultModal({
        open: true,
        type: "error",
        title: "Checkout Error",
        message: beginState.message || "Unable to start checkout",
        details: null,
      })
    }
  }, [beginState, beginPending, openStartButton])

  useEffect(() => {
    if (!finalState || typeof finalState.success === "undefined" || !finalizeStartedRef.current) return
    const order = currentOrderRef.current
    if (finalState.success) {
      setResultModal({
        open: true,
        type: "success",
        title: "Payment successful",
        message: finalState?.message || "Your order has been placed successfully.",
        orderNumber: finalState?.orderNumber || order?.orderNumber,
        details: null,
      })
    } else {
      setResultModal({
        open: true,
        type: "error",
        title: "Payment failed",
        message: finalState?.message || "We couldn't confirm your payment.",
        orderNumber: order?.orderNumber,
        details: null,
      })
    }
    // reset gate so initial render doesn't trigger
    finalizeStartedRef.current = false
  }, [finalState])


  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MarketplaceHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Store
              </Button>
            </Link>
          </div>
          <div className="flex justify-center">
            <Button onClick={openLoginDialog} className="bg-tertiary text-white">Sign in to checkout</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Script src="https://checkout.startbutton.tech/version.latest/sb-web-sdk.min.js" strategy="afterInteractive" />

      <MarketplaceHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={() => {}} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/cart">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Checkout Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Secure Checkout
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={beginAction} className="space-y-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Contact Information</h3>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" name="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder="you@email.com" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" name="firstName" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" name="lastName" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} required />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Method (StartButton) */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Payment Method</h3>
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                      <div className="flex items-center space-x-2 p-3 border border-slate-300 rounded-lg w-full justify-between">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="startbutton" id="startbutton" />
                          <Label htmlFor="startbutton" className="flex items-center gap-2 cursor-pointer">
                            <CreditCard className="h-4 w-4" />
                            Pay with card / bank (StartButton)
                          </Label>
                        </div>
                        {!startButtonLoaded && (
                          <span className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading gateway…</span>
                        )}
                      </div>
                    </RadioGroup>
                    <div className="text-xs text-muted-foreground">You’ll complete your payment securely in a hosted StartButton checkout.</div>
                    <input type="hidden" name="paymentMethod" value="startbutton" />
                  </div>

                  <Separator />

                  {/* Billing Address */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Billing Address</h3>
                    <div>
                      <Label htmlFor="billingAddress">Address</Label>
                      <Input id="billingAddress" name="billingAddress" value={formData.billingAddress} onChange={(e) => handleInputChange("billingAddress", e.target.value)} placeholder="123 Main Street" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input id="city" name="city" value={formData.city} onChange={(e) => handleInputChange("city", e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="zipCode">ZIP Code</Label>
                        <Input id="zipCode" name="zipCode" value={formData.zipCode} onChange={(e) => handleInputChange("zipCode", e.target.value)} required />
                      </div>
                    </div>
                    <input type="hidden" name="country" value={formData.country || "NG"} />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" required />
                    <Label htmlFor="terms" className="text-sm">
                      I agree to the{" "}
                      <Link href="/terms" className="text-tertiary hover:underline">Terms of Service</Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-tertiary hover:underline">Privacy Policy</Link>
                    </Label>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={beginPending || finalizePending || isLoading || !cartItems?.length || !startButtonLoaded}>
                    {beginPending || finalizePending ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</span>
                    ) : (
                      <>Complete Purchase - ${total.toFixed(2)}</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {isLoading && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading cart…</div>
                  )}
                  {isError && (
                    <div className="text-sm text-red-600">{error?.message || "Failed to load cart"}</div>
                  )}
                  {!isLoading && !isError && cartItems?.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm">
                      <span className="truncate pr-2">{it?.product?.title || it?.name || "Item"} × {it.quantity}</span>
                      <span>${Number(it.price).toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-green-800 mb-1">What happens next?</div>
                  <div className="text-xs text-green-700 space-y-1">
                    <div>✓ Instant receipt sent to your email</div>
                    <div>✓ Access purchases in your account</div>
                    <div>✓ Secure, encrypted payment</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center">🔒 Your payment information is secure and encrypted</div>
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
  )
}

export default function CheckoutPage() {
  return (
    <CartContextProvider>
      <CheckoutContent />
    </CartContextProvider>
  )
}
