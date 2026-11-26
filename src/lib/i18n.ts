import content from '../data/content.en.json';
import ui from '../data/ui.en.json';

export const locales = ['uk', 'en'] as const;
export type Locale = typeof locales[number];
const english: Record<string, string> = { ...content, ...ui };

export function normalizeText(text: string): string {
  return text.replace(/&nbsp;|\u00a0/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export function translate(text: string, locale: Locale): string {
  if (locale === 'uk') return text;
  const normalized = normalizeText(text);
  const translated = english[normalized];
  if (translated !== undefined) return translated;
  if (/[А-Яа-яІіЇїЄєҐґЁё]/u.test(normalized)) {
    throw new Error('Missing English translation: ' + normalized);
  }
  return text;
}

export const translator = (locale: Locale) => (text: string) => translate(text, locale);

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The input is the already-sanitized, checked-in content snapshot.
// Translate text and image descriptions without changing links or markup.
export function translateHtml(html: string, locale: Locale): string {
  if (locale === 'uk') return html;
  return html.split(/(<[^>]+>)/g).map(part => {
    if (part.startsWith('<')) {
      return part.replace(/\balt="([^"]*)"/g, (_match, alt: string) =>
        'alt="' + escapeHtml(translate(alt, locale)) + '"');
    }
    if (!/[А-Яа-яІіЇїЄєҐґЁё]/u.test(part)) return part;
    const leading = /^\s/.test(part) ? ' ' : '';
    const trailing = /\s$/.test(part) ? ' ' : '';
    return leading + escapeHtml(translate(part, locale)) + trailing;
  }).join('');
}
