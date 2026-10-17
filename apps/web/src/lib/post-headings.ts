export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

const HEADING_RE = /<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi;
const ID_ATTR_RE = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function headingText(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase ASCII slug; falls back to "section" when nothing usable remains. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/**
 * Adds an `id` to every h2/h3 that lacks one and returns the outline.
 * Only an id attribute is inserted: the markup is otherwise untouched, so the
 * sanitisation done by the API is not weakened. Ids are [a-z0-9-] by
 * construction; a pre-existing id is kept and listed as-is.
 */
export function addHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const used = new Set<string>();

  const unique = (base: string): string => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  const out = html.replace(HEADING_RE, (full, lvl: string, attrs: string, inner: string) => {
    const text = headingText(inner);
    const level = Number(lvl) as 2 | 3;
    const existing = ID_ATTR_RE.exec(attrs);
    if (existing) {
      const id = existing[1] ?? existing[2] ?? '';
      if (id && /^[A-Za-z0-9_:.-]+$/.test(id)) {
        used.add(id);
        if (text) toc.push({ id, text, level });
        return full;
      }
    }
    if (!text) return full;
    const id = unique(slugify(text));
    toc.push({ id, text, level });
    const cleanAttrs = attrs.replace(ID_ATTR_RE, '');
    return `<h${lvl} id="${id}"${cleanAttrs}>${inner}</h${lvl}>`;
  });

  return { html: out, toc };
}
