/**
 * Markdown sanitizer — server-side rendering + sanitization pipeline.
 *
 * Pipeline (design §11, ADR-14):
 *   raw markdown → marked (GFM) → HTML string → isomorphic-dompurify → sanitized HTML
 *
 * Used at API serialization time so that:
 *   1. The Valkey cache stores sanitized HTML (render-ready for Astro `set:html`)
 *   2. Defense-in-depth: even admin-authored content is sanitized
 *
 * isomorphic-dompurify uses jsdom on Node (no browser window needed).
 * DOMPurify config: defaults (block <script>, on* attributes, javascript: hrefs).
 */

import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

// Use GFM (GitHub Flavoured Markdown) — tables, strikethrough, fenced code blocks.
// This matches the Tasks preamble decision (decision 5).
marked.use({ gfm: true });

/**
 * Convert raw markdown to sanitized HTML.
 *
 * @param input - Raw markdown string (may be empty)
 * @returns     Sanitized HTML string ready for DOM insertion / `set:html`
 */
export function sanitizeMarkdown(input: string): string {
  if (!input) return '';

  // marked.parse returns string | Promise<string>; synchronous by default with
  // no async extensions. The type is widened to string | Promise<string> in newer
  // versions — cast is safe because we pass no async extensions.
  const raw = marked.parse(input) as string;

  // DOMPurify default config blocks:
  //   • <script>, <iframe>, <object>, <embed>, <form> and similar
  //   • on* event handler attributes (onclick, onerror, onload, …)
  //   • javascript: / vbscript: hrefs and data: URIs in href/src/action
  return DOMPurify.sanitize(raw);
}
