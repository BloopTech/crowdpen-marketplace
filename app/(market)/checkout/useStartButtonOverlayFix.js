"use client";

import { useEffect } from "react";

export function useStartButtonOverlayFix(processing, setClosePos) {
  useEffect(() => {
    if (!processing) {
      setClosePos(null);
      return;
    }

    let styleEl;
    let styleElShadow;
    let linkElDoc;
    let linkElShadow;
    let detachPhoneFixDoc;
    let detachPhoneFixShadow;

    // Phone number normalization utility
    const setNativeInputValue = (input, value) => {
      try {
        const proto =
          input?.ownerDocument?.defaultView?.HTMLInputElement?.prototype;
        const desc = proto
          ? Object.getOwnPropertyDescriptor(proto, "value")
          : null;
        if (desc?.set) desc.set.call(input, value);
        else input.value = value;
      } catch {
        try {
          input.value = value;
        } catch {}
      }
      try {
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } catch {}
      try {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch {}
    };

    const attachPhoneNormalize = (root) => {
      const handler = (ev) => {
        try {
          const btn = ev?.target?.closest?.("button");
          if (!btn) return;
          const label = (btn.textContent || "").trim().toLowerCase();
          if (!label.includes("verify")) return;
          if (!(label.includes("number") || label.includes("phone"))) return;

          const rootNode = btn.getRootNode ? btn.getRootNode() : null;
          const scope =
            btn.closest("form") ||
            btn.closest("dialog") ||
            btn.closest(".cdk-overlay-pane") ||
            btn.closest('[role="dialog"]') ||
            btn.closest("sb-init") ||
            (rootNode && typeof rootNode.querySelectorAll === "function"
              ? rootNode
              : null) ||
            document;

          const candidates = Array.from(
            scope.querySelectorAll(
              'input[type="tel"], input[name*="phone" i], input[formcontrolname*="phone" i], input[placeholder*="phone" i], input[aria-label*="phone" i], input[aria-label*="number" i]'
            )
          );
          const input = candidates.find((it) => {
            if (!it || it.disabled || it.offsetParent === null) return false;
            return (it.value || "").trim().startsWith("0");
          });
          if (!input) return;
          const current = (input.value || "").trim();
          if (!current.startsWith("0") || current.length < 2) return;
          setNativeInputValue(input, current.slice(1));
        } catch {}
      };
      root.addEventListener("click", handler, true);
      return () => root.removeEventListener("click", handler, true);
    };

    // Targeted fixes for specific SDK issues only
    try {
      const nonceEl = document.querySelector(
        'style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"]'
      );
      const nonce =
        nonceEl?.getAttribute("nonce") ||
        nonceEl?.getAttribute("content") ||
        "";

      // Fix 1: Dark mode visibility and dropdown selection issues
      styleEl = document.createElement("style");
      styleEl.type = "text/css";
      if (nonce) styleEl.setAttribute("nonce", nonce);
      styleEl.textContent = `
        /* Fix dropdown selection - make options clickable */
        .cdk-overlay-pane mat-option {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .cdk-overlay-pane .mat-mdc-option {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .cdk-overlay-pane [role="option"] {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        
        /* Fix dark mode text visibility */
        .cdk-overlay-pane, [role="dialog"], [aria-modal="true"] {
          color: #000 !important;
        }
        .cdk-overlay-pane .mat-mdc-select-value,
        .cdk-overlay-pane .mat-mdc-select-placeholder {
          color: #000 !important;
        }
        .cdk-overlay-pane input {
          color: #000 !important;
        }
        .cdk-overlay-pane label {
          color: #000 !important;
        }
        .cdk-overlay-pane .text-black-50 {
          color: #666 !important;
        }
        .cdk-overlay-pane .text-black-90 {
          color: #000 !important;
        }
        
        /* Ensure dropdown panel stays on top */
        .cdk-overlay-pane:has(.mat-mdc-select-panel) {
          z-index: 2147483647 !important;
        }
        .mat-mdc-select-panel {
          z-index: 2147483647 !important;
          pointer-events: auto !important;
        }
      `;
      document.head.appendChild(styleEl);

      // Link to external CSS (kept empty for now)
      linkElDoc = document.createElement("link");
      linkElDoc.rel = "stylesheet";
      linkElDoc.href = "/sb-override.css?v=17";
      if (nonce) linkElDoc.setAttribute("nonce", nonce);
      document.head.appendChild(linkElDoc);

      // Shadow DOM fixes
      const host = document.querySelector("sb-init");
      if (host && host.shadowRoot) {
        styleElShadow = document.createElement("style");
        if (nonce) styleElShadow.setAttribute("nonce", nonce);
        styleElShadow.textContent = `
          :host { color: #000 !important; }
          :host mat-option { pointer-events: auto !important; cursor: pointer !important; }
          :host .mat-mdc-option { pointer-events: auto !important; cursor: pointer !important; }
          :host [role="option"] { pointer-events: auto !important; cursor: pointer !important; }
        `;
        host.shadowRoot.appendChild(styleElShadow);

        linkElShadow = document.createElement("link");
        linkElShadow.rel = "stylesheet";
        linkElShadow.href = "/sb-override.css?v=17";
        if (nonce) linkElShadow.setAttribute("nonce", nonce);
        host.shadowRoot.appendChild(linkElShadow);
      }

      // Attach phone number normalization
      try { detachPhoneFixDoc = attachPhoneNormalize(document); } catch {}
      const shadowHost = document.querySelector("sb-init");
      if (shadowHost && shadowHost.shadowRoot) {
        try { detachPhoneFixShadow = attachPhoneNormalize(shadowHost.shadowRoot); } catch {}
      }
    } catch {}

    return () => {
      // Cleanup injected styles
      if (styleEl?.parentNode) styleEl.parentNode.removeChild(styleEl);
      if (linkElDoc?.parentNode) linkElDoc.parentNode.removeChild(linkElDoc);
      const host = document.querySelector("sb-init");
      if (host?.shadowRoot) {
        if (styleElShadow?.parentNode)
          styleElShadow.parentNode.removeChild(styleElShadow);
        if (linkElShadow?.parentNode)
          linkElShadow.parentNode.removeChild(linkElShadow);
      }
      // Cleanup phone fix handlers
      detachPhoneFixDoc && detachPhoneFixDoc();
      detachPhoneFixShadow && detachPhoneFixShadow();
    };
  }, [processing, setClosePos]);
}
