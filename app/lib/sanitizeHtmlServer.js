// Node-safe sanitizer using isomorphic-dompurify for robust sanitization.
// This is more robust than the previous regex-based stripping.

import sanitizeHtml from "sanitize-html";

export function sanitizeHtmlServer(dirty) {
  if (!dirty || typeof dirty !== "string") return "";

  return sanitizeHtml(dirty, {
    allowedTags: [
      "a",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ],
    allowedAttributes: {
      "*": ["class"],
      a: ["href", "target", "rel", "class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "iframe", "object", "embed", "form"],
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs };

        if (next.target !== "_blank") {
          delete next.target;
        }

        if (next.target === "_blank") {
          const rel = String(next.rel || "")
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (!rel.includes("noopener")) rel.push("noopener");
          if (!rel.includes("noreferrer")) rel.push("noreferrer");
          next.rel = Array.from(new Set(rel)).join(" ").trim();
        }

        return { tagName, attribs: next };
      },
    },
  });
}

