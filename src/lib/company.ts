import { richHtml, imageUrl, imageSize, type ImageShape, type SourcePage } from './site';
import type { Locale } from './i18n';

/** Plain text of an HTML fragment, ready to be inserted as text. */
export function plainText(html: string) {
  return html.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;| /g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
// The source pages wrap their text in layout blocks; the new templates only keep the content.
const unwrap = (html: string) => html.replace(/<\/?(?:div|section)\b[^>]*>/g, '');
const withoutEmptyParagraphs = (html: string) => html.replace(/<p>(?:\s|&nbsp;|<\/?strong>|<br\s*\/?>)*<\/p>/g, '');

export interface Photo { src: string; width: number; height: number; shape: ImageShape }
// Client feedback, November 2026: the 1553 lathe has a newer photo on its service page.
const replacedPhotos: Record<string, string> = {
  'https://dzs.in.ua/uploads/files/tokarno_karyselniy_stanok.jpg': 'https://dzs.in.ua/uploads/product/42090152cbd4729a3715601eea19fed3.jpg',
};
export function photo(source: string): Photo {
  const original = replacedPhotos[source] || source;
  return { src: imageUrl(original), ...imageSize(original) };
}

export interface Machine { id: string; title: string; photo: Photo; html: string }
/** Splits the machine-shop page into its equipment entries: each has a heading, one photo and a description. */
export function machinePark(page: SourcePage, locale: Locale) {
  const chunks = unwrap(page.html).split(/<hr\s*\/?>/i);
  let intro = '';
  let outro = '';
  const machines: Machine[] = [];
  chunks.forEach((chunk, index) => {
    const image = chunk.match(/<img[^>]*\bsrc="([^"]+)"[^>]*>/);
    if (!image) {
      if (index === chunks.length - 1) outro = chunk;
      return;
    }
    const heading = [...chunk.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
      .filter(match => match.index! < image.index! && plainText(match[1])).at(-1);
    if (!heading) throw new Error('Machine without a heading on ' + page.path);
    if (!machines.length) intro = plainText(chunk.slice(0, heading.index));
    const body = withoutEmptyParagraphs(chunk.slice(heading.index! + heading[0].length).replace(image[0], ''));
    machines.push({ id: 'machine-' + (machines.length + 1), title: plainText(heading[1]), photo: photo(image[1]), html: richHtml({ ...page, html: body }, locale) });
  });
  return { intro, machines, outro: richHtml({ ...page, html: withoutEmptyParagraphs(outro) }, locale) };
}

// Scans in the order of the document list; the source page showed them in a different order.
const documentScans = [
  'https://dzs.in.ua/uploads/portfolio/vypiska-iz-reestra-ooo-dzs1.jpg',
  'https://dzs.in.ua/uploads/portfolio/vypiska-iz-reestra-ooo-dzs-011.jpg',
  'https://dzs.in.ua/uploads/portfolio/spravka-platelshhika-nds-ooo-dzs_1681.jpg',
  'https://dzs.in.ua/uploads/portfolio/prikaz-o-naznachenii-direktora-ooo-dzs1.jpg',
  'https://dzs.in.ua/uploads/portfolio/dozvil-ooo-dzs1.jpg', // № 1118.14.12
  'https://dzs.in.ua/uploads/portfolio/dozvil-ooo-dzs-021.jpg', // № 1256.13.12
  'https://dzs.in.ua/uploads/portfolio/dozvil-ooo-dzs-011.jpg', // № 1257.13.12
  'https://dzs.in.ua/uploads/portfolio/sertifikat-perevirky-tipu-ooo-dzs11.jpg',
  'https://dzs.in.ua/uploads/portfolio/dodatok-ooo-dzs1.jpg',
  'https://dzs.in.ua/uploads/portfolio/dodatok-ooo-dzs-011.jpg',
];
/** The documents page: an introduction and each listed document with its scan. */
export function documents(page: SourcePage) {
  const titles = [...page.html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => plainText(match[1]).replace(/\.$/, ''));
  if (titles.length !== documentScans.length) throw new Error('The document list no longer matches its scans');
  return {
    intro: plainText(page.html.match(/<p>([\s\S]*?)<\/p>/)?.[1] || ''),
    items: titles.map((title, index) => ({ title, photo: photo(documentScans[index]) })),
  };
}
