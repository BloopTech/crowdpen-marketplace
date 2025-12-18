"use client";

import { useEffect, useMemo, useState } from "react";

function normalizeCurrency(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

let geoCache = null;
let geoPromise = null;

async function getGeo() {
  if (geoCache) return geoCache;
  if (geoPromise) return geoPromise;

  geoPromise = fetch("/api/marketplace/geo")
    .then((r) => r.json())
    .catch(() => null)
    .then((data) => {
      geoCache = data;
      geoPromise = null;
      return geoCache;
    });

  return geoPromise;
}

const fxCache = new Map();
const fxPromiseCache = new Map();

async function getFxRate(from, to) {
  if (!from || !to || from === to) return 1;

  const key = `${from}->${to}`;
  if (fxCache.has(key)) return fxCache.get(key);
  if (fxPromiseCache.has(key)) return fxPromiseCache.get(key);

  const p = fetch(
    `/api/marketplace/fx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  )
    .then((r) => r.json())
    .catch(() => null)
    .then((data) => {
      const rateRaw = data?.rate != null ? Number(data.rate) : null;
      const rate = Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : null;
      if (rate != null) fxCache.set(key, rate);
      fxPromiseCache.delete(key);
      return rate;
    });

  fxPromiseCache.set(key, p);
  return p;
}

export function useViewerCurrency(baseCurrency = "USD") {
  const base = useMemo(
    () => normalizeCurrency(baseCurrency) || "USD",
    [baseCurrency]
  );

  const [viewerCurrency, setViewerCurrency] = useState(base);
  const [viewerFxRate, setViewerFxRate] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const geo = await getGeo();
        const to = normalizeCurrency(geo?.currency) || base;
        if (cancelled) return;

        if (to === base) {
          setViewerCurrency(base);
          setViewerFxRate(1);
          return;
        }

        const rate = await getFxRate(base, to);
        if (cancelled) return;

        if (rate == null) {
          setViewerCurrency(base);
          setViewerFxRate(1);
          return;
        }

        setViewerCurrency(to);
        setViewerFxRate(rate);
      } catch {
        if (cancelled) return;
        setViewerCurrency(base);
        setViewerFxRate(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [base]);

  return {
    viewerCurrency,
    viewerFxRate,
    loading,
  };
}
