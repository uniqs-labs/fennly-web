// HTML helpers shared by all templates.

/** Escapes text for HTML element content and double- or single-quoted attributes. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON for a <script type="application/ld+json"> block; "<" can never close the tag. */
export function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Strips tags and decodes the few entities marked produces; collapses whitespace. */
export function plainText(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Native language names for the language switch. */
export const LANGUAGE_NAMES = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  nl: 'Nederlands',
  pt: 'Português',
  pl: 'Polski',
  lb: 'Lëtzebuergesch',
};
