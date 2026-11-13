// Store links with campaign attribution, no cookies and no storage.
//
// App Store links carry pt (provider token), ct (campaign) and mt=8. Play links carry
// a referrer with utm_source, utm_medium and utm_campaign. The campaign is gads_<lang>
// when the visit came from a Google ad (gclid, gbraid or wbraid in the page URL),
// otherwise blog_<slug>, cut to 40 characters (App Store Connect's limit for ct).
//
// Links are rendered with the blog_<slug> tag already in their href, so they work
// without JavaScript. A small inline script swaps in gads_<lang> on ad clicks. The
// browser code is generated from the same values and is tested against these functions.
import { CAMPAIGN_MAX } from './config.mjs';

const PAID_RE = /[?&](gclid|gbraid|wbraid)=/i;

export function isPaidVisit(search) {
  return PAID_RE.test(String(search || ''));
}

export function blogCampaign(slug) {
  return `blog_${slug}`.slice(0, CAMPAIGN_MAX);
}

/** Campaign for a visit: gads_<lang> for ad clicks, else blog_<slug>. */
export function campaignFor(search, lang, slug) {
  return isPaidVisit(search) ? `gads_${lang}`.slice(0, CAMPAIGN_MAX) : blogCampaign(slug);
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

/** Adds the campaign to an untagged store URL. */
export function tagStoreUrl(base, { campaign, paid, applePt, source }) {
  const u = new URL(base);
  if (/(^|\.)apps\.apple\.com$/.test(u.hostname)) {
    if (applePt) u.searchParams.set('pt', applePt);
    u.searchParams.set('ct', campaign);
    u.searchParams.set('mt', '8');
  } else if (/(^|\.)play\.google\.com$/.test(u.hostname)) {
    u.searchParams.set('referrer',
      `utm_source=${paid ? 'google' : source}&utm_medium=${paid ? 'cpc' : 'web'}&utm_campaign=${campaign}`);
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

/**
 * The inline script for every generated page: retags store links on ad clicks and puts
 * the button for the visitor's platform first. ES5, no globals, fails silently.
 */
export function browserScript(config, lang) {
  const pt = JSON.stringify(String(config.store.applePt || ''));
  const campaign = JSON.stringify(`gads_${lang}`.slice(0, CAMPAIGN_MAX));
  return [
    '(function(){try{',
    `if(/[?&](gclid|gbraid|wbraid)=/i.test(location.search)){`,
    `var c=${campaign},pt=${pt},a=document.querySelectorAll('a.store[data-base]');`,
    'for(var i=0;i<a.length;i++){var u=new URL(a[i].getAttribute(\'data-base\'));',
    "if(/(^|\\.)apps\\.apple\\.com$/.test(u.hostname)){if(pt)u.searchParams.set('pt',pt);u.searchParams.set('ct',c);u.searchParams.set('mt','8');}",
    "else if(/(^|\\.)play\\.google\\.com$/.test(u.hostname)){u.searchParams.set('referrer','utm_source=google&utm_medium=cpc&utm_campaign='+c);}",
    "a[i].setAttribute('href',u.toString());}}",
    "var ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/.test(ua)||(/Mac/.test(ua)&&navigator.maxTouchPoints>1);",
    "if(ios||/Android/.test(ua)){var r=document.querySelectorAll('.stores');for(var j=0;j<r.length;j++){",
    "var w=r[j].querySelector(ios?'[data-ios]':'[data-android]');if(w)r[j].insertBefore(w,r[j].firstChild);}}",
    '}catch(e){}})();',
  ].join('');
}
