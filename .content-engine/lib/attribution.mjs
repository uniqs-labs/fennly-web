// Store links with campaign attribution, no cookies and no storage.
//
// App Store links carry pt (provider token), ct (campaign) and mt=8. Play links carry
// a referrer with utm_source, utm_medium and utm_campaign. The campaign is
//  - gads_<lang> when the visit came from a Google ad (gclid, gbraid or wbraid in the URL),
//  - <src>_guides when the URL has ?src= with a known social channel (ig, tt, fb, yt), the
//    tag of the bio short links like /ig (Play: utm_source=<src>, utm_medium=social,
//    utm_campaign=guides),
//  - otherwise blog_<slug>, cut to 40 characters (App Store Connect's limit for ct).
//
// Links are rendered with the blog_<slug> tag already in their href, so they work
// without JavaScript. A small inline script swaps in the ad or channel tag and carries
// ?src= along on links to other guide pages, so a visitor from a bio link who reads on
// still counts for that channel. Nothing is stored. The browser code is generated from
// the same values and is tested against these functions.
import { CAMPAIGN_MAX } from './config.mjs';

const PAID_RE = /[?&](gclid|gbraid|wbraid)=/i;
/** Social channels a ?src= may name (short links in social.shortLinks). */
export const SOURCES = ['ig', 'tt', 'fb', 'yt'];
const SOURCE_RE = new RegExp(`[?&]src=(${SOURCES.join('|')})(?:&|$)`, 'i');

export function isPaidVisit(search) {
  return PAID_RE.test(String(search || ''));
}

/** The social channel of a visit (?src=ig), or null; an ad click wins over it. */
export function socialSource(search) {
  if (isPaidVisit(search)) return null;
  const m = SOURCE_RE.exec(String(search || ''));
  return m ? m[1].toLowerCase() : null;
}

export function blogCampaign(slug) {
  return `blog_${slug}`.slice(0, CAMPAIGN_MAX);
}

/** Campaign for a visit: gads_<lang> for ad clicks, <src>_guides for a social channel, else blog_<slug>. */
export function campaignFor(search, lang, slug) {
  if (isPaidVisit(search)) return `gads_${lang}`.slice(0, CAMPAIGN_MAX);
  const src = socialSource(search);
  return src ? `${src}_guides` : blogCampaign(slug);
}

/** tagStoreUrl options for a visit (what the inline script does in the browser). */
export function visitTagOptions(config, search, lang, slug) {
  const src = socialSource(search);
  const base = { applePt: config.store.applePt, campaign: campaignFor(search, lang, slug) };
  if (isPaidVisit(search)) return { ...base, paid: true };
  if (src) return { ...base, paid: false, source: src, medium: 'social', playCampaign: 'guides' };
  return { ...base, paid: false, source: hostOf(config.origin) };
}

/** Untagged store URLs for one language. Apple uses the storefront path, Play the hl parameter. */
export function storeBases(store, lang) {
  const out = {};
  if (store.appleId) {
    const country = lang === 'en' ? '' : `${lang}/`;
    out.ios = `https://apps.apple.com/${country}app/id${store.appleId}`;
  }
  if (store.playPackage) {
    out.android = `https://play.google.com/store/apps/details?id=${store.playPackage}${lang === 'en' ? '' : `&hl=${lang}`}`;
  }
  return out;
}

/**
 * Adds the campaign to an untagged store URL. Play gets utm_campaign=playCampaign when set
 * (the channel tags use "guides"), else the App Store campaign.
 */
export function tagStoreUrl(base, { campaign, paid, applePt, source, medium = 'web', playCampaign }) {
  const u = new URL(base);
  if (/(^|\.)apps\.apple\.com$/.test(u.hostname)) {
    if (applePt) u.searchParams.set('pt', applePt);
    u.searchParams.set('ct', campaign);
    u.searchParams.set('mt', '8');
  } else if (/(^|\.)play\.google\.com$/.test(u.hostname)) {
    u.searchParams.set('referrer',
      `utm_source=${paid ? 'google' : source}&utm_medium=${paid ? 'cpc' : medium}&utm_campaign=${paid ? campaign : playCampaign || campaign}`);
  }
  return u.toString();
}

/** Tagged links for a page that is not an ad landing (the server-side default). */
export function storeLinks(config, lang, slug) {
  const bases = storeBases(config.store, lang);
  const opts = { campaign: blogCampaign(slug), paid: false, applePt: config.store.applePt, source: hostOf(config.origin) };
  return Object.fromEntries(Object.entries(bases).map(([k, base]) => [k, { base, href: tagStoreUrl(base, opts) }]));
}

export function hostOf(origin) {
  return new URL(origin).hostname;
}

/** Path prefixes of the generated sections (/en/guides/, /de/ratgeber/, ...). */
export function sectionPrefixes(config) {
  const out = new Set();
  for (const patterns of Object.values(config.urlPatterns || {})) {
    for (const p of Object.values(patterns)) out.add(p.split('{slug}')[0]);
  }
  return [...out].sort();
}

/**
 * The inline script for every generated page: retags store links on ad clicks (gads_<lang>)
 * and for a known ?src= channel (<src>_guides), carries ?src= along on links into the
 * guide sections, and puts the button for the visitor's platform first. Without gclid
 * and src it changes no link. ES5, no globals, no storage, fails silently.
 */
export function browserScript(config, lang) {
  const pt = JSON.stringify(String(config.store.applePt || ''));
  const campaign = JSON.stringify(`gads_${lang}`.slice(0, CAMPAIGN_MAX));
  const sections = JSON.stringify(sectionPrefixes(config));
  return [
    '(function(){try{',
    "var q=location.search,paid=/[?&](gclid|gbraid|wbraid)=/i.test(q),",
    `m=/[?&]src=(${SOURCES.join('|')})(?:&|$)/i.exec(q),src=!paid&&m?m[1].toLowerCase():'';`,
    'if(paid||src){',
    `var c=paid?${campaign}:src+'_guides',pt=${pt},a=document.querySelectorAll('a.store[data-base]');`,
    'for(var i=0;i<a.length;i++){var u=new URL(a[i].getAttribute(\'data-base\'));',
    "if(/(^|\\.)apps\\.apple\\.com$/.test(u.hostname)){if(pt)u.searchParams.set('pt',pt);u.searchParams.set('ct',c);u.searchParams.set('mt','8');}",
    "else if(/(^|\\.)play\\.google\\.com$/.test(u.hostname)){u.searchParams.set('referrer',paid?'utm_source=google&utm_medium=cpc&utm_campaign='+c:'utm_source='+src+'&utm_medium=social&utm_campaign=guides');}",
    "a[i].setAttribute('href',u.toString());}}",
    `if(src){var s=${sections},l=document.querySelectorAll('a[href^="/"]');`,
    'for(var k=0;k<l.length;k++){var h=l[k].getAttribute(\'href\');',
    "for(var n=0;n<s.length;n++){if(h.indexOf(s[n])===0){var v=new URL(h,location.href);v.searchParams.set('src',src);l[k].setAttribute('href',v.pathname+v.search+v.hash);break;}}}}",
    "var ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/.test(ua)||(/Mac/.test(ua)&&navigator.maxTouchPoints>1);",
    "if(ios||/Android/.test(ua)){var r=document.querySelectorAll('.stores');for(var j=0;j<r.length;j++){",
    "var w=r[j].querySelector(ios?'[data-ios]':'[data-android]');if(w)r[j].insertBefore(w,r[j].firstChild);}}",
    '}catch(e){}})();',
  ].join('');
}
