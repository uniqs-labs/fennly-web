// Loads content/<lang>/<type>/<slug>.md, validates frontmatter and the relations between
// articles. Never throws on bad content: problems are collected so one build reports
// all of them at once.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { slugProblems } from './slug.mjs';

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
const REQUIRED = ['title', 'description', 'lang', 'type', 'translationKey', 'published', 'reviewed', 'author', 'sources'];
const OPTIONAL = ['reviewer', 'faq', 'related', 'draft', 'redFlags', 'image'];
const KNOWN = new Set([...REQUIRED, ...OPTIONAL]);
// Leftovers that must never go live.
const PLACEHOLDER_RE = /\b(placeholder|platzhalter|lorem ipsum|todo|tbd|xxx)\b/i;

/** YAML dates arrive as Date objects, quoted ones as strings. Both become "YYYY-MM-DD". */
export function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value) return value;
  }
  return null;
}

const isText = (v) => typeof v === 'string' && v.trim().length > 0;

/** Validates one file. Returns { article, errors, warnings }. */
export function parseArticle({ file, lang, type, slug, source, config }) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(`${file}: ${m}`);
  const warn = (m) => warnings.push(`${file}: ${m}`);

  let parsed;
  try {
    parsed = matter(source);
  } catch (e) {
    err(`frontmatter is not valid YAML (${String(e.message).split('\n')[0]})`);
    return { article: null, errors, warnings };
  }
  const fm = parsed.data;
  const draft = fm.draft === true;
  // Live articles must meet every rule; drafts get warnings so they can be previewed early.
  const strict = (m) => (draft ? warn(m) : err(m));

  for (const key of Object.keys(fm)) {
    if (!KNOWN.has(key)) err(`unknown frontmatter field "${key}" (allowed: ${[...KNOWN].join(', ')})`);
  }
  for (const key of REQUIRED) {
    if (fm[key] === undefined || fm[key] === null || fm[key] === '') err(`missing required field "${key}"`);
  }
  for (const p of slugProblems(slug)) err(`file name: ${p}`);
  if (fm.lang !== undefined && fm.lang !== lang) err(`lang is "${fm.lang}" but the file is in content/${lang}/`);
  if (fm.type !== undefined && fm.type !== type) err(`type is "${fm.type}" but the file is in content/${lang}/${type}/`);
  if (fm.draft !== undefined && typeof fm.draft !== 'boolean') err('draft must be true or false');

  if (fm.title !== undefined) {
    if (!isText(fm.title)) err('title must be text');
    else if (fm.title.trim().length > TITLE_MAX) strict(`title is ${fm.title.trim().length} characters, max ${TITLE_MAX}`);
  }
  if (fm.description !== undefined) {
    if (!isText(fm.description)) err('description must be text');
    else if (fm.description.trim().length > DESCRIPTION_MAX) {
      strict(`description is ${fm.description.trim().length} characters, max ${DESCRIPTION_MAX}`);
    }
  }
  if (fm.author !== undefined && !isText(fm.author)) err('author must be text');
  if (fm.reviewer !== undefined && fm.reviewer !== null && fm.reviewer !== '' && !isText(fm.reviewer)) {
    err('reviewer must be text, or empty until a qualified person has reviewed the article');
  }
  if (fm.translationKey !== undefined && (typeof fm.translationKey !== 'string' || slugProblems(fm.translationKey).length)) {
    err(`translationKey "${fm.translationKey}" must be lowercase a-z, 0-9 and hyphens, no year`);
  }

  const published = fm.published === undefined ? null : normalizeDate(fm.published);
  const reviewed = fm.reviewed === undefined ? null : normalizeDate(fm.reviewed);
  if (fm.published !== undefined && !published) err('published must be a date like 2026-11-13');
  if (fm.reviewed !== undefined && !reviewed) err('reviewed must be a date like 2026-11-13');
  if (published && reviewed && reviewed < published) err(`reviewed (${reviewed}) is before published (${published})`);

  const sources = [];
  if (fm.sources !== undefined && fm.sources !== null) {
    if (!Array.isArray(fm.sources) || fm.sources.length === 0) err('sources must be a list with at least one entry');
    else {
      fm.sources.forEach((s, i) => {
        if (!s || !isText(s.title) || !isText(s.url)) return err(`sources[${i}] needs a title and a url`);
        if (!/^https:\/\/[^\s]+$/.test(s.url.trim())) return err(`sources[${i}].url must start with https:// (got "${s.url}")`);
        sources.push({ title: s.title.trim(), url: s.url.trim() });
      });
      const min = config.rules.minSources || 1;
      if (sources.length < min) strict(`has ${sources.length} sources; the modules for this app require at least ${min}`);
    }
  }

  const faq = [];
  if (fm.faq !== undefined && fm.faq !== null) {
    if (!Array.isArray(fm.faq)) err('faq must be a list of { q, a }');
    else fm.faq.forEach((f, i) => {
      if (!f || !isText(f.q) || !isText(f.a)) return err(`faq[${i}] needs a q and an a`);
      faq.push({ q: f.q.trim(), a: f.a.trim() });
    });
  }

  const related = [];
  if (fm.related !== undefined && fm.related !== null) {
    if (!Array.isArray(fm.related) || fm.related.some((r) => typeof r !== 'string')) err('related must be a list of translationKeys');
    else related.push(...fm.related);
  }

  const redFlags = [];
  if (fm.redFlags !== undefined && fm.redFlags !== null) {
    if (!Array.isArray(fm.redFlags) || fm.redFlags.some((r) => !isText(r))) err('redFlags must be a list of short sentences');
    else redFlags.push(...fm.redFlags.map((r) => r.trim()));
  }

  let image = null;
  if (fm.image !== undefined && fm.image !== null) {
    if (typeof fm.image !== 'string' || !fm.image.startsWith('/assets/')) err('image must be a path under /assets/');
    else image = fm.image;
  }

  if (!draft) {
    const haystack = [fm.title, fm.description, fm.author, fm.reviewer, parsed.content,
      ...faq.flatMap((f) => [f.q, f.a])].join('\n');
    const m = PLACEHOLDER_RE.exec(haystack);
    if (m) err(`contains "${m[0]}"; placeholder text cannot be published (set draft: true or finish it)`);
  }

  if (errors.length) return { article: null, errors, warnings };
  const url = config.url;
  return {
    article: {
      file,
      lang,
      type,
      slug,
      path: url.article(lang, type, slug),
      title: fm.title.trim(),
      description: fm.description.trim(),
      translationKey: fm.translationKey,
      published,
      reviewed,
      author: fm.author.trim(),
      reviewer: isText(fm.reviewer) ? fm.reviewer.trim() : null,
      sources,
      faq,
      related,
      redFlags,
      image,
      draft,
      body: parsed.content,
    },
    errors,
    warnings,
  };
}

/** Reads every article under <root>/content. Returns { articles, errors, warnings }. */
export function loadContent(root, config) {
  const contentDir = path.join(root, 'content');
  const articles = [];
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(contentDir)) return { articles, errors, warnings };
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  const ignore = (name) => name.startsWith('.') || name === 'README.md';

  for (const lang of fs.readdirSync(contentDir).sort()) {
    if (ignore(lang)) continue;
    const langDir = path.join(contentDir, lang);
    if (!fs.statSync(langDir).isDirectory() || !config.languages.includes(lang)) {
      errors.push(`${rel(langDir)}: unexpected entry; content lives in content/{${config.languages.join(',')}}/`);
      continue;
    }
    const types = Object.keys(config.urlPatterns[lang]);
    for (const type of fs.readdirSync(langDir).sort()) {
      if (ignore(type)) continue;
      const dir = path.join(langDir, type);
      if (!fs.statSync(dir).isDirectory() || !types.includes(type)) {
        errors.push(`${rel(dir)}: unexpected entry; use content/${lang}/{${types.join(',')}}/`);
        continue;
      }
      for (const name of fs.readdirSync(dir).sort()) {
        if (ignore(name)) continue;
        const file = path.join(dir, name);
        if (!name.endsWith('.md') || !fs.statSync(file).isFile()) {
          errors.push(`${rel(file)}: only .md files belong here`);
          continue;
        }
        const res = parseArticle({ file: rel(file), lang, type, slug: name.slice(0, -3), source: fs.readFileSync(file, 'utf8'), config });
        errors.push(...res.errors);
        warnings.push(...res.warnings);
        if (res.article) articles.push(res.article);
      }
    }
  }
  const relations = checkRelations(articles);
  errors.push(...relations.errors);
  warnings.push(...relations.warnings);
  return { articles, errors, warnings };
}

/**
 * Cross-article rules: one live article per translationKey and language; language
 * versions share a type. A draft may shadow a live article (an update in progress).
 */
export function checkRelations(articles) {
  const errors = [];
  const warnings = [];
  const seen = new Map();
  for (const a of articles) {
    const k = `${a.lang}:${a.translationKey}:${a.draft ? 'draft' : 'live'}`;
    if (seen.has(k)) errors.push(`${a.file}: translationKey "${a.translationKey}" is already used by ${seen.get(k).file}`);
    else seen.set(k, a);
  }
  for (const a of articles.filter((x) => x.draft)) {
    const live = seen.get(`${a.lang}:${a.translationKey}:live`);
    if (live) warnings.push(`${a.file}: draft for "${a.translationKey}" exists next to the live ${live.file}; only the live one is public`);
  }
  for (const a of articles) {
    for (const other of articles) {
      if (other.lang > a.lang && other.translationKey === a.translationKey && other.draft === a.draft && other.type !== a.type) {
        errors.push(`${a.file}: paired with ${other.file} (translationKey "${a.translationKey}") but the types differ (${a.type} vs ${other.type})`);
      }
    }
    if (a.related.includes(a.translationKey)) errors.push(`${a.file}: related lists the article itself ("${a.translationKey}")`);
  }
  return { errors, warnings };
}

/**
 * The articles visible in one render. The public site sees live articles only; the
 * preview sees drafts too (a draft wins over the live version of the same key there).
 */
export function createUniverse(articles, { includeDrafts, config }) {
  const visible = includeDrafts ? articles : articles.filter((a) => !a.draft);
  const byKey = new Map();
  for (const a of visible) {
    const k = `${a.lang}:${a.translationKey}`;
    if (!byKey.has(k) || (includeDrafts && a.draft)) byKey.set(k, a);
  }
  const unique = [...byKey.values()];
  return {
    articles: unique,
    find: (lang, key) => byKey.get(`${lang}:${key}`) || null,
    versions: (a) => config.languages.map((l) => byKey.get(`${l}:${a.translationKey}`)).filter((v) => v && v.type === a.type),
    related(a, limit = 3) {
      const picked = a.related.map((k) => byKey.get(`${a.lang}:${k}`)).filter(Boolean);
      // Fill up with the newest articles of the same language so every page links onward.
      for (const other of this.list(a.lang)) {
        if (picked.length >= limit) break;
        if (other !== a && !picked.includes(other)) picked.push(other);
      }
      return picked.slice(0, limit);
    },
    list: (lang, type) => unique
      .filter((a) => a.lang === lang && (!type || a.type === type))
      .sort((x, y) => y.published.localeCompare(x.published) || x.title.localeCompare(y.title)),
  };
}

/**
 * hreflang alternates: one per language version plus x-default (the xDefault language
 * version when it exists, else the article itself). Paths are site paths.
 */
export function hreflangFor(article, universe, config) {
  const versions = universe.versions(article);
  if (!versions.includes(article)) versions.push(article);
  const xDefault = versions.find((v) => v.lang === config.xDefault) || article;
  return [
    ...versions.map((v) => ({ hreflang: v.lang, path: v.path })),
    { hreflang: 'x-default', path: xDefault.path },
  ];
}
