// One small stylesheet, inlined into every generated page: no extra request, no web
// fonts, no external resources. Colours and font stack come from content.config.json.

export function stylesheet(brand) {
  const c = brand.colors;
  return `
:root{--p:${c.primary};--pd:${c.primaryDark};--bg:${c.background};--card:${c.surface};--ink:${c.text};--muted:${c.muted};--line:${c.line};--soft:${c.soft};--r:18px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.7 ${brand.fontStack};-webkit-font-smoothing:antialiased;overflow-wrap:break-word}
img{max-width:100%;height:auto}
a{color:var(--pd);text-underline-offset:2px}
a:hover{color:var(--ink)}
:focus-visible{outline:3px solid var(--p);outline-offset:2px;border-radius:4px}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.narrow{max-width:760px}
.skip{position:absolute;left:12px;top:-60px;background:var(--ink);color:#fff;padding:10px 16px;border-radius:10px;z-index:30;text-decoration:none}
.skip:focus{top:12px;color:#fff}
.site{border-bottom:1px solid var(--line);background:var(--bg)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;flex-wrap:wrap}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:21px;color:var(--p);letter-spacing:-.3px;text-decoration:none;min-height:44px}
.brand img{width:32px;height:32px;border-radius:8px}
.nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:15px}
.nav a{display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border-radius:999px;color:var(--ink);text-decoration:none;font-weight:600}
.nav a:hover{background:var(--soft)}
.nav .lang{border:1px solid var(--line);background:var(--card)}
.crumbs{margin:22px 0 8px;font-size:14.5px;color:var(--muted)}
.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-items:center}
.crumbs li{display:flex;align-items:center}
.crumbs li+li::before{content:"/";margin:0 8px;color:var(--muted)}
.crumbs a{display:inline-flex;align-items:center;min-height:32px;color:var(--muted)}
.crumbs [aria-current]{color:var(--ink)}
.kicker{margin:18px 0 6px;font-size:14px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--pd)}
h1{font-size:clamp(30px,6vw,44px);line-height:1.12;letter-spacing:-1px;font-weight:800;margin:0 0 14px}
h2{font-size:clamp(23px,4vw,29px);line-height:1.25;letter-spacing:-.5px;font-weight:800;margin:44px 0 12px;scroll-margin-top:16px}
h3{font-size:19px;line-height:1.35;margin:28px 0 8px}
p,ul,ol{margin:0 0 18px}
li{margin:0 0 6px}
.byline{color:var(--muted);font-size:15px;margin:0 0 24px}
.label{margin:0 0 6px;font-size:13.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--pd)}
.summary{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--p);border-radius:var(--r);padding:20px 22px;margin:0 0 26px;font-size:18px}
.summary p:last-child{margin:0}
.toc{background:var(--soft);border-radius:var(--r);padding:18px 22px;margin:0 0 10px}
.toc ol{margin:0;padding-left:22px}
.toc li{margin:0}
.toc a{display:inline-block;padding:4px 0;min-height:24px;color:var(--ink)}
.prose table{border-collapse:collapse;width:100%;font-size:15.5px;background:var(--card)}
.prose th,.prose td{border:1px solid var(--line);padding:9px 11px;text-align:left;vertical-align:top;min-width:6.5em}
.prose th{background:var(--soft)}
.table-wrap{overflow-x:auto;margin:0 0 20px;border-radius:12px}
.prose img{display:block;margin:8px auto 20px;border-radius:14px;border:1px solid var(--line)}
.prose img.portrait{max-width:320px}
.prose blockquote{margin:0 0 18px;padding:4px 18px;border-left:4px solid var(--line);color:var(--muted)}
.cite{font-size:.72em;line-height:0}
.cite a{padding:0 1px}
.box{border-radius:var(--r);padding:22px 24px;margin:34px 0}
.box-title{font-weight:800;font-size:19px;margin:0 0 8px}
.disclaimer{background:var(--card);border:2px solid var(--line)}
.disclaimer ul{margin-bottom:12px}
.disclaimer p:last-child{margin:0}
.cta{background:var(--soft)}
.cta p{margin:0 0 14px}
.stores{display:flex;flex-wrap:wrap;gap:12px}
.store{display:inline-flex;align-items:center;gap:11px;background:var(--ink);color:#fff;text-decoration:none;border-radius:14px;padding:10px 20px 10px 16px;min-height:52px}
.store:hover{color:#fff;opacity:.92}
.store svg{width:24px;height:24px;flex:none;fill:currentColor}
.store span{display:block;line-height:1.15}
.store .s{font-size:11px;letter-spacing:.4px;text-transform:uppercase}
.store .b{font-size:16px;font-weight:700}
.band{background:var(--pd);color:#fff;border-radius:26px;padding:40px 28px;text-align:center;margin:48px 0}
.band .box-title{font-size:clamp(22px,4vw,28px);color:#fff}
.band p{max-width:44ch;margin:0 auto 22px;color:#fff}
.band .stores{justify-content:center;margin-bottom:14px}
.band .store{background:#fff;color:var(--ink)}
.band .store:hover{color:var(--ink)}
.band .trust{font-size:14.5px;margin:0 auto}
.faq h3{margin-top:22px}
.sources ol{padding-left:24px;font-size:15.5px}
.sources li{margin-bottom:8px}
.sources .host{color:var(--muted)}
.note{color:var(--muted);font-size:15px;border-top:1px solid var(--line);padding-top:18px;margin-top:30px}
.cards{list-style:none;padding:0;margin:0;display:grid;gap:14px}
.cards li{margin:0}
.cards a{display:block;height:100%;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;text-decoration:none;color:var(--ink)}
.cards a:hover{border-color:var(--p)}
.cards .t{display:block;font-weight:800;font-size:18.5px;line-height:1.3;margin-bottom:6px;color:var(--pd)}
.cards .d{display:block;color:var(--muted);font-size:15.5px;line-height:1.55}
.cards .m{display:block;color:var(--muted);font-size:13.5px;margin-top:8px}
.hub-head{padding:6px 0 18px}
.lede{font-size:19px;color:var(--muted);max-width:40em}
.empty{background:var(--card);border:1px dashed var(--line);border-radius:var(--r);padding:22px}
.preview{background:#7a3d00;color:#fff;text-align:center;padding:10px 16px;font-size:15px;font-weight:600}
.foot{border-top:1px solid var(--line);margin-top:56px;padding:28px 0 40px;font-size:14.5px;color:var(--muted)}
.foot ul{list-style:none;padding:0;margin:0 0 10px;display:flex;flex-wrap:wrap;gap:4px 18px}
.foot li{margin:0}
.foot a{display:inline-flex;align-items:center;min-height:32px;color:var(--muted)}
@media(max-width:599px){.crumbs li:last-child{display:none}}
@media(min-width:720px){.cards.grid{grid-template-columns:repeat(2,1fr)}.box{padding:26px 30px}.band{padding:48px 40px}}
`.replace(/\n/g, '');
}
