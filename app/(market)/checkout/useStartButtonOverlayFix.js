"use client";

import { useEffect } from "react";

export function useStartButtonOverlayFix(processing, setClosePos) {
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
    let detachClickFixDoc;
    let detachClickFixShadow;
    let detachPhoneFixDoc;
    let detachPhoneFixShadow;
    const buttonSize = 36; // px
    const margin = 8; // px
    const setNativeInputValue = (input, value) => {
      try {
        const proto = input?.ownerDocument?.defaultView?.HTMLInputElement
          ?.prototype;
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
            if (!it) return false;
            if (typeof it.value !== "string") return false;
            if (it.disabled) return false;
            if (it.offsetParent === null) return false;
            return it.value.trim().startsWith("0");
          });
          if (!input) return;
          const current = (input.value || "").trim();
          if (!current.startsWith("0") || current.length < 2) return;
          setNativeInputValue(input, current.slice(1));
        } catch {}
      };
      root.addEventListener("click", handler, true);
      return () => {
        root.removeEventListener("click", handler, true);
      };
    };
    const stylePane = (pane, iframeMatch) => {
      try {
        const widthValue = "min(560px, 94vw)";
        const maxWidthValue = "94vw";
        if (pane) {
          pane.style.setProperty("width", widthValue, "important");
          pane.style.setProperty("maxWidth", maxWidthValue, "important");
          pane.style.setProperty("left", "50%", "important");
          pane.style.setProperty("transform", "translateX(-50%)", "important");
          pane.style.setProperty("margin", "0 auto", "important");
        }
        if (iframeMatch) {
          iframeMatch.style.setProperty("width", "100%", "important");
        }
      } catch {}
    };
    const findPane = () => {
      let pane = null;
      let iframeMatch = null;
      try {
        iframeMatch = Array.from(document.querySelectorAll("iframe")).find(
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
              const ifr = Array.from(root.querySelectorAll("iframe"))[0];
              if (ifr) pane = ifr.parentElement;
            }
          }
        }
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
          
          let rectEl = pane || iframe || null;
          if (!rectEl) {
            rectEl = document.querySelector("sb-init");
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
        'sb-init',
      ];
      const cssWidth = baseTargets
        .map(
          (sel) =>
            `.cdk-overlay-pane:has(${sel}){width:min(94vw,560px)!important;max-width:94vw!important;left:50%!important;transform:translateX(-50%)!important;margin:0 auto!important;}`
        )
        .join("");
      const cssPointer = [
        ".cdk-overlay-container{pointer-events:auto!important;z-index:100001!important;}",
        ".cdk-global-overlay-wrapper{pointer-events:auto!important;z-index:100002!important;}",
        ".cdk-overlay-pane{pointer-events:auto!important;z-index:100004!important;}",
        ".cdk-overlay-backdrop{pointer-events:auto!important;}",
        ".mat-mdc-select-panel{pointer-events:auto!important;z-index:2147483647!important;}",
      ].join("");
      
      styleEl = document.createElement("style");
      styleEl.type = "text/css";
      const nonceEl = document.querySelector(
        'style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"],meta[property="csp-nonce"]'
      );
      const nonce =
        nonceEl?.getAttribute?.("nonce") || nonceEl?.getAttribute?.("content") || "";
      if (nonce) styleEl.setAttribute("nonce", nonce);
      styleEl.textContent = cssWidth + cssPointer;
      document.head.appendChild(styleEl);
      
      try {
        let linkDoc = document.querySelector(
          'link[rel="stylesheet"][href^="/sb-override.css"]'
        );
        if (!linkDoc) {
          linkElDoc = document.createElement("link");
          linkElDoc.rel = "stylesheet";
          linkElDoc.href = "/sb-override.css?v=5";
          if (nonce) linkElDoc.setAttribute("nonce", nonce);
          linkElDoc.setAttribute("data-sb-override", "1");
          document.head.appendChild(linkElDoc);
        }
      } catch {}
      
      const host = document.querySelector("sb-init");
      if (host && host.shadowRoot) {
        styleElShadow = document.createElement("style");
        styleElShadow.type = "text/css";
        if (nonce) styleElShadow.setAttribute("nonce", nonce);
        styleElShadow.textContent = cssWidth + cssPointer;
        host.shadowRoot.appendChild(styleElShadow);
        
        try {
          let linkShadow = host.shadowRoot.querySelector(
            'link[rel="stylesheet"][href^="/sb-override.css"]'
          );
          if (!linkShadow) {
            linkElShadow = document.createElement("link");
            linkElShadow.rel = "stylesheet";
            linkElShadow.href = "/sb-override.css?v=5";
            if (nonce) linkElShadow.setAttribute("nonce", nonce);
            linkElShadow.setAttribute("data-sb-override", "1");
            host.shadowRoot.appendChild(linkElShadow);
          }
        } catch {}
      }
    } catch {}
    // Observe dynamic additions of overlay panes and restyle them immediately
    try {
      const onMut = (ml = []) => {
        for (const m of ml) {
          if (m.type === "childList") {
            m.addedNodes &&
              m.addedNodes.forEach((n) => {
                if (!(n instanceof Element)) return;
                const pane = n.matches?.(".cdk-overlay-pane")
                  ? n
                  : n.querySelector?.(".cdk-overlay-pane");
                if (pane) stylePane(pane);
              });
          }
        }
      };
      mo = new MutationObserver(onMut);
      mo.observe(document.body, {
        childList: true,
        subtree: true,
      });
      try {
        detachPhoneFixDoc = attachPhoneNormalize(document);
      } catch {}
      const host = document.querySelector("sb-init");
      if (host && host.shadowRoot) {
        moShadow = new MutationObserver(onMut);
        moShadow.observe(host.shadowRoot, {
          childList: true,
          subtree: true,
        });
        try {
          detachPhoneFixShadow = attachPhoneNormalize(host.shadowRoot);
        } catch {}
      }
    } catch {}
    enforceInterval = window.setInterval(() => {
      const found = findPane();
      if (found?.pane || found?.iframe) stylePane(found.pane, found.iframe);
      
      try {
        const host = document.querySelector("sb-init");
        if (host && host.shadowRoot) {
          const already = host.shadowRoot.querySelector(
            "style.__sb_shadow_override__"
          );
          if (!already) {
            styleElShadow = document.createElement("style");
            styleElShadow.type = "text/css";
            styleElShadow.className = "__sb_shadow_override__";
            const nonceEl = document.querySelector(
              'style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"],meta[property="csp-nonce"]'
            );
            const nonce =
              nonceEl?.getAttribute?.("nonce") || nonceEl?.getAttribute?.("content") || "";
            if (nonce) styleElShadow.setAttribute("nonce", nonce);
            styleElShadow.textContent = cssWidth + cssPointer;
            host.shadowRoot.appendChild(styleElShadow);
          }
        }
      } catch {}
    }, 500);
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
      if (linkElDoc && linkElDoc.parentNode)
        linkElDoc.parentNode.removeChild(linkElDoc);
      const host = document.querySelector("sb-init");
      if (host && host.shadowRoot && styleElShadow && styleElShadow.parentNode) {
        styleElShadow.parentNode.removeChild(styleElShadow);
      }
      if (host && host.shadowRoot && linkElShadow && linkElShadow.parentNode) {
        linkElShadow.parentNode.removeChild(linkElShadow);
      }
      try {
        mo && mo.disconnect();
        moShadow && moShadow.disconnect();
      } catch {}
      try {
        detachClickFixDoc && detachClickFixDoc();
      } catch {}
      try {
        detachClickFixShadow && detachClickFixShadow();
      } catch {}
      try {
        detachPhoneFixDoc && detachPhoneFixDoc();
      } catch {}
      try {
        detachPhoneFixShadow && detachPhoneFixShadow();
      } catch {}
    };
  }, [processing, setClosePos]);
}
