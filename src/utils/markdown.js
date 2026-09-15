/**
 * Minimal Markdown renderer
 * ------------------------------------------------------------------
 * A small, dependency-free Markdown to HTML renderer that covers
 * the subset of Markdown we expect from AI responses:
 *   - Headings (h1-h6)
 *   - Bold / italic / inline code
 *   - Links (with rel=noopener forced by sanitizer)
 *   - Bullet and numbered lists
 *   - Fenced code blocks with optional language
 *   - Blockquotes
 *   - Horizontal rules
 *   - Tables (GFM-style)
 *   - Paragraphs
 *
 * The output is always passed through sanitizeHtml() before being
 * inserted into the DOM, so this renderer is allowed to be permissive
 * — the sanitizer enforces the final safety boundary.
 *
 * We intentionally avoid regex-based inline parsing for HTML
 * injection vectors by escaping first, then applying inline
 * transforms on the escaped string.
 */

import { escapeHtml } from './sanitize.js';

/**
 * Render a Markdown string to safe HTML.
 * @param {string} md
 * @returns {string}
 */
export function renderMarkdown(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      out.push(renderCodeBlock(code.join('\n'), lang));
      continue;
    }

    // Table (line followed by separator line)
    if (i + 1 < lines.length && /\|/.test(line) && /^\s*\|?[\s\-:|]+\|?\s*$/.test(lines[i + 1]) && /\|/.test(lines[i + 1])) {
      const [tableHtml, nextIndex] = renderTable(lines, i);
      out.push(tableHtml);
      i = nextIndex;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol>${items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Paragraph: gather consecutive non-blank lines until a structural break.
    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(i + 1 < lines.length && /\|/.test(lines[i]) && /^\s*\|?[\s\-:|]+\|?\s*$/.test(lines[i + 1]) && /\|/.test(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

/**
 * Render a fenced code block. We do not implement syntax highlighting
 * here — we keep the original code as text inside <pre><code>.
 * Highlighting can be added later by a separate module walking the
 * rendered DOM and applying class names.
 *
 * @param {string} code
 * @param {string} lang
 * @returns {string}
 */
function renderCodeBlock(code, lang) {
  const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
  return `<pre><code${langClass}>${escapeHtml(code)}</code></pre>`;
}

/**
 * Render inline Markdown: bold, italic, inline code, links.
 * The input is escaped first, then transforms are applied to the
 * escaped string, so no HTML injection can slip through.
 *
 * @param {string} text
 * @returns {string}
 */
function renderInline(text) {
  let s = escapeHtml(text);

  // Inline code: `code`
  s = s.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);

  // Links: [text](url) — only allow http(s) and mailto
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    (_, label, url) => `<a href="${url}" title="${label}">${label}</a>`
  );

  // Bold: **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* or _text_
  s = s.replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');

  return s;
}

/**
 * Render a GFM-style table starting at lines[startIndex].
 * Returns [html, nextIndex].
 *
 * @param {string[]} lines
 * @param {number} startIndex
 * @returns {[string, number]}
 */
function renderTable(lines, startIndex) {
  const header = lines[startIndex];
  const align = lines[startIndex + 1];
  let i = startIndex + 2;
  const body = [];
  while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
    body.push(lines[i]);
    i++;
  }

  const splitRow = (row) => {
    let r = row.trim();
    if (r.startsWith('|')) r = r.slice(1);
    if (r.endsWith('|')) r = r.slice(0, -1);
    return r.split('|').map((c) => c.trim());
  };

  const headers = splitRow(header);
  const aligns = splitRow(align).map((a) => {
    if (/^:/.test(a) && /:$/.test(a)) return 'center';
    if (/:$/.test(a)) return 'right';
    if (/^:/.test(a)) return 'left';
    return '';
  });

  let html = '<table><thead><tr>';
  headers.forEach((h, idx) => {
    const a = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '';
    html += `<th${a}>${renderInline(h)}</th>`;
  });
  html += '</tr></thead><tbody>';
  body.forEach((row) => {
    const cells = splitRow(row);
    html += '<tr>';
    cells.forEach((c, idx) => {
      const a = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '';
      html += `<td${a}>${renderInline(c)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return [html, i];
}
