// Slugs and URL paths. Pure functions, unit-tested.

export const SLUG_MAX = 80;
const TRANSLIT = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'ae', Ö: 'oe', Ü: 'ue', ẞ: 'ss' };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A year (1900 to 2099) as its own hyphen-separated part: "guide-2026", "2026-11-13-foo".
const YEAR_RE = /(?:^|-)(?:19|20)\d{2}(?:-|$)/;

/** Any title to a URL slug: lowercase ASCII, hyphens, German umlauts spelled out (ae, oe, ue, ss). */
export function slugify(text) {
  return String(text)
    .replace(/[äöüÄÖÜßẞ]/g, (c) => TRANSLIT[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Human-readable problems with a slug; an empty list means the slug is valid. */
export function slugProblems(slug) {
  if (!slug) return ['slug is empty'];
  const problems = [];
  if (!SLUG_RE.test(slug)) {
    problems.push(`"${slug}" may only use lowercase a-z, 0-9 and single hyphens (try "${slugify(slug)}")`);
  }
  if (YEAR_RE.test(slug)) problems.push(`"${slug}" contains a year; no dates in URLs`);
  if (slug.length > SLUG_MAX) problems.push(`"${slug}" is longer than ${SLUG_MAX} characters`);
  return problems;
}

/** URL path ("/de/ratgeber/x/") to the output file relative to dist ("de/ratgeber/x/index.html"). */
export function outputFile(urlPath) {
  if (!urlPath.startsWith('/') || !urlPath.endsWith('/')) throw new Error(`not a directory path: ${urlPath}`);
  return `${urlPath.slice(1)}index.html`;
}
