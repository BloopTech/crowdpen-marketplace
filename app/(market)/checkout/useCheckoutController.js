"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useSession } from "next-auth/react";
import { useHome } from "../../context";
import { useCart } from "../cart/context";
import { beginCheckout, finalizeOrder } from "./actions";
import { useViewerCurrency } from "../../hooks/use-viewer-currency";
import { trackFunnelEvent } from "../../lib/funnelEventsClient";
import { useStartButtonOverlayFix } from "./useStartButtonOverlayFix";

const beginInitializeState = {
  success: false,
  message: "",
};

const finalizeInitializeState = {
  success: false,
  message: "",
};

export function useCheckoutController() {
  const { data: session } = useSession();
  const { openLoginDialog } = useHome();
  const { cartItems, cartSummary, isLoading, isError, error } = useCart();

  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("startbutton");
  const [startButtonLoaded, setStartButtonLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState("");
  const [resultModal, setResultModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
    orderNumber: "",
    details: null,
  });

  const launchedRef = useRef(false);
  const currentOrderRef = useRef(null);
  const finalizeStartedRef = useRef(false);
  const orderCartSignatureRef = useRef("");
  const beginSubmitGuardRef = useRef(false);
  const finalizeGuardRef = useRef({ orderId: "", status: "" });
  const activeStartButtonCleanupRef = useRef(null);

  const [beginState, beginAction, beginPending] = useActionState(
    beginCheckout,
    beginInitializeState
  );
  const [finalState, finalizeAction, finalizePending] = useActionState(
    finalizeOrder,
    finalizeInitializeState
  );
  const [, startFinalizeTransition] = useTransition();

  const [closePos, setClosePos] = useState(null);
  const [, setCspNonce] = useState("");

  const [formData, setFormData] = useState({
    email: session?.user?.email || "",
    firstName: session?.user?.name?.split(" ")?.[0] || "",
    lastName: session?.user?.name?.split(" ")?.slice(1).join(" ") || "",
    billingAddress: "",
    city: "",
    zipCode: "",
    country: "",
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      email: session?.user?.email || prev.email,
      firstName: session?.user?.name?.split(" ")?.[0] || prev.firstName,
      lastName:
        session?.user?.name?.split(" ")?.slice(1).join(" ") || prev.lastName,
    }));
  }, [session?.user?.email, session?.user?.name]);

  useEffect(() => {
    try {
      const el = document.querySelector(
        'script[nonce],style[nonce],link[rel="stylesheet"][nonce],meta[name="csp-nonce"],meta[property="csp-nonce"]'
      );
      const n =
        el?.getAttribute?.("nonce") || el?.getAttribute?.("content") || "";
      if (n) setCspNonce(n);
    } catch {}
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const total = useMemo(
    () => Number(cartSummary?.total || 0) || 0,
    [cartSummary?.total]
  );
  const subtotal = useMemo(
    () => Number(cartSummary?.subtotal || 0) || 0,
    [cartSummary?.subtotal]
  );

  const { viewerCurrency, viewerFxRate } = useViewerCurrency("USD");
  const displayCurrency = (viewerCurrency || "USD").toString().toUpperCase();
  const displayRate =
    Number.isFinite(viewerFxRate) && viewerFxRate > 0 ? viewerFxRate : 1;
  const fmt = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0) * displayRate);

  const extractText = (obj) => {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
    return (
      obj?.message ||
      obj?.error ||
      obj?.status ||
      obj?.data?.message ||
      obj?.data?.error ||
      obj?.data?.status ||
      obj?.reason ||
      obj?.data?.reason ||
      ""
    ).toString();
  };

  const extractReference = (payload) => {
    return (
      payload?.reference ||
      payload?.txRef ||
      payload?.ref ||
      payload?.data?.reference ||
      payload?.data?.txRef ||
      payload?.data?.ref ||
      payload?.data?.transaction?.userTransactionReference ||
      payload?.data?.transaction?.transactionReference ||
      payload?.transaction?.userTransactionReference ||
      payload?.transaction?.transactionReference ||
      ""
    ).toString();
  };

  const cartSignature = useMemo(() => {
    const items = Array.isArray(cartItems) ? cartItems : [];
    return items
      .map((ci) => `${ci?.id || ""}:${Number(ci?.quantity || 0)}`)
      .sort()
      .join("|");
  }, [cartItems]);

  useEffect(() => {
    if (!existingOrderId) return;
    if (!orderCartSignatureRef.current) return;
    if (orderCartSignatureRef.current === cartSignature) return;
    setExistingOrderId("");
    orderCartSignatureRef.current = "";
  }, [cartSignature, existingOrderId]);

  useEffect(() => {
    if (!beginPending) beginSubmitGuardRef.current = false;
  }, [beginPending]);

  const handleBeginSubmit = useCallback(
    (e) => {
      if (
        beginSubmitGuardRef.current ||
        beginPending ||
        finalizePending ||
        processing
      ) {
        e.preventDefault();
        return;
      }
      beginSubmitGuardRef.current = true;
    },
    [beginPending, finalizePending, processing]
  );

  const finalize = useCallback(
    async (status, payload) => {
      try {
        const order = currentOrderRef.current;
        if (!order) throw new Error("Missing order context");

        if (finalizeGuardRef.current.orderId === order.orderId) {
          const prevStatus = finalizeGuardRef.current.status;
          if (prevStatus === "success") return;
          if (prevStatus === status) return;
        }
        finalizeGuardRef.current = { orderId: order.orderId, status };

        const fd = new FormData();
        fd.set("orderId", order.orderId);
        fd.set("status", status);
        fd.set("reference", extractReference(payload));
        fd.set("payload", JSON.stringify(payload || {}));
        fd.set("email", formData.email);
        finalizeStartedRef.current = true;
        startFinalizeTransition(() => finalizeAction(fd));
      } finally {
        setProcessing(false);
      }
    },
    [finalizeAction, formData.email, startFinalizeTransition]
  );

  function getStartButtonApi() {
    if (typeof window === "undefined") return null;

    return window.SBInit || null;
  }

  const cancelStartButton = useCallback(() => {
    const el =
      typeof document !== "undefined" ? document.querySelector("sb-init") : null;
    if (el) {
      el.dispatchEvent(
        new CustomEvent("cancelled", { bubbles: true, composed: true })
      );
    }
    const cleanup = activeStartButtonCleanupRef.current;
    if (typeof cleanup === "function") cleanup();
    activeStartButtonCleanupRef.current = null;
    launchedRef.current = false;
    setProcessing(false);
  }, []);

  const openStartButton = useCallback(
    (order) => {
      try {
        let messageHandler;
        const api = getStartButtonApi();

        if (!api) throw new Error("Payment gateway not available");

        const setupSbCloseHooks = () => {
          const prevOverflow = document.body.style.overflow;
          const prevBodyOverflowX = document.body.style.overflowX;
          const prevBodyPosition = document.body.style.position;
          const prevBodyTop = document.body.style.top;
          const prevBodyWidth = document.body.style.width;
          const prevBodyTouchAction = document.body.style.touchAction;
          const prevHtmlOverflowX = document.documentElement.style.overflowX;
          const prevHtmlOverflow = document.documentElement.style.overflow;
          const scrollY =
            typeof window !== "undefined"
              ? window.scrollY || window.pageYOffset || 0
              : 0;
          document.body.style.overflow = "hidden";
          document.body.style.overflowX = "hidden";
          document.body.style.position = "fixed";
          document.body.style.top = `-${scrollY}px`;
          document.body.style.width = "100%";
          document.body.style.touchAction = "none";
          document.documentElement.style.overflowX = "hidden";
          document.documentElement.style.overflow = "hidden";

          const onKey = (ev) => {
            if (ev.key === "Escape") cancelStartButton();
          };
          let cleaned = false;
          window.addEventListener("keydown", onKey, true);
          return () => {
            if (cleaned) return;
            cleaned = true;
            document.body.style.overflow = prevOverflow;
            document.body.style.overflowX = prevBodyOverflowX;
            document.body.style.position = prevBodyPosition;
            document.body.style.top = prevBodyTop;
            document.body.style.width = prevBodyWidth;
            document.body.style.touchAction = prevBodyTouchAction;
            document.documentElement.style.overflowX = prevHtmlOverflowX;
            document.documentElement.style.overflow = prevHtmlOverflow;
            try {
              window.scrollTo(0, scrollY);
            } catch {}
            window.removeEventListener("keydown", onKey, true);
            if (messageHandler) window.removeEventListener("message", messageHandler);
            launchedRef.current = false;
            if (activeStartButtonCleanupRef.current === cleanupHooks) {
              activeStartButtonCleanupRef.current = null;
            }
          };
        };

        const cleanupHooks = setupSbCloseHooks();
        activeStartButtonCleanupRef.current = cleanupHooks;

        const isCancelLike = (val) => {
          const s = (val == null ? "" : String(val)).toLowerCase();
          return (
            s.includes("cancel") ||
            s.includes("canceled") ||
            s.includes("cancelled") ||
            s.includes("close") ||
            s.includes("closed") ||
            s.includes("dismiss") ||
            s.includes("abandon")
          );
        };

        const inferStatus = (payload) => {
          const t = extractText(payload).toLowerCase();
          const ev =
            (payload?.event || payload?.type || payload?.data?.event || "")
              .toString()
              .toLowerCase();
          const s1 = (payload?.status || payload?.data?.status || "")
            .toString()
            .toLowerCase();
          const s2 =
            (payload?.data?.transaction?.status || payload?.transaction?.status || "")
              .toString()
              .toLowerCase();
          const composite = `${ev} ${s1} ${s2} ${t}`;
          if (composite.includes("success") || composite.includes("successful"))
            return "success";
          if (
            composite.includes("fail") ||
            composite.includes("failed") ||
            composite.includes("error")
          )
            return "error";
          if (isCancelLike(composite)) return "cancel";
          return "unknown";
        };

        const isCancelPayload = (payload) => {
          const txt = extractText(payload);
          const ref = extractReference(payload);
          const status = inferStatus(payload);
          if (status === "cancel") return true;
          if (isCancelLike(txt)) return true;
          if (!txt && !ref && payload && typeof payload === "object") {
            const keys = Object.keys(payload);
            if (keys.length === 0) return true;
          }
          return false;
        };

        const trackPaymentEvent = (event_name, payload) => {
          try {
            trackFunnelEvent({
              event_name,
              marketplace_order_id: order?.orderId || null,
              metadata: {
                message: extractText(payload).slice(0, 180),
                reference: extractReference(payload).slice(0, 180),
                kind: typeof payload,
                keys:
                  payload && typeof payload === "object"
                    ? Object.keys(payload).slice(0, 10)
                    : [],
              },
            });
          } catch {}
        };

        const handleSdkResult = (kind, payload) => {
          if (kind === "success") {
            cleanupHooks();
            finalize("success", payload);
            return;
          }

          if (kind === "close" || isCancelPayload(payload)) {
            cleanupHooks();
            trackPaymentEvent("checkout_payment_cancelled", payload || { message: "close" });
            setProcessing(false);
            return;
          }

          cleanupHooks();
          trackPaymentEvent("checkout_payment_error", payload);
          finalize("error", payload);
        };

        const config = {
          amount: (Number(order?.amount || 0) * 100).toFixed(0),
          phone: order?.customer?.phone || "",
          channels: [
            "bank",
            "card",
            "bank_transfer",
            "ussd",
            "payattitude",
            "qr",
            "eft",
            "mobile_money",
          ],
          standard: false,
          env: process.env.NODE_ENV === "production" ? "prod" : "prod",
          email: order.customer?.email || formData.email,
          currency: order.currency,
          key: order?.publicKey,
          metadata: {
            orderId: order.orderId,
            reference: order.orderNumber,
            name: `${order.customer?.firstName || formData.firstName} ${order.customer?.lastName || formData.lastName}`.trim(),
            baseAmount: order?.baseAmount != null ? String(order.baseAmount) : "",
            baseCurrency: order?.baseCurrency != null ? String(order.baseCurrency) : "",
            paidAmount: order?.amount != null ? String(order.amount) : "",
            paidCurrency: order?.currency != null ? String(order.currency) : "",
            fxRate: order?.fxRate != null ? String(order.fxRate) : "",
            viewerCurrency: order?.viewerCurrency != null ? String(order.viewerCurrency) : "",
          },
          success: (res) => {
            console.log("res success..................", res);
            handleSdkResult("success", res);
          },
          error: (err) => {
            console.log("err error..................", err);
            handleSdkResult("error", err);
          },
          close: () => {
            handleSdkResult("close", { message: "close" });
          },
        };

        const callbacks = {
          onSuccess: (res) => {
            handleSdkResult("success", res);
          },
          onError: (err) => {
            handleSdkResult("error", err);
          },
          onClose: () => {
            handleSdkResult("close", { message: "close" });
          },
        };

        let ret;

        if (typeof api === "function") ret = api(config, callbacks);
        else if (typeof api.open === "function") ret = api.open(config, callbacks);
        else if (typeof api.checkout === "function")
          ret = api.checkout(config, callbacks);
        else if (typeof api.start === "function") ret = api.start(config, callbacks);
        else if (typeof api.init === "function") ret = api.init(config, callbacks);
        else throw new Error("Unsupported payment SDK interface");

        if (ret && typeof ret.then === "function") {
          ret
            .then((r) => {
              handleSdkResult("success", r);
            })
            .catch((e) => {
              handleSdkResult("error", e);
            });
        }

        messageHandler = (event) => {
          try {
            const d = event?.data;
            const origin = (event?.origin || "").toString().toLowerCase();
            const isSB =
              (origin && origin.includes("startbutton")) ||
              (typeof d === "object" &&
                (d?.source === "startbutton" || d?.provider === "startbutton"));
            if (!isSB) return;

            const st = inferStatus(d);
            if (st === "success") {
              handleSdkResult("success", d);
              return;
            }

            if (st === "cancel" || isCancelPayload(d)) {
              handleSdkResult("close", d);
              return;
            }

            handleSdkResult("error", d);
          } catch {}
        };
        window.addEventListener("message", messageHandler);
      } catch (e) {
        setProcessing(false);
        launchedRef.current = false;
        activeStartButtonCleanupRef.current = null;
        try {
          trackFunnelEvent({
            event_name: "checkout_payment_sdk_unavailable",
            marketplace_order_id: order?.orderId || null,
            metadata: { message: extractText(e).slice(0, 180) },
          });
        } catch {}
        setResultModal({
          open: true,
          type: "error",
          title: "Payment unavailable",
          message: e?.message || "Payment SDK not available",
        });
      }
    },
    [cancelStartButton, finalize, formData.email, formData.firstName, formData.lastName]
  );

  useEffect(() => {
    if (!processing) return;
    const id = setTimeout(() => {
      if (!processing) return;
      const cleanup = activeStartButtonCleanupRef.current;
      if (typeof cleanup === "function") cleanup();
      activeStartButtonCleanupRef.current = null;
      launchedRef.current = false;
      setProcessing(false);
    }, 60000);
    return () => clearTimeout(id);
  }, [processing]);

  useStartButtonOverlayFix(processing, setClosePos);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const markLoaded = () => setStartButtonLoaded(true);
    if (getStartButtonApi()) {
      markLoaded();
      return;
    }

    let scriptEl = null;
    try {
      scriptEl =
        document.querySelector('script[data-startbutton-sdk="1"]') ||
        document.querySelector('script[src*="startbutton"]');
      if (scriptEl) scriptEl.addEventListener("load", markLoaded, { once: true });
    } catch {}

    let tries = 0;
    const maxTries = 240; // ~60s at 250ms interval
    const id = setInterval(() => {
      const api = getStartButtonApi();
      if (api) {
        markLoaded();
        clearInterval(id);
      } else if (++tries >= maxTries) {
        clearInterval(id);
      }
    }, 250);

    return () => {
      clearInterval(id);
      try {
        scriptEl?.removeEventListener?.("load", markLoaded);
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (beginState?.success && !launchedRef.current) {
      launchedRef.current = true;
      const order = {
        publicKey: beginState.publicKey,
        orderId: beginState.orderId,
        orderNumber: beginState.orderNumber,
        amount: beginState.amount,
        currency: beginState.currency || "USD",
        baseAmount: beginState.baseAmount,
        baseCurrency: beginState.baseCurrency,
        fxRate: beginState.fxRate,
        viewerCurrency: beginState.viewerCurrency,
        customer: beginState.customer,
      };
      currentOrderRef.current = order;
      setExistingOrderId(beginState.orderId || "");
      orderCartSignatureRef.current = cartSignature;
      finalizeGuardRef.current = { orderId: beginState.orderId || "", status: "" };

      trackFunnelEvent({
        event_name: "checkout_started",
        marketplace_order_id: beginState.orderId || null,
        metadata: {
          orderNumber: beginState.orderNumber,
          currency: beginState.currency || "USD",
          amount: beginState.amount,
        },
      });

      setProcessing(true);
      openStartButton(order);
    } else if (beginState?.message && beginState?.success === false && !beginPending) {
      setResultModal({
        open: true,
        type: "error",
        title: "Checkout Error",
        message: beginState.message || "Unable to start checkout",
        details: null,
      });
    }
  }, [beginPending, beginState, cartSignature, openStartButton]);

  useEffect(() => {
    if (
      !finalState ||
      typeof finalState.success === "undefined" ||
      !finalizeStartedRef.current
    )
      return;
    const order = currentOrderRef.current;
    if (finalState.success) {
      const settled = finalState?.settled === true;
      if (settled) {
        trackFunnelEvent({
          event_name: "paid",
          marketplace_order_id: order?.orderId || null,
          metadata: {
            orderNumber: finalState?.orderNumber || order?.orderNumber,
          },
        });
      }

      setResultModal({
        open: true,
        type: "success",
        title: settled ? "Payment successful" : "Payment processing",
        message:
          finalState?.message ||
          (settled
            ? "Your order has been placed successfully."
            : "Your payment is processing. Your purchase will be available once confirmed."),
        orderNumber: finalState?.orderNumber || order?.orderNumber,
        details: null,
      });
    } else {
      setResultModal({
        open: true,
        type: "error",
        title: "Payment failed",
        message: finalState?.message || "We couldn't confirm your payment.",
        orderNumber: order?.orderNumber,
        details: null,
      });
    }
    finalizeStartedRef.current = false;
    setExistingOrderId("");
    orderCartSignatureRef.current = "";
    finalizeGuardRef.current = { orderId: "", status: "" };
  }, [finalState]);

  return {
    session,
    openLoginDialog,
    cartItems,
    cartSummary,
    isLoading,
    isError,
    error,

    searchQuery,
    setSearchQuery,

    paymentMethod,
    setPaymentMethod,

    startButtonLoaded,
    processing,
    setProcessing,

    existingOrderId,

    resultModal,
    setResultModal,

    closePos,
    cancelStartButton,

    beginAction,
    beginPending,
    finalizePending,
    handleBeginSubmit,

    formData,
    handleInputChange,

    subtotal,
    total,
    fmt,
  };
}
