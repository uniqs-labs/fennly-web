#!/usr/bin/env node
// UNIQS content engine: site builder.
//
// Input:  the site repo (static files), content/<lang>/<type>/<slug>.md, content.config.json
// Output: dist/ = every static file byte for byte, plus article pages, hubs, draft
//         previews under /_preview/, sitemap.xml, robots.txt and llms.txt.
//
// Usage: node build.mjs [--root .] [--out dist] [--engine v1] [--origin https://...] [--drafts-as-live]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig, ConfigError, PREVIEW_DIR } from './lib/config.mjs';
import { loadContent, createUniverse, hreflangFor } from './lib/content.mjs';
import { renderBody } from './lib/markdown.mjs';
import { articlePage, hubPage, previewIndexPage } from './lib/templates.mjs';
import { listStatic, staticConflicts, copyStatic, staticPages } from './lib/static.mjs';
import { sitemapEntries, sitemapXml, robotsTxt, llmsTxt } from './lib/feeds.mjs';
import { outputFile } from './lib/slug.mjs';
import { imageSize } from './lib/imagesize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The engine version this builder belongs to (written by init next to the vendored copy). */
export function engineInfo(dir = HERE) {
  for (const f of [path.join(dir, 'ENGINE.json'), path.join(dir, '..', 'package.json')]) {
    if (fs.existsSync(f)) {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (j.tag) return { version: j.version, tag: j.tag };
      if (j.name === '@uniqs/content-engine') return { version: j.version, tag: `v${j.version.split('.')[0]}` };
    }
  }
  return { version: 'dev', tag: 'dev' };
}

/**
 * Builds the site. Returns { errors, warnings, pages, stats }. Writes nothing when there
 * are errors, so a failed build never leaves a half-written dist/ behind.
 */
export function build({ root = process.cwd(), out, origin, draftsAsLive = false, engine, year = new Date().getUTCFullYear(), write = true } = {}) {
  root = path.resolve(root);
  out = path.resolve(out || path.join(root, 'dist'));
  const errors = [];
  const warnings = [];

  const info = engineInfo();
  if (engine && info.tag !== 'dev' && engine !== info.tag) {
    errors.push(`package.json pins engine ${engine} but .content-engine holds ${info.tag}; re-run "content-engine init" with the tag you want`);
  }

  let config;
  try {
    config = loadSiteConfig(root, { origin });
  } catch (e) {
    if (e instanceof ConfigError) return { errors: [...errors, e.message], warnings, pages: new Map(), stats: {} };
    throw e;
  }

  const loaded = loadContent(root, config);
  errors.push(...loaded.errors);
  warnings.push(...loaded.warnings);
  const articles = loaded.articles;
  if (draftsAsLive) for (const a of articles) a.draft = false;

  const files = listStatic(root, config.build.exclude);
  const pagesStatic = staticPages(root, files);
  const knownPaths = new Set(['/', ...pagesStatic.map((p) => p.path), ...files.map((f) => `/${f}`)]);
  const pages = new Map();

  // Open Graph image per language (an article can override it with `image`).
  const ogImages = {};
  const ogFor = (p) => {
    if (!p) return null;
    if (!(p in ogImages)) {
      try {
        ogImages[p] = { path: p, ...imageSize(fs.readFileSync(path.join(root, p))) };
      } catch {
        warnings.push(`Open Graph image ${p} not found; pages are shared without an image`);
        ogImages[p] = null;
      }
    }
    return ogImages[p];
  };

  const live = createUniverse(articles, { includeDrafts: false, config });
  const preview = createUniverse(articles, { includeDrafts: true, config });
  const drafts = articles.filter((a) => a.draft);

  const footerHubs = {};
  const hubLists = {};
  for (const lang of config.languages) {
    footerHubs[lang] = [...new Set([config.types.includes('guide') ? 'guide' : config.types[0],
      ...config.types.filter((t) => live.list(lang, t).length)])];
    for (const type of Object.keys(config.urlPatterns[lang])) hubLists[`${lang}:${type}`] = live.list(lang, type);
  }
  for (const lang of config.languages) {
    for (const type of Object.keys(config.urlPatterns[lang])) knownPaths.add(config.url.hub(lang, type));
  }
  for (const a of live.articles) knownPaths.add(a.path);

  const linkChecks = [];
  const renderArticle = (a, universe, isPreview) => {
    const st = config.strings[a.lang];
    const rendered = renderBody(a.body, { sources: a.sources.length, root, sourceLabel: st.sources, tableLabel: st.table });
    const report = (list, m) => list.push(`${a.file}: ${m}`);
    for (const m of rendered.errors) report(a.draft ? warnings : errors, m);
    for (const m of rendered.warnings) report(warnings, m);
    if (!isPreview) {
      for (const k of a.related) if (!universe.find(a.lang, k)) warnings.push(`${a.file}: related "${k}" has no live ${a.lang} article yet; skipped`);
    }
    linkChecks.push({ a, links: rendered.links });
    const linkFor = (x) => (isPreview && x.draft ? config.url.preview(x.path) : x.path);
    return articlePage(a, {
      config,
      universe,
      rendered,
      preview: isPreview,
      hreflang: hreflangFor(a, universe, config),
      year,
      ogImage: ogFor(a.image || config.brand.ogImage?.[a.lang]),
      linkFor,
      footerHubs: footerHubs[a.lang],
    });
  };

  for (const a of live.articles) pages.set(outputFile(a.path), renderArticle(a, live, false));
  for (const a of drafts) pages.set(outputFile(config.url.preview(a.path)), renderArticle(a, preview, true));

  // Dead internal links: an error on live pages (the quality gate), a warning in drafts.
  for (const { a, links } of linkChecks) {
    for (const href of links) {
      const ok = knownPaths.has(href) || knownPaths.has(`${href}/`) || knownPaths.has(href.replace(/\/$/, ''));
      if (!ok) (a.draft ? warnings : errors).push(`${a.file}: internal link ${href} does not point to a page on this site`);
    }
  }

  const hubs = [];
  for (const lang of config.languages) {
    for (const type of Object.keys(config.urlPatterns[lang])) {
      const list = hubLists[`${lang}:${type}`];
      const hubLanguages = config.languages.filter((l) => config.urlPatterns[l]?.[type] && hubLists[`${l}:${type}`]?.length);
      const p = config.url.hub(lang, type);
      pages.set(outputFile(p), hubPage(lang, type, {
        config, list, hubLanguages, year, ogImage: ogFor(config.brand.ogImage?.[lang]), footerHubs: footerHubs[lang],
      }));
      if (list.length) hubs.push({ lang, type, path: p, lastmod: list.map((a) => a.reviewed).sort().pop() });
    }
  }

  if (drafts.length) {
    pages.set(`${PREVIEW_DIR}/index.html`, previewIndexPage(drafts, {
      config, year, footerHubs: footerHubs[config.xDefault] || footerHubs[config.languages[0]],
      linkFor: (x) => config.url.preview(x.path),
    }));
  }

  errors.push(...staticConflicts(files, [...pages.keys()]));

  const liveArticles = config.languages.flatMap((l) => live.list(l));
  pages.set('sitemap.xml', sitemapXml(sitemapEntries({ config, pages: pagesStatic, hubs, articles: liveArticles })));
  pages.set('robots.txt', robotsTxt(config));
  pages.set('llms.txt', llmsTxt({ config, articles: liveArticles, hubs, pages: pagesStatic }));

  const stats = { static: files.length, live: live.articles.length, drafts: drafts.length, generated: pages.size };
  if (errors.length || !write) return { errors, warnings, pages, stats, config };

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  copyStatic(root, out, files);
  for (const [rel, html] of pages) {
    const dest = path.join(out, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
  }
  return { errors, warnings, pages, stats, config };
}

function parseArgs(argv) {
  const args = { draftsAsLive: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--root') args.root = next();
    else if (a === '--out') args.out = next();
    else if (a === '--origin') args.origin = next();
    else if (a === '--engine') args.engine = next();
    else if (a === '--drafts-as-live') args.draftsAsLive = true;
    else if (a === 'build') continue;
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const started = Date.now();
  const res = build(args);
  for (const w of res.warnings) console.warn(`warning: ${w}`);
  if (res.errors.length) {
    console.error(`\nBuild failed with ${res.errors.length} error(s):`);
    for (const e of res.errors) console.error(`  - ${e}`);
    return 1;
  }
  const s = res.stats;
  console.log(`content-engine ${engineInfo().tag}: ${s.live} live article(s), ${s.drafts} draft(s), ${s.static} static file(s) copied, ${s.generated} file(s) generated in ${Date.now() - started} ms`);
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.error(e.stack || e.message);
    process.exitCode = 1;
  }
}
