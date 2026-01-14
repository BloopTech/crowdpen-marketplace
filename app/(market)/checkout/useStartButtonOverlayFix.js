"use client";

import { useEffect } from "react";

export function useStartButtonOverlayFix(processing, setClosePos) {
  useEffect(() => {
    if (!processing) {
      setClosePos(null);
      return;
    }

    let enforceInterval;
    let linkElDoc;
    let linkElShadow;

    const fixDropdowns = () => {
      // Fix mat-select dropdowns specifically - minimal approach
      const selects = document.querySelectorAll('mat-select, .mat-mdc-select');
      selects.forEach(select => {
        if (select) {
          select.style.pointerEvents = 'auto';
          select.style.cursor = 'pointer';
          select.style.position = 'relative';
          
          const trigger = select.querySelector('.mat-mdc-select-trigger');
          if (trigger) {
            trigger.style.pointerEvents = 'auto';
            trigger.style.cursor = 'pointer';
          }
        }
      });

      // Ensure overlay containers allow dropdowns
      const containers = document.querySelectorAll('.cdk-overlay-container, .cdk-global-overlay-wrapper');
      containers.forEach(container => {
        container.style.pointerEvents = 'auto';
        container.style.zIndex = '2147483647';
      });
    };

    // Style and Link Injection - minimal approach
    try {
      const nonceEl = document.querySelector('style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"]');
      const nonce = nonceEl?.getAttribute("nonce") || nonceEl?.getAttribute("content") || "";

      linkElDoc = document.createElement("link");
      linkElDoc.rel = "stylesheet";
      linkElDoc.href = "/sb-override.css?v=20";
      if (nonce) linkElDoc.setAttribute("nonce", nonce);
      document.head.appendChild(linkElDoc);

      const host = document.querySelector("sb-init");
      if (host && host.shadowRoot) {
        linkElShadow = document.createElement("link");
        linkElShadow.rel = "stylesheet";
        linkElShadow.href = "/sb-override.css?v=20";
        if (nonce) linkElShadow.setAttribute("nonce", nonce);
        host.shadowRoot.appendChild(linkElShadow);
      }
    } catch {}

    // Run dropdown fixes periodically
    enforceInterval = setInterval(() => {
      fixDropdowns();
    }, 1000);

    return () => {
      clearInterval(enforceInterval);
      if (linkElDoc?.parentNode) linkElDoc.parentNode.removeChild(linkElDoc);
      const host = document.querySelector("sb-init");
      if (host?.shadowRoot) {
        if (linkElShadow?.parentNode) linkElShadow.parentNode.removeChild(linkElShadow);
      }
    };
  }, [processing, setClosePos]);
}
