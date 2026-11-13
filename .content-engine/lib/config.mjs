// Loads and checks content.config.json (written by `content-engine init`) and derives
// the URL helpers every other module uses. A broken config is a build error with a
// message that says which key to fix.
import fs from 'node:fs';
import path from 'node:path';
import { STRINGS } from './strings.mjs';

export const CONFIG_FILE = 'content.config.json';
export const PREVIEW_DIR = '_preview';
export const CAMPAIGN_MAX = 40;

const HEX = /^#[0-9a-fA-F]{6}$/;
const LANG = /^[a-z]{2}$/;
const COLOR_KEYS = ['primary', 'primaryDark', 'background', 'surface', 'text', 'muted', 'line', 'soft'];

export class ConfigError extends Error {}

/** Reads <root>/content.config.json, applies an optional origin override, validates. */
export function loadSiteConfig(root, { origin } = {}) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) {
    throw new ConfigError(`${CONFIG_FILE} not found in ${root}; run "content-engine init --app <id>" first`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${CONFIG_FILE} is not valid JSON: ${e.message}`);
  }
  if (origin) raw.origin = origin;
  return normalizeConfig(raw);
}

/** Validates a parsed config object and returns it with defaults and helpers attached. */
export function normalizeConfig(raw) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  const c = structuredClone(raw);

  need(typeof c.origin === 'string' && /^https?:\/\/[^/\s]+$/.test(c.origin.replace(/\/$/, '')), 'origin must be like "https://example.com"');
  c.origin = String(c.origin || '').replace(/\/$/, '');
  need(Array.isArray(c.languages) && c.languages.length > 0 && c.languages.every((l) => LANG.test(l)), 'languages must be a list like ["de", "en"]');
  const langs = Array.isArray(c.languages) ? c.languages : [];
  c.xDefault = c.xDefault || langs[0];
  need(langs.includes(c.xDefault), `xDefault "${c.xDefault}" must be one of languages`);

  const b = c.brand || {};
  need(typeof b.name === 'string' && b.name.trim(), 'brand.name is required');
  need(typeof b.publisher === 'string' && b.publisher.trim(), 'brand.publisher is required');
  need(typeof b.logo === 'string' && b.logo.startsWith('/'), 'brand.logo must be a site path like "/assets/icon.png"');
  for (const k of COLOR_KEYS) need(HEX.test(b.colors?.[k] || ''), `brand.colors.${k} must be a hex color like "#3E7C5A"`);
  need(typeof b.fontStack === 'string' && b.fontStack.trim() && !/url\(|@import/i.test(b.fontStack), 'brand.fontStack must be a CSS font stack (system fonts only, no web fonts)');

  const types = new Set();
  const hubSeen = new Map();
  for (const lang of langs) {
    const patterns = c.urlPatterns?.[lang];
    need(patterns && typeof patterns === 'object', `urlPatterns.${lang} is missing`);
    for (const [type, pattern] of Object.entries(patterns || {})) {
      types.add(type);
      const ok = typeof pattern === 'string' && /^\/[a-z0-9/-]*\{slug\}\/$/.test(pattern) && pattern.split('{slug}').length === 2;
      need(ok, `urlPatterns.${lang}.${type} must look like "/${lang}/guides/{slug}/" (got ${JSON.stringify(pattern)})`);
      if (ok) {
        const hub = pattern.split('{slug}')[0];
        need(hub !== '/', `urlPatterns.${lang}.${type} needs a section path before {slug}`);
        need(!hub.startsWith(`/${PREVIEW_DIR}/`), `urlPatterns.${lang}.${type} may not live under /${PREVIEW_DIR}/`);
        if (hubSeen.has(hub)) problems.push(`urlPatterns.${lang}.${type} and ${hubSeen.get(hub)} share the section ${hub}`);
        hubSeen.set(hub, `urlPatterns.${lang}.${type}`);
      }
    }
  }
  c.types = [...types];

  const s = c.store || {};
  need(!s.appleId || /^\d+$/.test(String(s.appleId)), 'store.appleId must be the numeric App Store id');
  need(!s.applePt || /^\d+$/.test(String(s.applePt)), 'store.applePt must be the numeric provider token');
  need(!s.playPackage || /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(s.playPackage), 'store.playPackage must be a package name like "com.example.app"');
  need(s.appleId || s.playPackage, 'store needs at least appleId or playPackage');

  c.home = c.home || {};
  c.legal = Array.isArray(c.legal) ? c.legal : [];
  for (const [i, l] of c.legal.entries()) {
    need(typeof l.href === 'string' && (l.href.startsWith('/') || /^(https?:|mailto:)/.test(l.href)), `legal[${i}].href must be a path or URL`);
    for (const lang of langs) need(typeof l.label?.[lang] === 'string', `legal[${i}].label.${lang} is missing`);
  }

  c.copy = c.copy || {};
  c.strings = {};
  for (const lang of langs) {
    const base = STRINGS[lang];
    const override = c.uiStrings?.[lang];
    need(base || override, `no UI strings for "${lang}"; add uiStrings.${lang} to ${CONFIG_FILE}`);
    c.strings[lang] = deepMerge(base || STRINGS.en, override || {});
    const copy = c.copy[lang];
    need(copy && typeof copy === 'object', `copy.${lang} is missing`);
    if (!copy) continue;
    need(typeof copy.tagline === 'string' && copy.tagline.trim(), `copy.${lang}.tagline is required`);
    for (const part of ['inline', 'end']) {
      need(typeof copy.cta?.[part]?.title === 'string' && typeof copy.cta?.[part]?.text === 'string', `copy.${lang}.cta.${part} needs title and text`);
    }
    need(typeof copy.aiNote === 'string' && copy.aiNote.trim(), `copy.${lang}.aiNote is required`);
    copy.hubs = copy.hubs || {};
    for (const type of types) {
      const h = copy.hubs[type];
      need(h && typeof h.title === 'string' && typeof h.description === 'string' && typeof h.intro === 'string',
        `copy.${lang}.hubs.${type} needs title, description and intro`);
    }
  }

  c.cta = { placement: ['afterSecondH2', 'end'], ...(c.cta || {}) };
  need(Array.isArray(c.cta.placement) && c.cta.placement.every((p) => ['afterSecondH2', 'end'].includes(p)),
    'cta.placement may only contain "afterSecondH2" and "end"');

  c.disclaimers = Array.isArray(c.disclaimers) ? c.disclaimers : [];
  for (const [i, d] of c.disclaimers.entries()) {
    for (const lang of langs) {
      need(typeof d[lang]?.title === 'string' && typeof d[lang]?.text === 'string', `disclaimers[${i}].${lang} needs title and text`);
    }
  }
  c.rules = { minSources: 1, ...(c.rules || {}) };
  c.sitemap = { pages: {}, exclude: [], ...(c.sitemap || {}) };
  c.robots = { allow: ['*'], ...(c.robots || {}) };
  c.build = { exclude: [], ...(c.build || {}) };

  if (problems.length) {
    throw new ConfigError(`${CONFIG_FILE} has problems:\n  - ${problems.join('\n  - ')}`);
  }
  c.url = createUrls(c);
  return c;
}

/** URL helpers bound to a config. */
export function createUrls(c) {
  return {
    article: (lang, type, slug) => c.urlPatterns[lang][type].replace('{slug}', slug),
    hub: (lang, type) => c.urlPatterns[lang][type].split('{slug}')[0],
    abs: (p) => c.origin + p,
    preview: (p) => `/${PREVIEW_DIR}${p}`,
    home: (lang) => c.home[lang] || '/',
  };
}

function deepMerge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}
