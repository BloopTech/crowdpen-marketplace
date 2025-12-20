"use client";

import { useEffect, useState } from "react";

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const ms = Number.isFinite(delay) && delay >= 0 ? delay : 0;
    const t = setTimeout(() => setDebouncedValue(value), ms);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedValue;
}
