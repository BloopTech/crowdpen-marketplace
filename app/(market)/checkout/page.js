"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useActionState,
  useCallback,
  useTransition,
} from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { Checkbox } from "../../components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { CreditCard, Lock, ArrowLeft, Loader2, X } from "lucide-react";
import Link from "next/link";
import MarketplaceHeader from "../../components/marketplace-header";
import PaymentResultModal from "../../components/payment-result-modal";
import { CartContextProvider, useCart } from "../cart/context";
import { useSession } from "next-auth/react";
import { useHome } from "../../context";
import { beginCheckout, finalizeOrder } from "./actions";

const beginInitializeState = {
  success: false,
  message: "",
};

const finalizeInitializeState = {
  success: false,
  message: "",
};

function CheckoutContent() {
  const { data: session } = useSession();
  const { openLoginDialog } = useHome();
  const { cartItems, cartSummary, isLoading, isError, error } = useCart();

  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("startbutton");
  const [startButtonLoaded, setStartButtonLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
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
  const [cspNonce, setCspNonce] = useState("");

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
      const n = el?.getAttribute?.("nonce") || el?.getAttribute?.("content") || "";
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
  const tax = useMemo(
    () => Number(cartSummary?.tax || 0) || 0,
    [cartSummary?.tax]
  );

  // Define finalize and StartButton helpers BEFORE effects that reference them
  const finalize = useCallback(
    async (status, payload) => {
      try {
        const order = currentOrderRef.current;
        if (!order) throw new Error("Missing order context");
        const fd = new FormData();
        fd.set("orderId", order.orderId);
        fd.set("status", status);
        fd.set(
          "reference",
          payload?.reference ||
            payload?.data?.reference ||
            payload?.txRef ||
            payload?.ref ||
            ""
        );
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
      typeof document !== "undefined"
        ? document.querySelector("sb-init")
        : null;
    if (el)
      el.dispatchEvent(
        new CustomEvent("cancelled", { bubbles: true, composed: true })
      );
  }, []);

  const openStartButton = useCallback(
    (order) => {
      try {
        const api = getStartButtonApi();
       
        if (!api) throw new Error("Payment gateway not available");

        const setupSbCloseHooks = () => {
          const prevOverflow = document.body.style.overflow;
          const prevBodyOverflowX = document.body.style.overflowX;
          const prevHtmlOverflowX = document.documentElement.style.overflowX;
          document.body.style.overflow = "hidden";
          document.body.style.overflowX = "hidden";
          document.documentElement.style.overflowX = "hidden";

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
            document.documentElement.style.overflowX = prevHtmlOverflowX;
            window.removeEventListener("keydown", onKey, true);
            launchedRef.current = false;
          };
        };

        const cleanupHooks = setupSbCloseHooks();

        const config = {
          amount: Number(total) * 100,
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
          env: process.env.NODE_ENV === "production" ? "prod" : "test",
          email: order.customer?.email || formData.email,
          currency: order.currency,
          key: process.env.STARTBUTTON_PUBLIC_KEY,
          reference: order.orderNumber,
          metadata: {
            orderId: order.orderId,
            reference: order.orderNumber,
            name: `${order.customer?.firstName || formData.firstName} ${order.customer?.lastName || formData.lastName}`.trim(),
          },
          success: (res) => {
            cleanupHooks();
            finalize("success", res);
          },
          error: (err) => {
            cleanupHooks();
            finalize("error", err);
          },
          close: () => {
            cleanupHooks();
            setProcessing(false);
          },
        };

        const callbacks = {
          onSuccess: (res) => {
            cleanupHooks();
            finalize("success", res);
          },
          onError: (err) => {
            cleanupHooks();
            finalize("error", err);
          },
          onClose: () => {
            cleanupHooks();
            setProcessing(false);
          },
        };

        let ret;

        if (typeof api === "function") ret = api(config, callbacks);
        else if (typeof api.open === "function")
          ret = api.open(config, callbacks);
        else if (typeof api.checkout === "function")
          ret = api.checkout(config, callbacks);
        else if (typeof api.start === "function")
          ret = api.start(config, callbacks);
        else if (typeof api.init === "function")
          ret = api.init(config, callbacks);
        else throw new Error("Unsupported payment SDK interface");
        
        if (ret && typeof ret.then === "function") {
          
          ret
            .then((r) => {
              cleanupHooks();
              finalize("success", r);
            })
            .catch((e) => {
              cleanupHooks();
              finalize("error", e);
            });
        }
       
        const handleMessage = (event) => {
      
          try {
            const d = event?.data;
            const isSB =
              typeof d === "object" &&
              (d?.source === "startbutton" || d?.provider === "startbutton");
            if (!isSB) return;
            if (d?.status === "success") finalize("success", d);
            else if (d?.status === "error") finalize("error", d);
          } catch {}
        };
        window.addEventListener("message", handleMessage, { once: true });
      } catch (e) {
        setProcessing(false);
        setResultModal({
          open: true,
          type: "error",
          title: "Payment unavailable",
          message: e?.message || "Payment SDK not available",
        });
      }
    },
    [
      finalize,
      formData.email,
      formData.firstName,
      formData.lastName,
      total,
      cancelStartButton,
    ]
  );

  // Position the close button near the SDK card
  useEffect(() => {
    if (!processing) {
      setClosePos(null);
      return;
    }
    let ro;
    let resizeHandler;
    let raf;
    let enforceInterval;
    let styleEl;
    let styleElShadow;
    let linkElDoc;
    let linkElShadow;
    let mo;
    let moShadow;
    const buttonSize = 36; // px
    const margin = 8; // px
    const styleSbLightDom = () => {
      try {
        const targets = document.querySelectorAll(
          'sb-init section.bg-white, sb-init section[class*="!w-[98vw]"], sb-init [class*="!w-[98vw]"], sb-init [class*="max-w-[450px]"]'
        );
        targets.forEach((el) => {
          el.style.setProperty("width", "520px", "important");
          el.style.setProperty("maxWidth", "94vw", "important");
          el.style.setProperty("margin", "0 auto", "important");
          el.style.setProperty("display", "block", "important");
          el.style.setProperty("left", "auto", "important");
          el.style.setProperty("right", "auto", "important");
          el.style.setProperty("transform", "none", "important");
          el.style.setProperty("alignSelf", "center", "important");
        });
        const containers = document.querySelectorAll(
          'sb-init article, sb-init [class*="items-center"][class*="justify-center"]'
        );
        containers.forEach((el) => {
          el.style.setProperty("display", "flex", "important");
          el.style.setProperty("alignItems", "center", "important");
          el.style.setProperty("justifyContent", "center", "important");
        });
      } catch {}
    };
    const stylePane = (pane, iframeMatch) => {
      try {
        const widthValue = "520px";
        const maxWidthValue = "94vw";
        if (pane) {
          pane.style.setProperty("width", widthValue, "important");
          pane.style.setProperty("maxWidth", maxWidthValue, "important");
          pane.style.setProperty("left", "50%", "important");
          pane.style.setProperty("right", "auto", "important");
          pane.style.setProperty("transform", "translateX(-50%)", "important");
          pane.style.setProperty("margin", "0 auto", "important");
          pane.style.setProperty("display", "block", "important");
        }
        const wrapper =
          pane?.closest?.(".cdk-global-overlay-wrapper") || pane?.parentElement;
        if (wrapper) {
          wrapper.style.setProperty("display", "flex", "important");
          wrapper.style.setProperty("alignItems", "center", "important");
          wrapper.style.setProperty("justifyContent", "center", "important");
        }
        const dialogEl = pane?.querySelector?.("dialog");
        if (dialogEl) {
          dialogEl.style.setProperty("width", widthValue, "important");
          dialogEl.style.setProperty("maxWidth", maxWidthValue, "important");
          dialogEl.style.setProperty("margin", "0 auto", "important");
          dialogEl.style.setProperty("left", "50%", "important");
          dialogEl.style.setProperty(
            "transform",
            "translateX(-50%)",
            "important"
          );
        }
        const hostEl = pane?.querySelector?.("sb-init");
        if (hostEl) {
          hostEl.style.setProperty("width", "100%", "important");
          hostEl.style.setProperty("maxWidth", maxWidthValue, "important");
          hostEl.style.setProperty("margin", "0 auto", "important");
          hostEl.style.setProperty("display", "block", "important");
        }
        const iframeEl = pane?.querySelector?.("iframe") || iframeMatch || null;
        if (iframeEl) {
          const iframeWidth = pane ? "100%" : widthValue;
          const iframeMaxWidth = pane ? maxWidthValue : maxWidthValue;
          iframeEl.style.setProperty("width", iframeWidth, "important");
          iframeEl.style.setProperty("maxWidth", iframeMaxWidth, "important");
          iframeEl.style.setProperty("margin", "0 auto", "important");
          iframeEl.style.setProperty("display", "block", "important");
          // Center fixed/absolute iframe when no pane wrapper
          if (!pane) {
            iframeEl.style.setProperty("left", "50%", "important");
            iframeEl.style.setProperty("right", "auto", "important");
            iframeEl.style.setProperty("transform", "translateX(-50%)", "important");
          }
        }
        const matSurface = pane?.querySelector?.(
          ".mat-mdc-dialog-surface, .mat-dialog-container"
        );
        if (matSurface) {
          matSurface.style.setProperty("width", "100%", "important");
          matSurface.style.setProperty("maxWidth", maxWidthValue, "important");
          matSurface.style.setProperty("margin", "0 auto", "important");
          matSurface.style.setProperty("display", "block", "important");
        }
      } catch {}
    };
    const findPane = () => {
      let pane = null;
      let iframeMatch = null;
      try {
        iframeMatch = Array.from(document.querySelectorAll("iframe")).find((ifr) => {
          const src = ifr.getAttribute("src") || "";
          return (
            src.includes("startbutton") ||
            src.includes("sb-web-sdk") ||
            src.includes("startbutton.tech")
          );
        });
        if (iframeMatch) {
          pane = iframeMatch.closest(".cdk-overlay-pane") || iframeMatch.parentElement;
        }
      } catch {}
      if (!pane) {
        const host = document.querySelector("sb-init");
        if (host) {
          pane = host.closest(".cdk-overlay-pane");
          if (!pane && host.shadowRoot) {
            const root = host.shadowRoot;
            const panes = Array.from(root.querySelectorAll(".cdk-overlay-pane"));
            if (panes.length) pane = panes[panes.length - 1];
            if (!pane) {
              const dialogs = Array.from(root.querySelectorAll("dialog[open]"));
              if (dialogs.length) pane = dialogs[dialogs.length - 1];
            }
            if (!pane) {
              const ifr = Array.from(root.querySelectorAll("iframe"))[0];
              if (ifr) pane = ifr.parentElement;
            }
          }
        }
      }
      if (!pane) {
        const panes = Array.from(document.querySelectorAll(".cdk-overlay-pane"));
        pane = panes.find((p) => p.querySelector("iframe")) || (panes.length ? panes[panes.length - 1] : null);
      }
      return { pane, iframe: iframeMatch };
    };
    const position = () => {
      raf && cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const found = findPane();
          const pane = found?.pane;
          const iframe = found?.iframe;
          stylePane(pane, iframe);
          styleSbLightDom();
          let rectEl = pane || iframe || null;
          if (!rectEl) {
            rectEl = document.querySelector(
              'sb-init section.bg-white, sb-init section[class*="!w-[98vw]"], sb-init [class*="!w-[98vw]"], sb-init [class*="max-w-[450px]"]'
            );
          }
          if (!rectEl) return;
          const rect = rectEl.getBoundingClientRect();
          const top = Math.max(margin, rect.top + margin);
          const left = Math.min(
            window.innerWidth - (buttonSize + margin),
            rect.right - buttonSize / 2
          );
          setClosePos({ top, left });
        } catch {}
      });
    };
    position();
    try {
      const baseTargets = [
        'iframe[src*="startbutton"]',
        'iframe[src*="sb-web-sdk"]',
        'iframe[src*="startbutton.tech"]',
        'dialog[open]',
        '.cdk-overlay-pane',
        'body > .cdk-overlay-container > .cdk-global-overlay-wrapper > .cdk-overlay-pane',
        'body > .cdk-overlay-container > .cdk-global-overlay-wrapper > [id^="cdk-overlay-"]\.cdk-overlay-pane',
        '.cdk-overlay-pane .mat-mdc-dialog-surface',
        '.cdk-overlay-pane .mat-dialog-container'
      ];
      const cssWidth = baseTargets
        .map(
          (sel) =>
            `${sel}{width:min(94vw,520px)!important;max-width:520px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;display:block!important;margin:0 auto!important;}`
        )
        .join('');
      const cssWrapper =
        '.cdk-global-overlay-wrapper{display:flex!important;align-items:center!important;justify-content:center!important;}';
      const cssVars = ':root{--mat-dialog-container-max-width:520px !important;--mat-dialog-container-small-max-width:520px !important;}';
      styleEl = document.createElement('style');
      styleEl.type = 'text/css';
      const nonceEl = document.querySelector('style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"],meta[property="csp-nonce"]');
      const nonce = nonceEl?.getAttribute?.('nonce') || nonceEl?.getAttribute?.('content') || '';
      if (nonce) styleEl.setAttribute('nonce', nonce);
      styleEl.textContent = cssWidth + cssWrapper + cssVars;
      document.head.appendChild(styleEl);
      try {
        let linkDoc = document.querySelector('link[rel="stylesheet"][href^="/sb-override.css"]');
        if (!linkDoc) {
          linkElDoc = document.createElement('link');
          linkElDoc.rel = 'stylesheet';
          linkElDoc.href = '/sb-override.css?v=1';
          if (nonce) linkElDoc.setAttribute('nonce', nonce);
          linkElDoc.setAttribute('data-sb-override', '1');
          document.head.appendChild(linkElDoc);
        }
      } catch {}
      const host = document.querySelector('sb-init');
      if (host) {
        host.style.setProperty('--mat-dialog-container-max-width', '520px');
        host.style.setProperty('--mat-dialog-container-small-max-width', '520px');
      }
      if (host && host.shadowRoot) {
        const shadowCssWidth = [
          'iframe[src*="startbutton"]',
          'iframe[src*="sb-web-sdk"]',
          'iframe[src*="startbutton.tech"]',
          'dialog[open]',
          '.cdk-overlay-pane',
          'body > .cdk-overlay-container > .cdk-global-overlay-wrapper > .cdk-overlay-pane',
          'body > .cdk-overlay-container > .cdk-global-overlay-wrapper > [id^="cdk-overlay-"]\.cdk-overlay-pane',
          '.cdk-overlay-pane .mat-mdc-dialog-surface',
          '.cdk-overlay-pane .mat-dialog-container'
        ]
          .map(
            (sel) =>
              `${sel}{width:min(94vw,520px)!important;max-width:520px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;display:block!important;margin:0 auto!important;}`
          )
          .join('');
        const shadowWrapper = '.cdk-global-overlay-wrapper{display:flex!important;align-items:center!important;justify-content:center!important;}';
        const shadowVars = ':host{--mat-dialog-container-max-width:520px !important;--mat-dialog-container-small-max-width:520px !important;}';
        styleElShadow = document.createElement('style');
        styleElShadow.type = 'text/css';
        if (nonce) styleElShadow.setAttribute('nonce', nonce);
        styleElShadow.textContent = shadowCssWidth + shadowWrapper + shadowVars;
        host.shadowRoot.appendChild(styleElShadow);
        try {
          let linkShadow = host.shadowRoot.querySelector('link[rel="stylesheet"][href^="/sb-override.css"]');
          if (!linkShadow) {
            linkElShadow = document.createElement('link');
            linkElShadow.rel = 'stylesheet';
            linkElShadow.href = '/sb-override.css?v=1';
            if (nonce) linkElShadow.setAttribute('nonce', nonce);
            linkElShadow.setAttribute('data-sb-override', '1');
            host.shadowRoot.appendChild(linkElShadow);
          }
        } catch {}
      }
    } catch {}
    // Observe dynamic additions of overlay panes and restyle them immediately (handles prod timing differences)
    try {
      const onMut = (ml = []) => {
        for (const m of ml) {
          if (m.type === 'childList') {
            m.addedNodes && m.addedNodes.forEach((n) => {
              if (!(n instanceof Element)) return;
              const pane = n.matches?.('.cdk-overlay-pane') ? n : n.querySelector?.('.cdk-overlay-pane');
              if (pane) stylePane(pane);
              styleSbLightDom();
            });
          }
          if (m.type === 'attributes' && m.target instanceof Element) {
            if (m.target.classList?.contains('cdk-overlay-pane')) stylePane(m.target);
            styleSbLightDom();
          }
        }
      };
      mo = new MutationObserver(onMut);
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      const host = document.querySelector('sb-init');
      if (host && host.shadowRoot) {
        moShadow = new MutationObserver(onMut);
        moShadow.observe(host.shadowRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
    } catch {}
    enforceInterval = window.setInterval(() => {
      const found = findPane();
      if (found?.pane || found?.iframe) stylePane(found.pane, found.iframe);
      styleSbLightDom();
      try {
        const host = document.querySelector('sb-init');
        if (host) {
          host.style.setProperty('--mat-dialog-container-max-width', '520px');
          host.style.setProperty('--mat-dialog-container-small-max-width', '520px');
        }
        if (host && host.shadowRoot) {
          const already = host.shadowRoot.querySelector('style.__sb_shadow_override__');
          if (!already) {
            const shadowCssWidth = [
              'iframe[src*="startbutton"]',
              'iframe[src*="sb-web-sdk"]',
              'iframe[src*="startbutton.tech"]',
              'dialog[open]',
              '.cdk-overlay-pane',
              '.cdk-overlay-pane .mat-mdc-dialog-surface',
              '.cdk-overlay-pane .mat-dialog-container'
            ]
              .map(
                (sel) =>
                  `${sel}{width:min(94vw,520px)!important;max-width:520px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;display:block!important;margin:0 auto!important;}`
              )
              .join('');
            const shadowWrapper = '.cdk-global-overlay-wrapper{display:flex!important;align-items:center!important;justify-content:center!important;}';
            const shadowVars = ':host{--mat-dialog-container-max-width:520px !important;--mat-dialog-container-small-max-width:520px !important;}';
            styleElShadow = document.createElement('style');
            styleElShadow.type = 'text/css';
            styleElShadow.className = '__sb_shadow_override__';
            const nonceEl = document.querySelector('style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"],meta[property="csp-nonce"]');
            const nonce = nonceEl?.getAttribute?.('nonce') || nonceEl?.getAttribute?.('content') || '';
            if (nonce) styleElShadow.setAttribute('nonce', nonce);
            styleElShadow.textContent = shadowCssWidth + shadowWrapper + shadowVars;
            host.shadowRoot.appendChild(styleElShadow);
          }
          let linkShadow = host.shadowRoot.querySelector('link[rel="stylesheet"][href^="/sb-override.css"]');
          if (!linkShadow) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/sb-override.css?v=1';
            const nonceEl2 = document.querySelector('style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"],meta[property="csp-nonce"]');
            const nonce2 = nonceEl2?.getAttribute?.('nonce') || nonceEl2?.getAttribute?.('content') || '';
            if (nonce2) link.setAttribute('nonce', nonce2);
            link.setAttribute('data-sb-override', '1');
            host.shadowRoot.appendChild(link);
          }
        }
      } catch {}
    }, 300);
    resizeHandler = () => position();
    window.addEventListener("resize", resizeHandler);
    if (window.ResizeObserver) {
      const panes = document.querySelectorAll(".cdk-overlay-pane");
      ro = new ResizeObserver(position);
      panes.forEach((p) => ro.observe(p));
    }
    return () => {
      raf && cancelAnimationFrame(raf);
      window.removeEventListener("resize", resizeHandler);
      ro && ro.disconnect();
      if (enforceInterval) window.clearInterval(enforceInterval);
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      if (linkElDoc && linkElDoc.parentNode) linkElDoc.parentNode.removeChild(linkElDoc);
      const host = document.querySelector('sb-init');
      if (host && host.shadowRoot && styleElShadow && styleElShadow.parentNode) {
        styleElShadow.parentNode.removeChild(styleElShadow);
      }
      if (host && host.shadowRoot && linkElShadow && linkElShadow.parentNode) {
        linkElShadow.parentNode.removeChild(linkElShadow);
      }
      try { mo && mo.disconnect(); moShadow && moShadow.disconnect(); } catch {}
    };
  }, [processing]);

  // Detect StartButton SDK readiness without inline onLoad handler
  useEffect(() => {
    let tries = 0;
    const maxTries = 40; // ~10s at 250ms interval
    const id = setInterval(() => {
      const api = getStartButtonApi();
      if (api) {
        setStartButtonLoaded(true);
        clearInterval(id);
      } else if (++tries >= maxTries) {
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (beginState?.success && !launchedRef.current) {
      launchedRef.current = true;
      const order = {
        orderId: beginState.orderId,
        orderNumber: beginState.orderNumber,
        amount: beginState.amount,
        currency: beginState.currency || "GHS",
        customer: beginState.customer,
      };
      currentOrderRef.current = order;
      setProcessing(true);
      openStartButton(order);
    } else if (
      beginState?.message &&
      beginState?.success === false &&
      !beginPending
    ) {
      setResultModal({
        open: true,
        type: "error",
        title: "Checkout Error",
        message: beginState.message || "Unable to start checkout",
        details: null,
      });
    }
  }, [beginState, beginPending, openStartButton]);

  useEffect(() => {
    if (
      !finalState ||
      typeof finalState.success === "undefined" ||
      !finalizeStartedRef.current
    )
      return;
    const order = currentOrderRef.current;
    if (finalState.success) {
      setResultModal({
        open: true,
        type: "success",
        title: "Payment successful",
        message:
          finalState?.message || "Your order has been placed successfully.",
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
    // reset gate so initial render doesn't trigger
    finalizeStartedRef.current = false;
  }, [finalState]);

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MarketplaceHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={() => {}}
        />
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
            <Button
              onClick={openLoginDialog}
              className="bg-tertiary text-white"
            >
              Sign in to checkout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {processing && (
        <button
          type="button"
          onClick={cancelStartButton}
          className="cursor-pointer fixed z-[100005] px-2 py-2 rounded-full bg-white text-black text-sm shadow-lg hover:bg-black/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
          style={{
            top: closePos?.top ?? 24,
            left: closePos?.left ?? undefined,
            right: closePos ? "auto" : 24,
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
      />

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
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Method (StartButton) */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Payment Method</h3>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <div className="flex items-center space-x-2 p-3 border border-slate-300 rounded-lg w-full justify-between">
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
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading
                            gateway…
                          </span>
                        )}
                      </div>
                    </RadioGroup>
                    <div className="text-xs text-muted-foreground">
                      You&apos;ll complete your payment securely in a hosted
                      StartButton checkout.
                    </div>
                    <input
                      type="hidden"
                      name="paymentMethod"
                      value="startbutton"
                    />
                  </div>

                  <Separator />

                  {/* Billing Address */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Billing Address</h3>
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
                        />
                      </div>
                    </div>
                    <input
                      type="hidden"
                      name="country"
                      value={formData.country || "NG"}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" required />
                    <Label htmlFor="terms" className="text-sm">
                      I agree to the{" "}
                      <Link
                        href="/terms"
                        className="text-tertiary hover:underline"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        className="text-tertiary hover:underline"
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
                      isLoading ||
                      !cartItems?.length ||
                      !startButtonLoaded
                    }
                  >
                    {beginPending || finalizePending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                      </span>
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
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading cart…
                    </div>
                  )}
                  {isError && (
                    <div className="text-sm text-red-600">
                      {error?.message || "Failed to load cart"}
                    </div>
                  )}
                  {!isLoading &&
                    !isError &&
                    cartItems?.map((it) => (
                      <div key={it.id} className="flex justify-between text-sm">
                        <span className="truncate pr-2">
                          {it?.product?.title || it?.name || "Item"} ×{" "}
                          {it.quantity}
                        </span>
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
                  <div className="text-sm font-medium text-green-800 mb-1">
                    What happens next?
                  </div>
                  <div className="text-xs text-green-700 space-y-1">
                    <div>✓ Instant receipt sent to your email</div>
                    <div>✓ Access purchases in your account</div>
                    <div>✓ Secure, encrypted payment</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center">
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

export default function CheckoutPage() {
  return (
    <CartContextProvider>
      <CheckoutContent />
    </CartContextProvider>
  );
}
