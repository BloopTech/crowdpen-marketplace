"use client";

import React from "react";
import { sanitizeHtml } from "../lib/sanitizeHtml";

export default function SafeHTML({ html, className, allowedTags, allowedAttrs }) {
  const safe = React.useMemo(
    () => sanitizeHtml(html || "", { allowedTags, allowedAttrs }),
    [html, allowedTags, allowedAttrs]
  );

  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}
