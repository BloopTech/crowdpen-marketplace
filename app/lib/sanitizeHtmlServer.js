// Node-safe sanitizer using isomorphic-dompurify for robust sanitization.
// This is more robust than the previous regex-based stripping.

import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtmlServer(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';
  const cfg = {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'a','b','strong','i','em','u','p','br','ul','ol','li','blockquote','code','pre','span','h1','h2','h3','h4','h5','h6'
    ],
    ALLOWED_ATTR: ['href','target','rel','class'],
    FORBID_TAGS: ['script','style','iframe','object','embed','link','meta','form'],
    ALLOW_ARIA_ATTR: false,
  };
  return DOMPurify.sanitize(dirty, cfg);
}
