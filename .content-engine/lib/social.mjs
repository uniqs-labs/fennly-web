// content/social/<YYYY-MM-DD>-<slug>/: Instagram and TikTok carousels (slides.json,
// caption.md, ig/NN.jpg, tiktok/NN.jpg), written and rendered by the engine's daily run.
// The build copies every file to /social/ byte for byte and writes /social/index.json:
// every carousel whose article is live, newest first, with absolute URLs, so a posting
// routine or the Instagram API can fetch them. Never in the sitemap, hubs or llms.txt,
// and robots.txt does not block it. A broken carousel is a warning, never a build error.
import fs from 'node:fs';
import path from 'node:path';

export const SOCIAL_DIR = 'social';
export const SOCIAL_INDEX = `${SOCIAL_DIR}/index.json`;
const FOLDER_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const IMAGE_RE = /^\d{2}\.jpg$/;

/** Every file under content/social/ as a Map of 'social/<rel>' to its bytes. */
function readTree(dir) {
  const files = new Map();
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d).sort()) {
      if (name.startsWith('.')) continue;
      const full = path.join(d, name);
      const stat = fs.lstatSync(full);
      const r = rel ? `${rel}/${name}` : name;
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full, r);
      else if (stat.isFile()) files.set(`${SOCIAL_DIR}/${r}`, fs.readFileSync(full));
    }
  };
  walk(dir, '');
  return files;
}

/**
 * Loads content/social/. `live` is the universe of live articles. Returns
 * { files, index, items, errors, warnings }; files and index are null-free only when the
 * folder exists, so a site without carousels builds exactly as before.
 */
export function loadSocial(root, { config, live }) {
  const dir = path.join(root, 'content', SOCIAL_DIR);
  const out = { files: new Map(), index: null, items: [], errors: [], warnings: [] };
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return out;
  out.files = readTree(dir);
  if (out.files.has(SOCIAL_INDEX)) {
    out.errors.push(`content/${SOCIAL_INDEX} would overwrite the generated index; delete it`);
    out.files.delete(SOCIAL_INDEX);
  }
  const skip = (name, why) => out.warnings.push(`content/${SOCIAL_DIR}/${name}: ${why}; not listed in /${SOCIAL_INDEX}`);

  for (const name of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, name);
    if (name.startsWith('.') || !fs.statSync(folder).isDirectory()) continue;
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
  out.index = `${JSON.stringify({ carousels: out.items }, null, 2)}\n`;
  return out;
}
