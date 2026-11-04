import source from '../data/site-content.json';
import assets from '../data/asset-map.json';

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
export function url(path = '/') {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const [pathname, hash] = path.split('#');
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const tail = pathname === '/' ? '/' : pathname.replace(/\/$/, '') + (/\.[a-z0-9]+$/i.test(pathname) ? '' : '/');
  return base + tail + (hash ? '#' + hash : '');
}
export function imageUrl(src: string) {
  const local = assetMap[src]?.path;
  if (local) return url(local);
  if (src.startsWith('/media/')) return url(src);
  return src;
}
export function pageFor(path: string) { return sourcePages.find(p => p.path === (aliases[path] || path)); }
export function pageImages(page: SourcePage) {
  return page.images.filter((image, i, all) => !image.src.includes('/partners/') && !assetMap[image.src]?.error && all.findIndex(other => other.src === image.src) === i);
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
export function titleFor(page: SourcePage) {
  const special: Record<string, string> = { '/portfolio': 'Галерея робіт', '/contacts': 'Контакти', '/about-company': 'Підприємство', '/catalog': 'Продукція та послуги', [paths.belaz]: 'Гальмівна накладка для БеЛАЗ', [paths.hitachi]: 'Гальмівна колодка HITACHI EH 3500', [paths.friction]: 'Фрикційні вироби на замовлення' };
  if (special[page.path]) return special[page.path];
  if (page.path.split('/').length > 4 && page.path.startsWith('/catalog/') && page.cards.length === 1) return page.cards[0].title;
  return page.title;
}
export function richHtml(page: SourcePage) {
  return page.html.replace(/(?:&nbsp;|\u00a0)+/g, ' ').replace(/ {2,}/g, ' ')
    .replace(/\b(src|href)="([^"]+)"/g, (_match, attr, original) => {
      let value = original;
      if (assetMap[value]?.path) value = imageUrl(value);
      else if (value.startsWith('https://dzs.in.ua')) {
        const target = new URL(value);
        if (pageFor(target.pathname) || target.pathname === '/') value = url(target.pathname + target.hash);
      }
      return attr + '="' + value + '"';
    })
    .replace(/<img /g, '<img loading="lazy" decoding="async" ')
    .replace(/<h1\b/g, '<h2').replace(/<\/h1>/g, '</h2>');
}
