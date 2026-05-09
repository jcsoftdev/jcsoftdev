/**
 * MDX compile function.
 *
 * Strategy: compile with `outputFormat: 'function-body'`, run with `@mdx-js/mdx` `run()`,
 * render to static HTML via `react-dom/server` `renderToStaticMarkup`.
 *
 * Allow-list: no custom components permitted. Only standard HTML elements
 * (p, h1-h6, pre, code, strong, em, ul, ol, li, blockquote, a, img, hr, br, table, etc.)
 * are valid. Any PascalCase component reference is blocked before compile.
 *
 * Compile failure: returns `{ ok: false, error: string }` discriminated union.
 * Never throws.
 */
import { compile as mdxCompile, run } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Discriminated union result type for compileMdx.
 */
export type CompileResult = { ok: true; html: string } | { ok: false; error: string };

/**
 * Regex to detect PascalCase component references in MDX source.
 * Matches JSX opening/self-closing tags that start with an uppercase letter.
 * Standard HTML elements are lowercase — this catches custom components only.
 *
 * Examples blocked: <MyComponent />, <UnsafeWidget prop="x" />
 */
const CUSTOM_COMPONENT_PATTERN = /(<\s*[A-Z][A-Za-z0-9]*[\s/>])/;

/**
 * Set of explicitly blocked lowercase element names that are dangerous in SSR.
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
 * Compile MDX source string to a static HTML string.
 *
 * @param source - Raw MDX content
 * @returns CompileResult — either `{ ok: true, html }` or `{ ok: false, error }`
 */
export async function compileMdx(source: string): Promise<CompileResult> {
  // Allow-list guard: reject PascalCase custom components
  if (CUSTOM_COMPONENT_PATTERN.test(source)) {
    return {
      ok: false,
      error:
        'MDX compilation failed: custom components are not allowed. Only standard HTML elements are permitted.',
    };
  }

  // Guard: reject blocked lowercase elements
  if (BLOCKED_ELEMENT_PATTERN.test(source)) {
    return {
      ok: false,
      error:
        'MDX compilation failed: blocked element detected. Script, style, iframe, object, and embed tags are not allowed.',
    };
  }

  try {
    // Compile MDX to a function body — safe for Node SSR, no dynamic import()
    const compiled = await mdxCompile(source, {
      outputFormat: 'function-body',
      development: false,
    });

    // Run the compiled function body with the React runtime
    const { default: MDXComponent } = await run(compiled, {
      ...runtime,
      baseUrl: import.meta.url,
    });

    // Render to static HTML — no React hydration markers
    const html = renderToStaticMarkup(MDXComponent({}));

    return { ok: true, html };
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
