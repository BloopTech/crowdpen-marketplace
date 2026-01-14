"use client";

import { useEffect } from "react";

export function useStartButtonOverlayFix(processing, setClosePos) {
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
    let detachPhoneFixDoc;
    let detachPhoneFixShadow;

    const buttonSize = 36;
    const margin = 8;

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

    const stylePane = (pane, iframeMatch) => {
      try {
        if (pane) {
          pane.style.setProperty("width", "min(560px, 94vw)", "important");
          pane.style.setProperty("maxWidth", "94vw", "important");
          pane.style.setProperty("left", "50%", "important");
          pane.style.setProperty("top", "50%", "important");
          pane.style.setProperty(
            "transform",
            "translate(-50%, -50%)",
            "important"
          );
          pane.style.setProperty("margin", "0 auto", "important");
          pane.style.setProperty("position", "fixed", "important");
          pane.style.setProperty("display", "flex", "important");
          pane.style.setProperty("flexDirection", "column", "important");
          pane.style.setProperty("alignItems", "center", "important");
          pane.style.setProperty("justifyContent", "center", "important");
        }
        if (iframeMatch) {
          iframeMatch.style.setProperty("width", "100%", "important");
          iframeMatch.style.setProperty("height", "100%", "important");
        }
      } catch {}
    };

    const shrinkLogos = (root = document) => {
      try {
        const candidates = Array.from(
          root.querySelectorAll('img, svg, [class*="logo" i], [id*="logo" i]')
        );
        candidates.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 80 || r.height > 80) {
            el.style.setProperty("max-width", "60px", "important");
            el.style.setProperty("max-height", "60px", "important");
            el.style.setProperty("width", "auto", "important");
            el.style.setProperty("height", "auto", "important");
            el.style.setProperty("object-fit", "contain", "important");
            el.style.setProperty("margin", "0 auto 0.5rem auto", "important");
            el.style.setProperty("display", "block", "important");
          }
        });
        const all = root.querySelectorAll("*");
        all.forEach((el) => {
          if (el.shadowRoot) shrinkLogos(el.shadowRoot);
        });
      } catch {}
    };

    const findPane = () => {
      let pane = null;
      let iframeMatch = Array.from(document.querySelectorAll("iframe")).find(
        (ifr) => {
          const src = ifr.getAttribute("src") || "";
          return (
            src.includes("startbutton") ||
            src.includes("sb-web-sdk") ||
            src.includes("startbutton.tech")
          );
        }
      );

      if (iframeMatch) {
        pane =
          iframeMatch.closest(".cdk-overlay-pane") ||
          iframeMatch.closest('[role="dialog"]') ||
          iframeMatch.parentElement;
      }
      if (!pane) {
        const host =
          document.querySelector("sb-init") ||
          document.querySelector('[class*="sb-"]');
        if (host) {
          pane =
            host.closest(".cdk-overlay-pane") ||
            host.closest('[role="dialog"]') ||
            host.parentElement;
        }
      }
      return { pane, iframe: iframeMatch };
    };

    const position = () => {
      raf && cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const { pane, iframe } = findPane();
          stylePane(pane, iframe);
          shrinkLogos();
          const rectEl = pane || iframe || document.querySelector("sb-init");
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

    // Style and Link Injection
    try {
      const nonceEl = document.querySelector(
        'style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"]'
      );
      const nonce =
        nonceEl?.getAttribute("nonce") ||
        nonceEl?.getAttribute("content") ||
        "";

      styleEl = document.createElement("style");
      styleEl.type = "text/css";
      if (nonce) styleEl.setAttribute("nonce", nonce);
      styleEl.textContent = `
        .cdk-overlay-pane, [role="dialog"], [aria-modal="true"], [class*="overlay-pane" i], [class*="mat-"][class*="dialog"] {
          width: min(560px, 94vw) !important; max-width: 94vw !important; left: 50% !important; top: 50% !important;
          transform: translate(-50%, -50%) !important; margin: 0 auto !important; position: fixed !important;
          z-index: 2147483640 !important;
        }
        img, svg, [class*="logo" i], [id*="logo" i] { max-width: 60px !important; max-height: 60px !important; object-fit: contain !important; margin: 0 auto 0.5rem auto !important; display: block !important; }
        .cdk-overlay-container, .cdk-global-overlay-wrapper, .cdk-overlay-pane, .cdk-overlay-backdrop { pointer-events: auto !important; }
        [class*="select-panel" i], [class*="dropdown" i], .cdk-overlay-pane:has([class*="select-panel" i]) { z-index: 2147483647 !important; }
      `;
      document.head.appendChild(styleEl);

      linkElDoc = document.createElement("link");
      linkElDoc.rel = "stylesheet";
      linkElDoc.href = "/sb-override.css?v=16";
      if (nonce) linkElDoc.setAttribute("nonce", nonce);
      document.head.appendChild(linkElDoc);

      const host = document.querySelector("sb-init");
      if (host && host.shadowRoot) {
        styleElShadow = document.createElement("style");
        if (nonce) styleElShadow.setAttribute("nonce", nonce);
        styleElShadow.textContent =
          ':host { display: block !important; width: 100% !important; } img, svg, [class*="logo" i] { max-width: 60px !important; max-height: 60px !important; object-fit: contain !important; }';
        host.shadowRoot.appendChild(styleElShadow);

        linkElShadow = document.createElement("link");
        linkElShadow.rel = "stylesheet";
        linkElShadow.href = "/sb-override.css?v=16";
        if (nonce) linkElShadow.setAttribute("nonce", nonce);
        host.shadowRoot.appendChild(linkElShadow);
      }
    } catch {}

    const onMut = (ml = []) => {
      shrinkLogos();
      for (const m of ml) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (!(n instanceof Element)) return;
            const pane =
              n.matches?.(".cdk-overlay-pane") || n.matches?.('[role="dialog"]')
                ? n
                : n.querySelector?.(".cdk-overlay-pane") ||
                  n.querySelector?.('[role="dialog"]');
            if (pane) stylePane(pane);
          });
        }
      }
    };

    mo = new MutationObserver(onMut);
    mo.observe(document.body, { childList: true, subtree: true });
    try {
      detachPhoneFixDoc = attachPhoneNormalize(document);
    } catch {}

    const host = document.querySelector("sb-init");
    if (host && host.shadowRoot) {
      moShadow = new MutationObserver(onMut);
      moShadow.observe(host.shadowRoot, { childList: true, subtree: true });
      try {
        detachPhoneFixShadow = attachPhoneNormalize(host.shadowRoot);
      } catch {}
    }

    enforceInterval = setInterval(() => {
      const { pane, iframe } = findPane();
      if (pane || iframe) stylePane(pane, iframe);
      shrinkLogos();
    }, 500);

    position();
    resizeHandler = () => position();
    window.addEventListener("resize", resizeHandler);
    if (window.ResizeObserver) {
      ro = new ResizeObserver(position);
      document
        .querySelectorAll('.cdk-overlay-pane, [role="dialog"]')
        .forEach((p) => ro.observe(p));
    }

    return () => {
      raf && cancelAnimationFrame(raf);
      window.removeEventListener("resize", resizeHandler);
      ro && ro.disconnect();
      clearInterval(enforceInterval);
      if (styleEl?.parentNode) styleEl.parentNode.removeChild(styleEl);
      if (linkElDoc?.parentNode) linkElDoc.parentNode.removeChild(linkElDoc);
      const host = document.querySelector("sb-init");
      if (host?.shadowRoot) {
        if (styleElShadow?.parentNode)
          styleElShadow.parentNode.removeChild(styleElShadow);
        if (linkElShadow?.parentNode)
          linkElShadow.parentNode.removeChild(linkElShadow);
      }
      mo && mo.disconnect();
      moShadow && moShadow.disconnect();
      detachPhoneFixDoc && detachPhoneFixDoc();
      detachPhoneFixShadow && detachPhoneFixShadow();
    };
  }, [processing, setClosePos]);
}
