// Markdown to article parts. The body is split at H2s so the template can build the
// table of contents and place the in-article call to action after the second section.
import fs from 'node:fs';
import path from 'node:path';
import { Marked, Renderer } from 'marked';
import { imageSize } from './imagesize.mjs';
import { slugify } from './slug.mjs';
import { esc, plainText } from './html.mjs';

// ids the template uses itself; a heading with the same text gets a suffix.
const RESERVED_IDS = ['main', 'toc', 'summary', 'faq', 'sources', 'disclaimer', 'related', 'cta', 'cta-inline', 'cta-end'];
const FORBIDDEN_HTML = /<\s*(script|iframe|style|link|object|embed|form|input|meta|base|frame)\b|\son[a-z]+\s*=/i;

/**
 * Creates a renderer bound to one article. ctx.sources is the number of sources (for
 * [n] citations), ctx.root the site root used to read image sizes, ctx.links collects
 * internal links for the dead-link check.
 */
function createMarked(ctx) {
  const md = new Marked({ gfm: true, breaks: false });
  md.use({
    extensions: [
      {
        // "[2]" in running text links to the second entry of the sources list.
        name: 'cite',
        level: 'inline',
        start(src) {
          const m = /\[\d{1,2}\]/.exec(src);
          return m ? m.index : undefined;
        },
        tokenizer(src) {
          const m = /^\[(\d{1,2})\](?![(\[:])/.exec(src);
          return m ? { type: 'cite', raw: m[0], n: Number(m[1]) } : undefined;
        },
        renderer(token) {
          if (token.n < 1 || token.n > ctx.sources) {
            ctx.error(`citation [${token.n}] has no matching entry in sources (there are ${ctx.sources})`);
          } else ctx.cited.add(token.n);
          return `<sup class="cite"><a href="#source-${token.n}">[${token.n}]</a></sup>`;
        },
      },
    ],
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        if (depth === 1) return `<h2>${html}</h2>\n`;
        return `<h${depth}>${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        if (href.startsWith('/')) ctx.links.add(href.split(/[?#]/)[0]);
        if (/^javascript:/i.test(href)) {
          ctx.error(`link "${href}" is not allowed`);
          return text;
        }
        const t = title ? ` title="${esc(title)}"` : '';
        return `<a href="${esc(href)}"${t}>${text}</a>`;
      },
      image({ href, title, text }) {
        if (!text || !text.trim()) ctx.error(`image ${href} needs alt text: ![what it shows](${href})`);
        if (/^([a-z]+:)?\/\//i.test(href)) {
          ctx.error(`image ${href} is external; put it in /assets/ (no external resources on pages)`);
          return '';
        }
        if (!href.startsWith('/assets/')) {
          ctx.error(`image ${href} must be an absolute path under /assets/`);
          return '';
        }
        let dims;
        try {
          dims = imageSize(fs.readFileSync(path.join(ctx.root, decodeURI(href.split(/[?#]/)[0]))));
        } catch {
          ctx.error(`image ${href} not found or unreadable`);
          return '';
        }
        const cls = dims.height > dims.width ? ' class="portrait"' : '';
        const t = title ? ` title="${esc(title)}"` : '';
        return `<img src="${esc(href)}" alt="${esc(text)}" width="${dims.width}" height="${dims.height}" loading="lazy" decoding="async"${cls}${t}>`;
      },
      table(token) {
        // Wide tables scroll sideways on phones; focusable and labelled for keyboard users.
        const html = Renderer.prototype.table.call(this, token);
        return `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(ctx.tableLabel)}">${html}</div>\n`;
      },
      html({ text }) {
        if (FORBIDDEN_HTML.test(text)) {
          ctx.error(`raw HTML "${text.trim().slice(0, 40)}" is not allowed`);
          return '';
        }
        return text;
      },
    },
  });
  return md;
}

/**
 * Renders an article body. Returns
 *   { summaryHtml, sections: [{ id, titleHtml, titleText, html }], links, errors, warnings, inline }
 * where the summary is the single paragraph before the first H2.
 */
export function renderBody(markdown, { sources = 0, root, sourceLabel = 'Source', tableLabel = 'Table' }) {
  const errors = [];
  const warnings = [];
  const ctx = { sources, root, sourceLabel, tableLabel, cited: new Set(), links: new Set(), error: (m) => errors.push(m) };
  const md = createMarked(ctx);
  const tokens = md.lexer(markdown);

  for (const t of tokens) {
    if (t.type === 'heading' && t.depth === 1) errors.push(`remove the "# ${t.text}" heading; the H1 comes from the title field`);
  }

  const firstH2 = tokens.findIndex((t) => t.type === 'heading' && t.depth === 2);
  const intro = (firstH2 === -1 ? tokens : tokens.slice(0, firstH2)).filter((t) => t.type !== 'space');
  let summaryHtml = '';
  if (intro.length !== 1 || intro[0].type !== 'paragraph') {
    errors.push('the body must start with exactly one summary paragraph before the first "## " heading');
  } else {
    summaryHtml = md.parser(intro);
  }
  if (firstH2 === -1) errors.push('the body needs "## " sections after the summary');

  const sections = [];
  const used = new Set(RESERVED_IDS);
  if (firstH2 !== -1) {
    let current = null;
    for (const t of tokens.slice(firstH2)) {
      if (t.type === 'heading' && t.depth === 2) {
        const titleHtml = md.parseInline(t.text);
        const titleText = plainText(titleHtml);
        const base = slugify(titleText) || 'section';
        let id = base;
        for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
        used.add(id);
        current = { id, titleHtml, titleText, tokens: [] };
        sections.push(current);
      } else {
        current.tokens.push(t);
      }
    }
  }
  for (const s of sections) {
    s.html = md.parser(s.tokens);
    delete s.tokens;
  }

  for (let n = 1; n <= sources; n++) {
    if (!ctx.cited.has(n)) warnings.push(`source ${n} is never cited; add [${n}] after the claim it supports`);
  }

  return {
    summaryHtml,
    sections,
    links: ctx.links,
    errors,
    warnings,
    inline: (s) => md.parseInline(s),
  };
}

/** Words in a Markdown body, for the build report. */
export function wordCount(markdown) {
  return plainText(markdown.replace(/[#*_`>|[\]()-]/g, ' ')).split(' ').filter(Boolean).length;
}
