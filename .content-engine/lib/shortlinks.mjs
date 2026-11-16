// Short links for social bios (content.config.json "shortLinks", from social.shortLinks in
// the app config): { "ig": "/en/guides/?src=ig" } makes https://<domain>/ig a tiny redirect
// page to that path. The ?src= tag is read by the store link script of the guide pages
// (attribution.mjs). A static page instead of a host redirect works on any static host;
// it is noindex, points its canonical at the target and is never in the sitemap.
import { esc } from './html.mjs';
import { SOURCES } from './attribution.mjs';

export const SHORT_KEY = /^[a-z0-9][a-z0-9-]{0,30}$/;
const TARGET = /^\/(?!\/)[^\s"'<>\\#]*$/;
const RESERVED = new Set(['social', 'assets', '_preview']);

/** Splits "/en/guides/?src=ig" into its path and its src. */
export function parseTarget(target) {
  const [p, query = ''] = String(target).split('?');
  const src = new URLSearchParams(query).get('src');
  return { path: p, src };
}

/**
 * The redirect pages as a Map of "<key>/index.html" to HTML, plus errors: a bad key or
 * target, an unknown src, a target that is not a page of this site, a key that is a section
 * or an existing page.
 */
export function shortLinkPages(config, knownPaths) {
  const pages = new Map();
  const errors = [];
  const sections = new Set([...config.languages, ...Object.values(config.urlPatterns).flatMap((p) => Object.values(p).map((x) => x.split('/')[1]))]);
  for (const [key, target] of Object.entries(config.shortLinks || {})) {
    const where = `content.config.json shortLinks.${key}`;
    if (!SHORT_KEY.test(key)) { errors.push(`${where}: the key must be lowercase letters, digits and dashes`); continue; }
    if (RESERVED.has(key) || sections.has(key) || knownPaths.has(`/${key}/`) || knownPaths.has(`/${key}`)) {
      errors.push(`${where}: /${key} is already a section or page of this site`);
      continue;
    }
    if (typeof target !== 'string' || !TARGET.test(target)) { errors.push(`${where} must be a site path like "/en/guides/?src=ig"`); continue; }
    const { path, src } = parseTarget(target);
    if (src !== null && !SOURCES.includes(src)) { errors.push(`${where}: src=${src} is not one of ${SOURCES.join(', ')}`); continue; }
    if (!knownPaths.has(path) && !knownPaths.has(`${path}/`) && !knownPaths.has(path.replace(/\/$/, ''))) {
      errors.push(`${where}: ${path} is not a page of this site`);
      continue;
    }
    pages.set(`${key}/index.html`, redirectPage(config, target, path));
  }
  return { pages, errors };
}

export function redirectPage(config, target, path) {
  const first = path.split('/')[1];
  const lang = config.languages.includes(first) ? first : config.xDefault;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.brand.name)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(config.url.abs(path))}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)})</script>
</head>
<body>
<p><a href="${esc(target)}">${esc(config.brand.name)}</a></p>
</body>
</html>
`;
}
