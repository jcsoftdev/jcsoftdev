/**
 * MDX compile function.
 *
 * Security model (fixes C2, Critical RCE):
 * ----------------------------------------
 * The previous implementation compiled MDX with `outputFormat: 'function-body'`
 * and EXECUTED the result via `@mdx-js/mdx` `run()` (a `Function`/`AsyncFunction`).
 * That meant any MDX `{}` JS-expression in user content ran server-side — e.g.
 * `{process.env.BETTER_AUTH_SECRET}` or `{await import('node:child_process')}` —
 * for every public visitor of a published post. This is a critical RCE.
 *
 * This engine performs a **restricted AST render with NO JavaScript evaluation
 * of user content**. Source is parsed as GFM Markdown (via `remark-parse` +
 * `remark-gfm`), transformed mdast → hast (`remark-rehype`, WITHOUT
 * `allowDangerousHtml` — raw HTML is dropped, never passed through), and
 * stringified to HTML (`rehype-stringify`). There is no `run()`, no `Function`,
 * no `AsyncFunction`, and no acorn evaluation anywhere in the path.
 *
 * Because the parser is plain Markdown, MDX `{}` expressions are never treated
 * as JS — `{process.env.SECRET}` is emitted as inert, escaped literal text and
 * is structurally impossible to evaluate. This also matches the api's publish
 * rendering, which uses `marked({ gfm: true })` (plain GFM Markdown), so preview
 * and publish now agree.
 *
 * Defense-in-depth guards (pre-parse, preserve the historical contract):
 * - PascalCase JSX component references are rejected (allow-list is empty — see
 *   ADR-6 / README "Component Allow-List").
 * - Dangerous lowercase elements (script/style/iframe/object/embed) are rejected.
 *
 * Compile failure: returns `{ ok: false, error: string }` discriminated union.
 * Never throws.
 */
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Discriminated union result type for compileMdx.
 */
export type CompileResult = { ok: true; html: string } | { ok: false; error: string };

/**
 * Regex to detect PascalCase component references in the source.
 * Matches a `<` followed by an uppercase-initial name — standard HTML elements
 * are lowercase, so this catches custom components only. The trailing character
 * is intentionally unanchored so an unterminated tag (`<UnclosedTag`) is caught
 * too, preserving the "custom components are rejected" contract.
 *
 * Examples blocked: <MyComponent />, <UnsafeWidget prop="x" />, <UnclosedTag
 */
const CUSTOM_COMPONENT_PATTERN = /<\s*[A-Z][A-Za-z0-9]*/;

/**
 * Set of explicitly blocked lowercase element names that are dangerous in HTML.
 */
const BLOCKED_ELEMENTS = new Set(['script', 'style', 'iframe', 'object', 'embed']);

/**
 * Regex to detect blocked lowercase elements.
 */
function buildBlockedElementPattern(): RegExp {
  const tags = [...BLOCKED_ELEMENTS].join('|');
  return new RegExp(`<\\s*(${tags})[\\s>]`);
}

const BLOCKED_ELEMENT_PATTERN = buildBlockedElementPattern();

/**
 * Blank out fenced code blocks, indented code blocks, and inline code spans.
 *
 * The guards below scan raw source, not the parsed tree, so without this a post
 * that merely *documents* markup — a ```jsx fence containing `<Button />`, or an
 * inline `<script>` mention — was rejected in full and rendered as "Content
 * failed to render." On a developer's blog that is the common case, not the
 * edge case.
 *
 * Code regions are replaced with same-length blanks rather than removed so the
 * guards keep matching at meaningful offsets and line structure is preserved.
 */
function blankCodeRegions(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return (
    source
      // fenced blocks: ``` or ~~~ (any length >= 3), open to matching fence or EOF
      .replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1?\2[^\n]*$|$)/gm, blank)
      // indented code blocks: 4+ leading spaces or a tab on a whole line
      .replace(/^(?: {4}|\t)[^\n]*$/gm, blank)
      // inline code spans: `x`, ``x``
      .replace(/(`+)(?:[^`]|(?!\1)`)*\1/g, blank)
  );
}

/**
 * The render pipeline. Built once and reused across calls.
 *
 * remark-parse   → parse as CommonMark (NO MDX, so `{}` is never JS)
 * remark-gfm     → GFM: tables, strikethrough, task lists, autolinks
 * remark-rehype  → mdast → hast; raw HTML NOT passed through (default)
 * rehype-stringify → hast → HTML string
 */
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify);

/**
 * Compile MDX/Markdown source string to a static HTML string.
 *
 * @param source - Raw MDX content
 * @returns CompileResult — either `{ ok: true, html }` or `{ ok: false, error }`
 */
export async function compileMdx(source: string): Promise<CompileResult> {
  // Guards run against source with code regions blanked out — documenting
  // markup in a code block is not the same as using it.
  const guarded = blankCodeRegions(source);

  // Allow-list guard: reject PascalCase custom components (empty allow-list).
  if (CUSTOM_COMPONENT_PATTERN.test(guarded)) {
    return {
      ok: false,
      error: 'custom components / expressions are not allowed',
    };
  }

  // Guard: reject dangerous lowercase elements.
  if (BLOCKED_ELEMENT_PATTERN.test(guarded)) {
    return {
      ok: false,
      error:
        'MDX compilation failed: blocked element detected. Script, style, iframe, object, and embed tags are not allowed.',
    };
  }

  try {
    // Render via the non-evaluating AST pipeline. No run()/Function/eval.
    const file = await processor.process(source);
    return { ok: true, html: String(file) };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? sanitizeErrorMessage(err.message)
        : 'MDX compilation failed with an unknown error.';

    return { ok: false, error: message };
  }
}

/**
 * Sanitize an error message to remove internal paths or stack details.
 * Returns a safe, human-readable error string.
 */
function sanitizeErrorMessage(message: string): string {
  const firstLine = message.split('\n')[0];
  if (!firstLine) return 'MDX compilation failed.';

  return firstLine
    .replace(/\/.*?node_modules\/[^\s]*/g, '<internal>')
    .replace(/at\s+.*$/gm, '')
    .trim();
}
