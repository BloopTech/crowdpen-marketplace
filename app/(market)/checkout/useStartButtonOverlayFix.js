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
        const proto = input?.ownerDocument?.defaultView?.HTMLInputElement?.prototype;
        const desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        if (desc?.set) desc.set.call(input, value);
        else input.value = value;
      } catch {
        try { input.value = value; } catch {}
      }
      try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch {}
      try { input.dispatchEvent(new Event("change", { bubbles: true })); } catch {}
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
          const scope = btn.closest("form") || btn.closest("dialog") || 
                        btn.closest(".cdk-overlay-pane") || btn.closest('[role="dialog"]') ||
                        btn.closest("sb-init") || 
                        (rootNode && typeof rootNode.querySelectorAll === "function" ? rootNode : null) || 
                        document;

          const candidates = Array.from(scope.querySelectorAll(
            'input[type="tel"], input[name*="phone" i], input[formcontrolname*="phone" i], input[placeholder*="phone" i], input[aria-label*="phone" i], input[aria-label*="number" i]'
          ));
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
          pane.style.setProperty("transform", "translate(-50%, -50%)", "important");
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
        const candidates = Array.from(root.querySelectorAll('img, svg, [class*="logo" i], [id*="logo" i]'));
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
        all.forEach((el) => { if (el.shadowRoot) shrinkLogos(el.shadowRoot); });
      } catch {}
    };

    const findPane = () => {
      let pane = null;
      let iframeMatch = Array.from(document.querySelectorAll("iframe")).find((ifr) => {
        const src = ifr.getAttribute("src") || "";
        return src.includes("startbutton") || src.includes("sb-web-sdk") || src.includes("startbutton.tech");
      });

      if (iframeMatch) {
        pane = iframeMatch.closest(".cdk-overlay-pane") || iframeMatch.closest('[role="dialog"]') || iframeMatch.parentElement;
      }
      if (!pane) {
        const host = document.querySelector("sb-init") || document.querySelector('[class*="sb-"]');
        if (host) {
          pane = host.closest(".cdk-overlay-pane") || host.closest('[role="dialog"]') || host.parentElement;
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
          const left = Math.min(window.innerWidth - (buttonSize + margin), rect.right - buttonSize / 2);
          setClosePos({ top, left });
        } catch {}
      });
    };

    // Style and Link Injection
    try {
      const nonceEl = document.querySelector('style[nonce],link[rel="stylesheet"][nonce],script[nonce],meta[name="csp-nonce"]');
      const nonce = nonceEl?.getAttribute("nonce") || nonceEl?.getAttribute("content") || "";

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
        styleElShadow.textContent = ":host { display: block !important; width: 100% !important; } img, svg, [class*=\"logo\" i] { max-width: 60px !important; max-height: 60px !important; object-fit: contain !important; }";
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
            const pane = n.matches?.(".cdk-overlay-pane") || n.matches?.('[role="dialog"]') ? n : 
                         n.querySelector?.(".cdk-overlay-pane") || n.querySelector?.('[role="dialog"]');
            if (pane) stylePane(pane);
          });
        }
      }
    };

    mo = new MutationObserver(onMut);
    mo.observe(document.body, { childList: true, subtree: true });
    try { detachPhoneFixDoc = attachPhoneNormalize(document); } catch {}

    const host = document.querySelector("sb-init");
    if (host && host.shadowRoot) {
      moShadow = new MutationObserver(onMut);
      moShadow.observe(host.shadowRoot, { childList: true, subtree: true });
      try { detachPhoneFixShadow = attachPhoneNormalize(host.shadowRoot); } catch {}
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
      document.querySelectorAll(".cdk-overlay-pane, [role=\"dialog\"]").forEach((p) => ro.observe(p));
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
        if (styleElShadow?.parentNode) styleElShadow.parentNode.removeChild(styleElShadow);
        if (linkElShadow?.parentNode) linkElShadow.parentNode.removeChild(linkElShadow);
      }
      mo && mo.disconnect();
      moShadow && moShadow.disconnect();
      detachPhoneFixDoc && detachPhoneFixDoc();
      detachPhoneFixShadow && detachPhoneFixShadow();
    };
  }, [processing, setClosePos]);
}
//<div _ngcontent-ng-c3562273823="" class="ng-tns-c3562273823-0 inline-block w-fit h-fit"><!----><article _ngcontent-ng-c3562273823="" class="relative flex flex-col items-center justify-center w-full py-1 ng-tns-c3562273823-0 ng-star-inserted"><section _ngcontent-ng-c3562273823="" class="max-w-[450px] relative px-6 pb-4 bg-white !w-[98vw] mx-1 mt-2 lg:mt-20 ng-tns-c3562273823-0 ng-trigger ng-trigger-fadeInOnEnter ng-star-inserted"><!----><div _ngcontent-ng-c3562273823="" class="flex items-center justify-between py-4 border-b mx-[-25px] px-6 ng-tns-c3562273823-0"><div _ngcontent-ng-c3562273823="" class="flex items-center gap-2 font-primary-bold ng-tns-c3562273823-0"><div _ngcontent-ng-c3562273823="" class="flex items-center gap-2 ng-tns-c3562273823-0"><div _ngcontent-ng-c3562273823="" class="h-[35px] w-auto rounded-[5px] overflow-hidden ng-tns-c3562273823-0"><img _ngcontent-ng-c3562273823="" class="w-auto h-full ng-tns-c3562273823-0" src="https://nuban-sb-bucket.s3.amazonaws.com/1761911824206.png" alt="Crowdpen"></div><span _ngcontent-ng-c3562273823="" class="text-[12px] ng-tns-c3562273823-0">Crowdpen</span></div></div><div _ngcontent-ng-c3562273823="" class="grid justify-items-end ng-tns-c3562273823-0"><span _ngcontent-ng-c3562273823="" class="text-[12px] !font-primary-medium text-black-50 ng-tns-c3562273823-0">godsonaddy@yahoo.co.uk</span></div></div><section _ngcontent-ng-c3562273823="" class="py-4 ng-tns-c3562273823-0 ng-star-inserted" style=""><div _ngcontent-ng-c3562273823="" class="grid gap-1 relative justify-items-center mt-3 ng-tns-c3562273823-0 ng-star-inserted"><div _ngcontent-ng-c3562273823="" class="flex relative w-full ng-tns-c3562273823-0 justify-center"><!----><div _ngcontent-ng-c3562273823="" class="grid gap-1 content-baseline w-full ng-tns-c3562273823-0 justify-items-center text-center"><h4 _ngcontent-ng-c3562273823="" class="text-[10px] font-primary-semibold text-navy-blue-100 ng-tns-c3562273823-0"> TOTAL TO BE PAID </h4><div _ngcontent-ng-c3562273823="" class="flex items-start ng-tns-c3562273823-0"><span _ngcontent-ng-c3562273823="" class="font-secondary-bold text-navy-blue-100 ng-tns-c3562273823-0 !text-[18px]">GHS1.00</span></div></div></div><!----><!----><sb-tabs _ngcontent-ng-c3562273823="" tabcontainerclass="!w-full" tabclass="[&amp;&gt;button]:border-black-30 !w-fit !mx-auto !mb-3 mt-8" activelinkclass="!border-black-90" class="w-full ng-tns-c3562273823-0 ng-star-inserted" _nghost-ng-c970528939=""><article _ngcontent-ng-c970528939=""><div _ngcontent-ng-c970528939="" class="!w-full overflow-x-auto w-full"><section _ngcontent-ng-c970528939="" class="!w-full grid w-screen lg:w-full ng-star-inserted"><div _ngcontent-ng-c970528939="" class="[&amp;&gt;button]:border-black-30 !w-fit !mx-auto !mb-3 mt-8 lg:px-4 flex link text-sm items-center text-black-50"><button _ngcontent-ng-c970528939="" class="px-5 whitespace-nowrap flex gap-3 items-base !border-black-90 activeClass ng-star-inserted"><span _ngcontent-ng-c970528939="">Mobile Money (MoMo)</span><!----></button><!----><!----><button _ngcontent-ng-c970528939="" class="px-5 whitespace-nowrap flex gap-3 items-base ng-star-inserted"><span _ngcontent-ng-c970528939="">Bank transfer</span><!----></button><!----><!----><!----><!----><!----></div><div _ngcontent-ng-c970528939=""></div></section><!----><!----></div><section _ngcontent-ng-c970528939=""><!----><div _ngcontent-ng-c3562273823="" class="ng-tns-c3562273823-0 ng-star-inserted"><div _ngcontent-ng-c3562273823="" class="grid w-full gap-6 mt-8 border border-black-30 bg-gray-50 rounded-[5px] p-6 ng-tns-c3562273823-0 ng-star-inserted"><sb-input _ngcontent-ng-c3562273823="" data-test="phone-number" errormessageclass="w-full top-[109%]" nativeinputclass="!w-[80%]" labelclass="!text-[14px] font-primary-medium !text-black-90" placeholder="Enter mobile number" type="number" _nghost-ng-c2151509611="" class="ng-tns-c3562273823-0 ng-untouched ng-pristine ng-valid ng-star-inserted"><article _ngcontent-ng-c2151509611="" class="flex flex-col w-full relative"><label _ngcontent-ng-c2151509611="" class="!text-[14px] font-primary-medium !text-black-90 ng-star-inserted">Enter mobile number <!----></label><!----><div _ngcontent-ng-c2151509611="" class="flex"><div _ngcontent-ng-c2151509611="" class="input !w-full !p-0 !border"><!----><div _ngcontent-ng-c2151509611="" class="flex items-center w-full"><!----><!----><div _ngcontent-ng-c3562273823="" prefixcontent="" class="px-2 text-[#979797]/50 flex items-center gap-1 ng-star-inserted"><span _ngcontent-ng-c3562273823="" class="ng-tns-c3562273823-0 currency-flag currency-flag-ghs flex h-[16px] rounded-sm w-[18px]"></span><span _ngcontent-ng-c3562273823="" class="opacity-50 font-primary-medium ng-tns-c3562273823-0">(+233)</span></div><!----><input _ngcontent-ng-c2151509611="" class="w-full bg-transparent !w-[80%] ng-untouched ng-pristine ng-valid" autocomplete="on" placeholder="Enter mobile number" type="text" maxlength="50"><!----><!----><span _ngcontent-ng-c2151509611="" class="postfix"><span _ngcontent-ng-c2151509611="" class="text-primary-black-700"></span><!----><!----></span></div></div></div><div _ngcontent-ng-c2151509611="" class="hint"></div><!----></article><!----></sb-input><!----><!----><mat-select _ngcontent-ng-c3562273823="" role="combobox" aria-haspopup="listbox" data-test="service-provider" placeholder="Select provider" name="serviceProvider" class="mat-mdc-select !border !py-3 !mt-2 !rounder-sm !overflow-hidden !bg-[#F7F7F7]/50 px-2 !text-sm ng-tns-c3562273823-0 mat-mdc-select-empty ng-untouched ng-pristine ng-valid ng-star-inserted" aria-labelledby="mat-select-value-0" id="mat-select-0" tabindex="0" aria-expanded="false" aria-required="false" aria-disabled="false" aria-invalid="false"><div cdk-overlay-origin="" class="mat-mdc-select-trigger"><div class="mat-mdc-select-value" id="mat-select-value-0"><span class="mat-mdc-select-placeholder mat-mdc-select-min-line ng-star-inserted">Select provider</span><!----><!----></div><div class="mat-mdc-select-arrow-wrapper"><div class="mat-mdc-select-arrow"><svg viewBox="0 0 24 24" width="24px" height="24px" focusable="false" aria-hidden="true"><path d="M7 10l5 5 5-5z"></path></svg></div></div></div><!----></mat-select><!----></div><!----></div><!----><!----><!----></section></article><!----><!----><!----><!----></sb-tabs><!----></div><!----><div _ngcontent-ng-c3562273823="" class="flex gap-2 w-full items-center !mt-14 ng-tns-c3562273823-0 ng-star-inserted"><button _ngcontent-ng-c3562273823="" class="flex justify-center w-full h-full py-2 ng-tns-c3562273823-0 ng-star-inserted" style="color: rgb(227, 72, 2);"><div _ngcontent-ng-c3562273823="" class="flex items-center gap-2 ng-tns-c3562273823-0"><i _ngcontent-ng-c3562273823="" class="text-lg icon-[solar--transfer-horizontal-line-duotone] text-black-90 ng-tns-c3562273823-0"></i><span _ngcontent-ng-c3562273823="" class="text-[12px] text-black-90 ng-tns-c3562273823-0">More payment methods</span></div></button><!----><!----><sb-button _ngcontent-ng-c3562273823="" data-test="verify-number" containerclass="mx-auto" buttonclass="!text-[14px] px-6 !font-primary-bold" class="w-full ng-tns-c3562273823-0" _nghost-ng-c6601866=""><div _ngcontent-ng-c6601866="" class="mx-auto"><button _ngcontent-ng-c6601866="" class="w-full transition-all duration-300 gap-2 flex relative focus:outline-none items-center justify-center primary !text-[14px] px-6 !font-primary-bold" type="button"> Verify number <!----><!----></button></div></sb-button></div><!----><!----></section><!----><!----><!----><!----><!----></section><!----><!----><div _ngcontent-ng-c3562273823="" class="max-w-[450px] relative px-6 pb-4 !w-[98vw] ng-tns-c3562273823-0 bg-white"><div _ngcontent-ng-c3562273823="" class="flex items-center justify-center gap-2 pt-2 ng-tns-c3562273823-0"><span _ngcontent-ng-c3562273823="" class="flex items-center gap-1 font-primary-bold text-black-50 ng-tns-c3562273823-0"><i _ngcontent-ng-c3562273823="" class="icon-[ph--lock-key-fill] ng-tns-c3562273823-0"></i><span _ngcontent-ng-c3562273823="" class="text-base ng-tns-c3562273823-0">Powered by</span></span><span _ngcontent-ng-c3562273823="" class="flex items-center justify-center gap-1 px-2 py-1 rounded-full bg-black-30 ng-tns-c3562273823-0"><img _ngcontent-ng-c3562273823="" height="24" width="24" ngsrc="https://nuban.s3.us-east-2.amazonaws.com/1730469783172.png" alt="" class="h-[14px] w-auto ng-tns-c3562273823-0" loading="lazy" fetchpriority="auto" decoding="auto" ng-img="true" src="https://nuban.s3.us-east-2.amazonaws.com/1730469783172.png"><span _ngcontent-ng-c3562273823="" class="text-black-50 font-primary-bold ng-tns-c3562273823-0">Startbutton</span></span></div><div _ngcontent-ng-c3562273823="" class="font-primary-medium text-[12px] max-w-[450px] border-b pb-3 mt-4 w-full text-center text-[#535C5F] ng-tns-c3562273823-0">An Authorized reseller of Crowdpen </div><div _ngcontent-ng-c3562273823="" class="flex items-center justify-center gap-12 my-4 ng-tns-c3562273823-0"><a _ngcontent-ng-c3562273823="" href="https://difficult-pentagon-7f6.notion.site/Privacy-Notice-18ac227f1b4145859f68ad1150d45f7e?pvs=4" target="_blank" class="underline text-navy-blue-100 text-[12px] ng-tns-c3562273823-0">Privacy notice</a><a _ngcontent-ng-c3562273823="" href="https://difficult-pentagon-7f6.notion.site/Terms-of-Use-702fc49aa8554dcf8fa01500429a6dfc?pvs=4" target="_blank" class="underline text-navy-blue-100 text-[12px] ng-tns-c3562273823-0">Terms of sell</a></div></div></article><!----><!----><!----></div>