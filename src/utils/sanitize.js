/**
 * DOM/HTML sanitization helpers used by the response renderer.
 * ------------------------------------------------------------------
 * The AI response is rendered as Markdown -> HTML. We must ensure
 * no script, iframe, or dangerous element ever reaches the DOM.
 *
 * Strategy:
 *   1. Use a strict allowlist of tags and attributes.
 *   2. Drop any element or attribute not on the allowlist.
 *   3. Force all links to open in a new tab with rel="noopener".
 *   4. Block javascript: and data: URLs entirely.
 *
 * This module does NOT depend on any third-party library.
 */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'del', 'dd', 'div',
  'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
  'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'small',
  'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'tr', 'u', 'ul'
]);

const ALLOWED_ATTRS = new Set([
  'href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'lang', 'dir',
  'aria-label', 'aria-describedby', 'class'
]);

const BLOCKED_URL_SCHEMES = /^(javascript|data|vbscript|file|about):/i;

/**
 * Sanitize an HTML string produced by the Markdown renderer.
 * Returns a safe HTML string suitable for insertion via
 * Element.innerHTML.
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/**
 * Recursively clean a DOM node in place.
 * @param {Node} node
 */
function cleanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return;
  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.parentNode && node.parentNode.removeChild(node);
    return;
  }
  /** @type {Element} */
  const el = node;

  // Strip <script>, <style>, <iframe>, <object>, <embed>, <link>, <meta>.
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    // For unknown elements, keep their text content (unwrap).
    while (el.firstChild) {
      el.parentNode && el.parentNode.insertBefore(el.firstChild, el);
    }
    el.parentNode && el.parentNode.removeChild(el);
    return;
  }

  // Remove disallowed attributes and neutralize dangerous URLs.
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    const name = attr.name.toLowerCase();
    if (!ALLOWED_ATTRS.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }
    if ((name === 'href' || name === 'src') && BLOCKED_URL_SCHEMES.test(attr.value.trim())) {
      el.removeAttribute(attr.name);
    }
  }

  // Force safe link behavior.
  if (tag === 'a') {
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  }

  // Recurse into children.
  const children = Array.from(el.childNodes);
  for (const child of children) cleanNode(child);
}

/**
 * Escape user-controlled text for safe insertion as text content
 * (e.g. into a `<code>` element). Use this for any text that should
 * be displayed verbatim.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
