// Page templates: shared layout, article, hub and the draft preview index.
// Output is plain HTML with inline CSS and one tiny inline script. No tracking, no
// cookies, no external fonts or requests.
import { esc, jsonForScript, plainText, LANGUAGE_NAMES } from './html.mjs';
import { formatDate } from './strings.mjs';
import { stylesheet } from './css.mjs';
import { browserScript, storeLinks } from './attribution.mjs';

const ICON = {
  ios: '<path d="M17.05 12.54c.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.77 2.29-1.61 2.79-.41 6.92 1.15 9.19.76 1.11 1.67 2.35 2.86 2.31 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 2.99.72 1.24-.02 2.02-1.13 2.78-2.24.87-1.28 1.23-2.53 1.25-2.59-.03-.01-2.4-.92-2.42-3.65zM14.79 5.6c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.68-1.09 1.77-.96 2.81 1.02.08 2.06-.52 2.69-1.28z"/>',
  android: '<path d="M3.6 2.4c-.3.3-.5.8-.5 1.4v16.4c0 .6.2 1.1.5 1.4l.1.1 9.2-9.2v-.2L3.6 2.4zM16.3 15.1l-3.1-3.1v-.2l3.1-3.1.1.1 3.6 2.1c1 .6 1 1.6 0 2.2l-3.6 2.1-.1-.1zM15.6 15.8L12.4 12.6 3.2 21.8c.3.4.9.4 1.5.1l10.9-6.1M15.6 8.2L4.7 2.1c-.6-.3-1.2-.3-1.5.1l9.2 9.2 3.2-3.2z"/>',
};

/** Store buttons with attribution; `slug` names the campaign (blog_<slug>). */
export function storeButtons(config, lang, slug) {
  const s = config.strings[lang].store;
  const links = storeLinks(config, lang, slug);
  return `<div class="stores">${['ios', 'android'].filter((k) => links[k]).map((k) =>
    `<a class="store" data-${k} data-base="${esc(links[k].base)}" href="${esc(links[k].href)}">` +
    `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">${ICON[k]}</svg>` +
    `<span><span class="s">${esc(s[k].small)}</span> <span class="b">${esc(s[k].big)}</span></span></a>`,
  ).join('')}</div>`;
}

function fullTitle(title, brand) {
  if (title.toLowerCase().includes(brand.toLowerCase())) return title;
  const t = `${title} | ${brand}`;
  return t.length <= 70 ? t : title;
}

/** The HTML document shell shared by every generated page. */
export function layout(o) {
  const { config, lang } = o;
  const st = config.strings[lang];
  const brand = config.brand;
  const url = config.url;
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(fullTitle(o.title, brand.name))}</title>`,
    `<meta name="description" content="${esc(o.description)}">`,
    `<meta name="robots" content="${o.robots}">`,
  ];
  if (o.canonical) head.push(`<link rel="canonical" href="${esc(o.canonical)}">`);
  for (const a of o.alternates || []) head.push(`<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}">`);
  const og = o.og || {};
  head.push(
    `<meta property="og:type" content="${og.type || 'website'}">`,
    `<meta property="og:site_name" content="${esc(brand.name)}">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:locale" content="${st.ogLocale}">`,
  );
  if (o.canonical) head.push(`<meta property="og:url" content="${esc(o.canonical)}">`);
  for (const l of o.ogLocaleAlternates || []) head.push(`<meta property="og:locale:alternate" content="${config.strings[l].ogLocale}">`);
  if (og.image) {
    head.push(`<meta property="og:image" content="${esc(url.abs(og.image.path))}">`);
    if (og.image.width) head.push(`<meta property="og:image:width" content="${og.image.width}">`, `<meta property="og:image:height" content="${og.image.height}">`);
  }
  if (og.published) head.push(`<meta property="article:published_time" content="${og.published}">`);
  if (og.modified) head.push(`<meta property="article:modified_time" content="${og.modified}">`);
  head.push(
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="theme-color" content="${brand.colors.primary}">`,
    `<link rel="icon" href="${esc(brand.favicon || brand.logo)}">`,
    `<style>${stylesheet(brand)}</style>`,
  );
  if (o.jsonld) head.push(`<script type="application/ld+json">${jsonForScript(o.jsonld)}</script>`);

  const guideHubType = config.types.includes('guide') ? 'guide' : config.types[0];
  const navLinks = [`<a href="${esc(url.hub(lang, guideHubType))}">${esc(st.section[guideHubType] || guideHubType)}</a>`];
  for (const l of o.languageLinks || []) {
    navLinks.push(`<a class="lang" href="${esc(l.href)}" hreflang="${l.lang}" lang="${l.lang}">${esc(LANGUAGE_NAMES[l.lang] || l.lang.toUpperCase())}</a>`);
  }

  const footHubs = (o.footerHubs || [guideHubType]).map((t) =>
    `<li><a href="${esc(url.hub(lang, t))}">${esc(st.section[t] || t)}</a></li>`);
  const legal = config.legal.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label[lang])}</a></li>`);
  const contact = config.contact ? [`<li><a href="mailto:${esc(config.contact)}">${esc(config.contact)}</a></li>`] : [];

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${head.join('\n')}
</head>
<body>
<a class="skip" href="#main">${esc(st.skip)}</a>
${o.preview ? `<div class="preview" role="note">${esc(st.preview.banner)}</div>\n` : ''}<header class="site"><div class="wrap bar">
<a class="brand" href="${esc(url.home(lang))}"><img src="${esc(brand.logo)}" alt="" width="32" height="32">${esc(brand.name)}</a>
<nav class="nav" aria-label="${esc(st.mainNav)}">${navLinks.join('')}</nav>
</div></header>
<main id="main">
${o.body}
</main>
<footer class="foot"><div class="wrap">
<ul>${[...footHubs, ...legal, ...contact].join('')}</ul>
<p>© ${o.year} ${esc(brand.publisher)}</p>
</div></footer>
<script>${browserScript(config, lang)}</script>
</body>
</html>
`;
}

function breadcrumbs(config, lang, items) {
  const st = config.strings[lang];
  const li = items.map((it, i) => (i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.name)}</span></li>`
    : `<li><a href="${esc(it.href)}">${esc(it.name)}</a></li>`));
  return `<nav class="crumbs" aria-label="${esc(st.breadcrumb)}"><ol>${li.join('')}</ol></nav>`;
}

function breadcrumbLd(config, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.abs })),
  };
}

function publisherLd(config) {
  return {
    '@type': 'Organization',
    name: config.brand.publisher,
    alternateName: config.brand.name,
    url: `${config.origin}/`,
    logo: { '@type': 'ImageObject', url: config.url.abs(config.brand.logo) },
  };
}

function ctaBox(config, lang, slug, id) {
  const cta = config.copy[lang].cta.inline;
  return `<div class="box cta" id="${id}"><p class="box-title">${esc(cta.title)}</p><p>${esc(cta.text)}</p>${storeButtons(config, lang, slug)}</div>`;
}

function ctaBand(config, lang, slug) {
  const cta = config.copy[lang].cta.end;
  return `<div class="band" id="cta-end"><p class="box-title">${esc(cta.title)}</p><p>${esc(cta.text)}</p>${storeButtons(config, lang, slug)}${cta.trust ? `<p class="trust">${esc(cta.trust)}</p>` : ''}</div>`;
}

function disclaimerBoxes(config, lang, extraFlags) {
  return config.disclaimers.map((d, i) => {
    const t = d[lang];
    const flags = [...(t.flags || []), ...(i === 0 ? extraFlags : [])];
    const id = i ? `disclaimer-${i + 1}` : 'disclaimer';
    return `<div class="box disclaimer" role="note" aria-labelledby="${id}-title" id="${id}"><p class="box-title" id="${id}-title">${esc(t.title)}</p><p>${esc(t.text)}</p>` +
      (flags.length ? `<ul>${flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '') +
      (t.outro ? `<p>${esc(t.outro)}</p>` : '') + '</div>';
  }).join('\n');
}

function cards(config, lang, list, linkFor) {
  const st = config.strings[lang];
  return `<ul class="cards grid">${list.map((a) =>
    `<li><a href="${esc(linkFor(a))}"><span class="t">${esc(a.title)}</span><span class="d">${esc(a.description)}</span>` +
    `<span class="m">${esc(st.cardReviewed)} ${esc(formatDate(a.reviewed, st))}</span></a></li>`).join('')}</ul>`;
}

/**
 * Article page. ctx: { config, universe, rendered, hreflang, preview, year, ogImage, linkFor }
 * linkFor(article) gives the path to link another article in this render (preview or live).
 */
export function articlePage(a, ctx) {
  const { config, universe, rendered, preview } = ctx;
  const lang = a.lang;
  const st = config.strings[lang];
  const url = config.url;
  const hubPath = url.hub(lang, a.type);
  const canonical = url.abs(a.path);
  const crumbs = [
    { name: config.brand.name, href: url.home(lang), abs: `${config.origin}/` },
    { name: st.section[a.type] || a.type, href: hubPath, abs: url.abs(hubPath) },
    { name: a.title, href: a.path, abs: canonical },
  ];

  const toc = rendered.sections.map((s) => `<li><a href="#${s.id}">${s.titleHtml.replace(/<(?!\/?(em|strong|code)\b)[^>]+>/g, '')}</a></li>`);
  if (a.faq.length) toc.push(`<li><a href="#faq">${esc(st.faq)}</a></li>`);
  toc.push(`<li><a href="#sources">${esc(st.sources)}</a></li>`);

  const inline = config.cta.placement.includes('afterSecondH2');
  const sections = rendered.sections.map((s, i) => {
    let html = `<section aria-labelledby="${s.id}"><h2 id="${s.id}">${s.titleHtml}</h2>\n${s.html}</section>`;
    if (inline && i === 1 && rendered.sections.length > 2) html += `\n${ctaBox(config, lang, a.slug, 'cta-inline')}`;
    return html;
  });

  const byline = [`${esc(st.by)} ${esc(a.author)}`];
  if (a.reviewer) byline.push(`${esc(st.reviewedBy)} ${esc(a.reviewer)}`);
  byline.push(`${esc(st.lastReviewed)} <time datetime="${a.reviewed}">${esc(formatDate(a.reviewed, st))}</time>`);

  const faq = a.faq.length
    ? `<section class="faq" aria-labelledby="faq"><h2 id="faq">${esc(st.faq)}</h2>${a.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${rendered.inline(f.a)}</p>`).join('')}</section>`
    : '';
  const sources = `<section class="sources" aria-labelledby="sources"><h2 id="sources">${esc(st.sources)}</h2><ol>${a.sources.map((s, i) =>
    `<li id="source-${i + 1}"><a href="${esc(s.url)}">${esc(s.title)}</a> <span class="host">(${esc(new URL(s.url).hostname.replace(/^www\./, ''))})</span></li>`).join('')}</ol>` +
    `<p class="note">${esc(config.copy[lang].aiNote)}</p></section>`;

  const related = universe.related(a);
  const relatedHtml = related.length
    ? `<section aria-labelledby="related"><h2 id="related">${esc(st.related)}</h2>${cards(config, lang, related, ctx.linkFor)}</section>`
    : '';

  const body = `<div class="wrap narrow">
${breadcrumbs(config, lang, preview ? crumbs.map((c, i) => (i === 2 ? { ...c, href: ctx.linkFor(a) } : c)) : crumbs)}
<article>
<header><p class="kicker">${esc(st.kind[a.type] || a.type)}</p><h1>${esc(a.title)}</h1><p class="byline">${byline.join(' · ')}</p></header>
<div class="summary" id="summary"><p class="label">${esc(st.summary)}</p>${rendered.summaryHtml}</div>
<nav class="toc" aria-labelledby="toc-label"><p class="label" id="toc-label">${esc(st.toc)}</p><ol>${toc.join('')}</ol></nav>
<div class="prose">
${sections.join('\n')}
</div>
${disclaimerBoxes(config, lang, a.redFlags)}
${faq}
${sources}
</article>
${config.cta.placement.includes('end') ? ctaBand(config, lang, a.slug) : ''}
${relatedHtml}
</div>`;

  const versions = universe.versions(a);
  const others = versions.filter((v) => v.lang !== lang);
  const languageLinks = config.languages.filter((l) => l !== lang).map((l) => {
    const v = others.find((o) => o.lang === l);
    return { lang: l, href: v ? ctx.linkFor(v) : url.hub(l, a.type) };
  });

  const ogImage = ctx.ogImage;
  const jsonld = preview ? null : {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: a.title,
        description: a.description,
        inLanguage: lang,
        datePublished: a.published,
        dateModified: a.reviewed,
        author: { '@type': 'Organization', name: a.author, url: `${config.origin}/` },
        publisher: publisherLd(config),
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        ...(ogImage ? { image: url.abs(ogImage.path) } : {}),
        citation: a.sources.map((s) => ({ '@type': 'CreativeWork', name: s.title, url: s.url })),
      },
      breadcrumbLd(config, crumbs),
      ...(a.faq.length ? [{
        '@type': 'FAQPage',
        mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plainText(rendered.inline(f.a)) } })),
      }] : []),
    ],
  };

  return layout({
    config,
    lang,
    title: a.title,
    description: a.description,
    robots: preview ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    canonical: preview ? null : canonical,
    alternates: preview ? [] : ctx.hreflang.map((h) => ({ hreflang: h.hreflang, href: url.abs(h.path) })),
    og: { type: 'article', image: ogImage, published: a.published, modified: a.reviewed },
    ogLocaleAlternates: others.map((o) => o.lang),
    jsonld,
    body,
    languageLinks,
    preview,
    year: ctx.year,
    footerHubs: ctx.footerHubs,
  });
}

/** Hub page for one language and type. Empty hubs are noindex until the first article is live. */
export function hubPage(lang, type, ctx) {
  const { config, list } = ctx;
  const st = config.strings[lang];
  const url = config.url;
  const copy = config.copy[lang].hubs[type];
  const path = url.hub(lang, type);
  const canonical = url.abs(path);
  const crumbs = [
    { name: config.brand.name, href: url.home(lang), abs: `${config.origin}/` },
    { name: st.section[type] || type, href: path, abs: canonical },
  ];
  const alternates = ctx.hubLanguages.map((l) => ({ hreflang: l, href: url.abs(url.hub(l, type)) }));
  if (alternates.length) alternates.push({ hreflang: 'x-default', href: url.abs(url.hub(ctx.hubLanguages.includes(config.xDefault) ? config.xDefault : lang, type)) });
  const empty = list.length === 0;

  const body = `<div class="wrap">
${breadcrumbs(config, lang, crumbs)}
<header class="hub-head"><h1>${esc(copy.h1 || st.section[type] || type)}</h1><p class="lede">${esc(copy.intro)}</p></header>
${empty ? `<p class="empty">${esc(copy.empty || st.empty)}</p>` : cards(config, lang, list, (a) => a.path)}
${config.cta.placement.includes('end') ? ctaBand(config, lang, path.split('/').filter(Boolean).pop()) : ''}
</div>`;

  return layout({
    config,
    lang,
    title: copy.title,
    description: copy.description,
    robots: empty ? 'noindex, follow' : 'index, follow',
    canonical,
    alternates: empty ? [] : alternates,
    og: { type: 'website', image: ctx.ogImage },
    ogLocaleAlternates: ctx.hubLanguages.filter((l) => l !== lang),
    jsonld: empty ? null : {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${canonical}#page`,
          name: copy.title,
          description: copy.description,
          inLanguage: lang,
          url: canonical,
          publisher: publisherLd(config),
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: list.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: url.abs(a.path), name: a.title })),
          },
        },
        breadcrumbLd(config, crumbs),
      ],
    },
    body,
    languageLinks: config.languages.filter((l) => l !== lang).map((l) => ({ lang: l, href: url.hub(l, type) })),
    preview: false,
    year: ctx.year,
    footerHubs: ctx.footerHubs,
  });
}

/** /_preview/: every draft with a link to its preview page. */
export function previewIndexPage(drafts, ctx) {
  const { config } = ctx;
  const lang = config.languages.includes(config.xDefault) ? config.xDefault : config.languages[0];
  const st = config.strings[lang];
  const groups = config.languages.map((l) => {
    const list = drafts.filter((d) => d.lang === l);
    if (!list.length) return '';
    return `<section aria-labelledby="drafts-${l}"><h2 id="drafts-${l}" lang="${l}">${esc(LANGUAGE_NAMES[l] || l)}</h2>${cards(config, l, list, ctx.linkFor)}</section>`;
  }).join('\n');
  const body = `<div class="wrap"><header class="hub-head"><h1>${esc(st.preview.title)}</h1><p class="lede">${esc(st.preview.intro)}</p></header>
${groups || `<p class="empty">${esc(st.preview.none)}</p>`}
</div>`;
  return layout({
    config,
    lang,
    title: st.preview.title,
    description: st.preview.intro,
    robots: 'noindex, nofollow',
    canonical: null,
    body,
    languageLinks: [],
    preview: true,
    year: ctx.year,
    footerHubs: ctx.footerHubs,
  });
}
