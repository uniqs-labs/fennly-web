// content/social/<YYYY-MM-DD>-<slug>/: Instagram and TikTok carousels (slides.json,
// caption.md, ig/NN.jpg, tiktok/NN.jpg), written and rendered by the engine's daily run.
// content/social/reels/<YYYY-MM-DD>-<slug>/: reels (video.mp4, caption.md and optionally
// meta.json {"kind": "ugc" | "demo"}, default ugc), brought in by scripts/sync-reels.sh in
// the engine (since v1.4; kinds since v1.5).
// The build copies every file to /social/ byte for byte and writes /social/index.json:
// every carousel whose article is live and every complete reel, newest first, with
// absolute URLs, so the Instagram API can fetch them. Never in the sitemap, hubs or
// llms.txt, and robots.txt does not block it. A broken carousel or reel is a warning; a
// file over 50 MB is a build error (keeps the repo small).
import fs from 'node:fs';
import path from 'node:path';

export const SOCIAL_DIR = 'social';
export const SOCIAL_INDEX = `${SOCIAL_DIR}/index.json`;
export const REELS_DIR = 'reels';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Reel kinds: first person UGC stories (reach) and app demos (installs). */
export const REEL_KINDS = ['ugc', 'demo'];
export const DEFAULT_REEL_KIND = 'ugc';
/** Files above this size are copied from disk at write time instead of being held in memory. */
const INLINE_BYTES = 2 * 1024 * 1024;
const FOLDER_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const IMAGE_RE = /^\d{2}\.jpg$/;

/** A file the build copies from disk when it writes dist/ (large videos). */
export class FileRef {
  constructor(src) {
    this.src = src;
  }
}

/** Megabytes rounded up, so a file just over the limit never reads as exactly the limit. */
const mb = (n) => `${(Math.ceil((n / 1024 / 1024) * 10) / 10).toFixed(1)} MB`;

/**
 * Every file under content/social/ as a Map of 'social/<rel>' to its bytes (or a FileRef
 * for large files). Files over MAX_FILE_BYTES are reported in `errors` and left out.
 */
function readTree(dir, errors) {
  const files = new Map();
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d).sort()) {
      if (name.startsWith('.')) continue;
      const full = path.join(d, name);
      const stat = fs.lstatSync(full);
      const r = rel ? `${rel}/${name}` : name;
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full, r);
      else if (!stat.isFile()) continue;
      else if (stat.size > MAX_FILE_BYTES) {
        errors.push(`content/${SOCIAL_DIR}/${r} is ${mb(stat.size)}, at most ${MAX_FILE_BYTES / 1024 / 1024} MB is allowed; compress it (scripts/sync-reels.sh in the engine brings reels to 15 MB) or remove it`);
      } else files.set(`${SOCIAL_DIR}/${r}`, stat.size > INLINE_BYTES ? new FileRef(full) : fs.readFileSync(full));
    }
  };
  walk(dir, '');
  return files;
}

/** content/social/reels/: every folder with video.mp4 and caption.md, newest first. */
function loadReels(dir, { config, skip }) {
  const reels = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, name);
    if (name.startsWith('.') || !fs.statSync(folder).isDirectory()) continue;
    const where = `${REELS_DIR}/${name}`;
    const m = FOLDER_RE.exec(name);
    if (!m) { skip(where, 'folder must be named <YYYY-MM-DD>-<slug>'); continue; }
    const video = path.join(folder, 'video.mp4');
    const captionFile = path.join(folder, 'caption.md');
    if (!fs.existsSync(video) || !fs.statSync(video).isFile()) { skip(where, 'video.mp4 is missing'); continue; }
    if (fs.statSync(video).size > MAX_FILE_BYTES) continue;
    if (!fs.existsSync(captionFile)) { skip(where, 'caption.md is missing'); continue; }
    const caption = fs.readFileSync(captionFile, 'utf8').replace(/\r\n/g, '\n').trim();
    if (!caption) { skip(where, 'caption.md is empty'); continue; }
    let kind = DEFAULT_REEL_KIND;
    const metaFile = path.join(folder, 'meta.json');
    if (fs.existsSync(metaFile)) {
      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaFile, 'utf8').replace(/^\uFEFF/, ''));
      } catch (e) {
        skip(where, `meta.json is not valid JSON (${String(e.message).split('\n')[0]})`);
        continue;
      }
      kind = meta?.kind ?? DEFAULT_REEL_KIND;
      if (!REEL_KINDS.includes(kind)) {
        skip(where, `meta.json kind must be ${REEL_KINDS.map((k) => `"${k}"`).join(' or ')}, got ${JSON.stringify(kind)}`);
        continue;
      }
    }
    reels.push({ date: m[1], slug: m[2], kind, videoUrl: config.url.abs(`/${SOCIAL_DIR}/${REELS_DIR}/${name}/video.mp4`), caption });
  }
  return reels.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

/**
 * Loads content/social/. `live` is the universe of live articles. Returns
 * { files, index, items, errors, warnings }; files and index are null-free only when the
 * folder exists, so a site without carousels builds exactly as before.
 */
export function loadSocial(root, { config, live }) {
  const dir = path.join(root, 'content', SOCIAL_DIR);
  const out = { files: new Map(), index: null, items: [], reels: null, errors: [], warnings: [] };
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return out;
  out.files = readTree(dir, out.errors);
  if (out.files.has(SOCIAL_INDEX)) {
    out.errors.push(`content/${SOCIAL_INDEX} would overwrite the generated index; delete it`);
    out.files.delete(SOCIAL_INDEX);
  }
  const skip = (name, why) => out.warnings.push(`content/${SOCIAL_DIR}/${name}: ${why}; not listed in /${SOCIAL_INDEX}`);

  for (const name of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, name);
    if (name.startsWith('.') || name === REELS_DIR || !fs.statSync(folder).isDirectory()) continue;
    const m = FOLDER_RE.exec(name);
    if (!m) { skip(name, 'folder must be named <YYYY-MM-DD>-<slug>'); continue; }
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(folder, 'slides.json'), 'utf8'));
    } catch (e) {
      skip(name, `slides.json missing or invalid (${String(e.message).split('\n')[0]})`);
      continue;
    }
    const article = typeof data?.lang === 'string' && typeof data?.translationKey === 'string' ? live.find(data.lang, data.translationKey) : null;
    if (!article) { skip(name, `no live ${data?.lang} article with translationKey "${data?.translationKey}"`); continue; }
    const captionFile = path.join(folder, 'caption.md');
    if (!fs.existsSync(captionFile)) { skip(name, 'caption.md is missing'); continue; }
    const images = (format) => {
      const d = path.join(folder, format);
      if (!fs.existsSync(d)) return [];
      return fs.readdirSync(d).filter((f) => IMAGE_RE.test(f)).sort()
        .map((f) => config.url.abs(`/${SOCIAL_DIR}/${name}/${format}/${f}`));
    };
    const ig = images('ig');
    const tiktok = images('tiktok');
    if (!ig.length && !tiktok.length) { skip(name, 'no rendered images in ig/ or tiktok/'); continue; }
    out.items.push({
      date: m[1],
      slug: m[2],
      lang: data.lang,
      articleUrl: config.url.abs(article.path),
      caption: fs.readFileSync(captionFile, 'utf8').replace(/\r\n/g, '\n').trim(),
      ig,
      tiktok,
    });
  }
  out.items.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  // "reels" only when content/social/reels/ exists, so a site without reels keeps its index.json.
  const reelsDir = path.join(dir, REELS_DIR);
  if (fs.existsSync(reelsDir) && fs.statSync(reelsDir).isDirectory()) out.reels = loadReels(reelsDir, { config, skip });
  out.index = `${JSON.stringify({ carousels: out.items, ...(out.reels ? { reels: out.reels } : {}) }, null, 2)}\n`;
  return out;
}
