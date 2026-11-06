import source from '../data/site-content.json';
import assets from '../data/asset-map.json';
import details from '../data/product-details.json';
import { normalizeText, translate, translateHtml, type Locale } from './i18n';

export interface Card { title: string; href: string; image: string; description: string }
export interface SourcePage {
  path: string; status: number; title: string; html: string; text: string;
  cards: Card[]; images: { src: string; alt: string }[]; links: string[];
}
interface Asset { path?: string; width?: number; height?: number; bytes?: number; error?: string }
const assetMap = assets as Record<string, Asset>;
export const sourcePages = source.pages as SourcePage[];
export const paths = {
  belaz: '/product/info/proizvodstvo-tormoznoj-diskovoj-nakladki-dlya-samosvala-belaz-130t',
  hitachi: '/product/info/proizvodstvo-tormoznoj-diskovoj-kolodki-4674697-hitachi-eh-3500',
  friction: '/product/info/izgotovim-special-nye-frikcionnye-izdeliya-na-zakaz',
};
export const aliases: Record<string, string> = {
  '/catalog/category/izgotovlenie-valov-val-shesteren-shesteren-promyshlennogo-primeneniya': '/catalog/category/izgotovlenie/izgotovlenie-valov-val-shesteren-shesteren-promyshlennogo-primeneniya',
  '/catalog/category/remont-planetarnyh-reduktorov-hoda-povorota-ekskavatorov': '/catalog/category/remont/remont-planetarnyh-reduktorov-hoda-povorota-ekskavatorov',
  '/catalog/category/izgotovlenie-reduktorov-special-nyh-i-obshepromyshlennogo-naznacheniya': '/catalog/category/izgotovlenie/izgotovlenie-reduktorov-special-nyh-i-obshepromyshlennogo-naznacheniya',
};
export function contentPath(pathname: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let path = pathname === base || pathname.startsWith(base + '/') ? pathname.slice(base.length) : pathname;
  path = path.replace(/^\/en(?=\/|$)/, '') || '/';
  if (path === '/404.html') return '/404';
  return path === '/' ? path : path.replace(/\/$/, '');
}
export function url(path = '/', locale: Locale = 'uk') {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const [pathname, hash] = path.split('#');
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (pathname === '/404') return base + (locale === 'en' ? '/en/404/' : '/404.html');
  const asset = /\.[a-z0-9]+$/i.test(pathname);
  const prefix = locale === 'en' && !asset ? '/en' : '';
  const tail = pathname === '/' ? '/' : pathname.replace(/\/$/, '') + (/\.[a-z0-9]+$/i.test(pathname) ? '' : '/');
  return base + prefix + tail + (hash ? '#' + hash : '');
}
export function imageUrl(src: string) {
  const local = assetMap[src]?.path;
  if (local) return url(local);
  if (src.startsWith('/media/')) return url(src);
  return src;
}
export type ImageShape = 'portrait' | 'landscape';
// Photos narrower than 0.9:1 are treated as vertical; square and wider ones share the horizontal layout.
export function imageSize(src: string, fallback = { width: 1000, height: 750 }) {
  const asset = assetMap[src];
  const width = asset?.width || fallback.width;
  const height = asset?.height || fallback.height;
  const shape: ImageShape = width / height < .9 ? 'portrait' : 'landscape';
  return { width, height, shape };
}
export function localizePage(page: SourcePage, locale: Locale): SourcePage {
  if (locale === 'uk') return page;
  const html = translateHtml(page.html, locale);
  const cards = page.cards.map(card => ({ ...card, title: translate(card.title, locale), description: translate(card.description, locale) }));
  return {
    ...page,
    title: translate(page.title, locale),
    html,
    text: normalizeText(html.replace(/<[^>]+>/g, ' ')) || cards.map(card => card.description).join(' '),
    cards,
    images: page.images.map(image => ({ ...image, alt: translate(image.alt, locale) })),
  };
}
export function pageFor(path: string, locale: Locale = 'uk') {
  const page = sourcePages.find(p => p.path === (aliases[path] || path));
  return page ? localizePage(page, locale) : undefined;
}
// The old wordmark is a Russian-language raster logo; the header already carries the current one.
const retiredImages = ['https://dzs.in.ua/uploads/files/long_logo1.png'];
export function pageImages(page: SourcePage) {
  return page.images.filter((image, i, all) => !image.src.includes('/partners/') && !retiredImages.includes(image.src) && !assetMap[image.src]?.error && all.findIndex(other => other.src === image.src) === i);
}
export const categories = [
  { title: 'Виготовлення', href: '/catalog/category/izgotovlenie', detail: 'Від креслення до готового виробу' },
  { title: 'Ремонт', href: '/catalog/category/remont', detail: 'Відновлюємо ресурс обладнання' },
  { title: 'Механічна обробка', href: '/catalog/category/uslugi', detail: 'Токарні, розточувальні та пресові роботи' },
  { title: 'Продаж обладнання', href: '/catalog/category/prodam-kuplyu', detail: 'Редуктори, механізми та агрегати' },
];
export const companyLinks = [
  { title: 'Про підприємство', href: '/states/o-predpriyatii' },
  { title: 'Верстатний парк', href: '/states/nash-stanochnyy-park' },
  { title: 'Документи', href: '/states/dokumenty' },
  { title: 'Команда та вакансії', href: '/states/kollektiv-i-vakansii' },
];
export function titleFor(page: SourcePage, locale: Locale = 'uk') {
  const special: Record<string, string> = { '/portfolio': 'Галерея робіт', '/contacts': 'Контакти', '/about-company': 'Підприємство', '/catalog': 'Продукція та послуги', [paths.belaz]: 'Гальмівна накладка для БеЛАЗ', [paths.hitachi]: 'Гальмівна колодка HITACHI EH 3500', [paths.friction]: 'Фрикційні вироби на замовлення' };
  if (special[page.path]) return translate(special[page.path], locale);
  if (page.path.split('/').length > 4 && page.path.startsWith('/catalog/') && page.cards.length === 1) return page.cards[0].title;
  return page.title;
}
// The old site typed lists as paragraphs or <br> lines starting with a dash; turn them into real lists.
const dashLine = /^\s*(?:<[^>]+>\s*)*[-–—]\s+/;
function dashLists(html: string) {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (paragraph, inner: string) => {
    const lines = inner.split(/<br\s*\/?>/i);
    if (!lines.some(line => dashLine.test(line))) return paragraph;
    let result = '';
    let text: string[] = [];
    let items: string[] = [];
    const flushText = () => { const value = text.join('<br>').trim(); if (value) result += '<p>' + value + '</p>'; text = []; };
    const flushItems = () => { if (items.length) result += '<ul>' + items.map(item => '<li>' + item + '</li>').join('') + '</ul>'; items = []; };
    for (const line of lines) {
      if (dashLine.test(line)) { flushText(); items.push(line.replace(/^(\s*(?:<[^>]+>\s*)*)[-–—]\s+/, '$1').replace(/[;,]\s*$/, '').trim().replace(/^([^.]*)\.$/, '$1')); }
      else { flushItems(); text.push(line); }
    }
    flushItems(); flushText();
    return result;
  }).replace(/<\/ul>\s*<ul>/g, '');
}
/** Where the first list of a page is replaced by a structured graphic. */
export const graphicMarker = '<!--graphic-->';
export interface RichOptions { worksheet?: boolean; replaceList?: boolean }
export function richHtml(page: SourcePage, locale: Locale = 'uk', options: RichOptions = {}) {
  let html = dashLists(page.html.replace(/(?:&nbsp;|\u00a0)+/g, ' ').replace(/ {2,}/g, ' '));
  // A repair page's list is the sequence of work done; it reads as a numbered job sheet.
  if (options.worksheet) html = html.replace('<ul>', '<ol class="worksheet">').replace(/<\/ul>/, '</ol>');
  // The page is split around the graphic, so plain wrappers must not stay open across the split.
  if (options.replaceList) html = html.replace(/<\/?(?:div|section)>/g, '').replace(/<ul>[\s\S]*?<\/ul>/, graphicMarker);
  return html
    .replace(/<p>\s*<img [^>]*src="([^"]+)"[^>]*>\s*<\/p>/g, (match, src) => retiredImages.includes(src) ? '' : match)
    .replace(/<p>(?:\s*<br\s*\/?>)+/g, '<p>').replace(/(?:<br\s*\/?>\s*)+<\/p>/g, '</p>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\b(src|href)="([^"]+)"/g, (_match, attr, original) => {
      let value = original;
      if (assetMap[value]?.path) value = imageUrl(value);
      else if (value.startsWith('https://dzs.in.ua')) {
        const target = new URL(value);
        if (pageFor(target.pathname) || target.pathname === '/') value = url(target.pathname + target.hash, locale);
      }
      return attr + '="' + value + '"';
    })
    .replace(/<img /g, '<img loading="lazy" decoding="async" ')
    .replace(/<h1\b/g, '<h2').replace(/<\/h1>/g, '</h2>');
}

export interface ProductDetail { kind: 'part' | 'make' | 'repair' | 'machining' | 'sale'; lead: string; facts: [string, string][]; graphic?: 'timeline' | 'models' | 'lathe-1553' | 'lathe-dip400' | 'press'; worksheet?: boolean }
const productData = details as unknown as { products: Record<string, ProductDetail>; timeline: { year: number; title: string; code: string; href: string }[]; models: { brand: string; type: string; models: string[] }[]; briefs: Record<ProductDetail['kind'], string[]> };
export const partsTimeline = productData.timeline;
export const excavatorModels = productData.models;
export function productDetail(path: string) {
  const detail = productData.products[path];
  return detail ? { ...detail, brief: productData.briefs[detail.kind] } : undefined;
}
/** Other work from the same catalogue section: the narrowest section first, then its parent. */
export function relatedCards(path: string, locale: Locale = 'uk', limit = 3) {
  const sections = sourcePages.filter(page => page.path.startsWith('/catalog/category/') && page.cards.some(card => card.href === path))
    .sort((a, b) => b.path.split('/').length - a.path.split('/').length);
  const cards: Card[] = [];
  for (const section of sections) {
    for (const card of localizePage(section, locale).cards) {
      if (card.href !== path && card.href.startsWith('/product/') && !cards.some(other => other.href === card.href)) cards.push(card);
    }
  }
  return cards.slice(0, limit);
}
