import DOMPurify from "isomorphic-dompurify";

export const DEFAULT_ALLOWED_TAGS = [
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
];

export const DEFAULT_ALLOWED_ATTRS = [
  "href",
  "target",
  "rel",
  "class",
];

function enforceAnchorRel(html) {
  // Add rel=noopener noreferrer to target=_blank anchors
  try {
    const template = document.createElement("template");
    template.innerHTML = html;
    const anchors = template.content.querySelectorAll("a[target=\"_blank\"]");
    anchors.forEach((a) => {
      const rel = (a.getAttribute("rel") || "").split(/\s+/);
      if (!rel.includes("noopener")) rel.push("noopener");
      if (!rel.includes("noreferrer")) rel.push("noreferrer");
      a.setAttribute("rel", rel.join(" ").trim());
    });
    return template.innerHTML;
  } catch {
    return html;
  }
}

export function sanitizeHtml(dirty, options = {}) {
  if (!dirty || typeof dirty !== "string") return "";
  const cfg = {
    ALLOWED_TAGS: options.allowedTags || DEFAULT_ALLOWED_TAGS,
    ALLOWED_ATTR: options.allowedAttrs || DEFAULT_ALLOWED_ATTRS,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta", "form"],
    ALLOW_ARIA_ATTR: false,
  };
  let clean = DOMPurify.sanitize(dirty, cfg);
  clean = enforceAnchorRel(clean);
  return clean;
}

export function htmlToText(dirty) {
  if (!dirty || typeof dirty !== "string") return "";
  const clean = sanitizeHtml(dirty);

  if (typeof document !== "undefined") {
    try {
      const template = document.createElement("template");
      template.innerHTML = clean;
      return (template.content.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      return clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  return clean
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
