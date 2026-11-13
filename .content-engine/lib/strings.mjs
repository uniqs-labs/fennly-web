// Interface text of the templates (navigation, labels). App-specific copy such as
// calls to action, hub intros and disclaimers comes from content.config.json.
// Another language can be added per site with uiStrings.<lang> in content.config.json.
// Keys must exist in every language (tested).

export const STRINGS = {
  de: {
    locale: 'de-DE',
    ogLocale: 'de_DE',
    skip: 'Zum Inhalt springen',
    languageNav: 'Sprache',
    mainNav: 'Hauptnavigation',
    breadcrumb: 'Brotkrumennavigation',
    section: { guide: 'Ratgeber', compare: 'Vergleiche' },
    kind: { guide: 'Ratgeber', compare: 'Vergleich' },
    summary: 'Kurz gesagt',
    toc: 'Inhalt',
    table: 'Tabelle',
    faq: 'Häufige Fragen',
    sources: 'Quellen',
    related: 'Weiterlesen',
    by: 'Von',
    reviewedBy: 'Fachlich geprüft von',
    lastReviewed: 'Zuletzt geprüft am',
    published: 'Veröffentlicht am',
    cardReviewed: 'Geprüft am',
    readGuide: 'Zum Ratgeber',
    empty: 'Die ersten Artikel erscheinen in Kürze.',
    store: {
      ios: { small: 'Laden im', big: 'App Store' },
      android: { small: 'Jetzt bei', big: 'Google Play' },
    },
    preview: {
      banner: 'Entwurfsvorschau. Diese Seite ist nicht veröffentlicht und wird nicht indexiert.',
      title: 'Entwürfe',
      intro: 'Artikel mit draft: true. Sie erscheinen nur hier, nicht in Übersichten, Sitemap oder Suche.',
      none: 'Keine Entwürfe.',
    },
    footer: { guides: 'Ratgeber', contact: 'Kontakt' },
  },
  en: {
    locale: 'en-GB',
    ogLocale: 'en_GB',
    skip: 'Skip to content',
    languageNav: 'Language',
    mainNav: 'Main navigation',
    breadcrumb: 'Breadcrumb',
    section: { guide: 'Guides', compare: 'Comparisons' },
    kind: { guide: 'Guide', compare: 'Comparison' },
    summary: 'In short',
    toc: 'Contents',
    table: 'Table',
    faq: 'Frequently asked questions',
    sources: 'Sources',
    related: 'Keep reading',
    by: 'By',
    reviewedBy: 'Expert review by',
    lastReviewed: 'Last reviewed',
    published: 'Published',
    cardReviewed: 'Reviewed',
    readGuide: 'Read the guide',
    empty: 'The first articles are coming soon.',
    store: {
      ios: { small: 'Download on the', big: 'App Store' },
      android: { small: 'Get it on', big: 'Google Play' },
    },
    preview: {
      banner: 'Draft preview. This page is not published and is not indexed.',
      title: 'Drafts',
      intro: 'Articles with draft: true. They only appear here, never in hubs, the sitemap or search.',
      none: 'No drafts.',
    },
    footer: { guides: 'Guides', contact: 'Contact' },
  },
};

export function formatDate(iso, strings) {
  return new Intl.DateTimeFormat(strings.locale, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
