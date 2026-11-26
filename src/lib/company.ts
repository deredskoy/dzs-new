import { richHtml, imageUrl, imageSize, url, type ImageShape, type SourcePage } from './site';
import { translate, type Locale } from './i18n';

/** Plain text of an HTML fragment, ready to be inserted as text. */
export function plainText(html: string) {
  return html.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\u00a0/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
// The source pages wrap their text in layout blocks; the new templates only keep the content.
const unwrap = (html: string) => html.replace(/<\/?(?:div|section)\b[^>]*>/g, '');
const withoutEmptyParagraphs = (html: string) => html.replace(/<p>(?:\s|&nbsp;|<\/?strong>|<br\s*\/?>)*<\/p>/g, '');

export interface Photo { src: string; width: number; height: number; shape: ImageShape }
export function photo(source: string): Photo {
  return { src: imageUrl(source), ...imageSize(source) };
}
// Client photo, November 2026: the current photo of the 1553 lathe.
const machinePhotos: Record<string, string[]> = {
  'https://dzs.in.ua/uploads/files/tokarno_karyselniy_stanok.jpg': ['/media/lathe-1553-2026.jpg'],
};

export interface Machine { id: string; title: string; photos: Photo[]; html: string }
/** Splits the machine-shop page into its equipment entries: each has a heading, its photos and a description. */
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
    machines.push({ id: 'machine-' + (machines.length + 1), title: plainText(heading[1]), photos: (machinePhotos[image[1]] || [image[1]]).map(photo), html: richHtml({ ...page, html: body }, locale) });
  });
  return { intro, machines, outro: richHtml({ ...page, html: withoutEmptyParagraphs(outro) }, locale) };
}

export interface CompanyDocument { title: string; cover: Photo; pages: Photo[] }
// Client documents, November 2026: the current register extracts and the director's order. The site publishes
// only reduced page images with a burned-in watermark, never the original scans.
// They replace items 1–4 of the source list (two pages of the old register extract, the VAT extract and the order).
const currentDocuments = [
  { title: 'Виписка з Єдиного державного реєстру юридичних осіб, фізичних осіб — підприємців та громадських формувань', file: 'vypyska-yedr-2026', pages: 3, height: 1754, coverHeight: 679 },
  { title: 'Витяг з реєстру платників податку на додану вартість', file: 'vytiah-platnyka-pdv', pages: 1, height: 1754, coverHeight: 679 },
  { title: 'Наказ про призначення директора', file: 'nakaz-pryznachennia-dyrektora', pages: 1, height: 1766, coverHeight: 684 },
];
const documentImage = (src: string, width: number, height: number): Photo => ({ src: url(src), width, height, shape: 'portrait' });
const replacedItems = 4;
// Scans of the remaining items in list order; the source page showed them in a different order.
const documentScans = [
  'https://dzs.in.ua/uploads/portfolio/dozvil-ooo-dzs1.jpg', // № 1118.14.12
  'https://dzs.in.ua/uploads/portfolio/dozvil-ooo-dzs-021.jpg', // № 1256.13.12
  'https://dzs.in.ua/uploads/portfolio/dozvil-ooo-dzs-011.jpg', // № 1257.13.12
  'https://dzs.in.ua/uploads/portfolio/sertifikat-perevirky-tipu-ooo-dzs11.jpg',
  'https://dzs.in.ua/uploads/portfolio/dodatok-ooo-dzs1.jpg',
  'https://dzs.in.ua/uploads/portfolio/dodatok-ooo-dzs-011.jpg',
];
/** The documents page: an introduction and each document with its cover and pages. */
export function documents(page: SourcePage, locale: Locale) {
  const titles = [...page.html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => plainText(match[1]).replace(/\.$/, ''));
  if (titles.length !== replacedItems + documentScans.length) throw new Error('The document list no longer matches its scans');
  const items: CompanyDocument[] = [
    ...currentDocuments.map(item => ({
      title: translate(item.title, locale),
      cover: documentImage(`/documents/${item.file}-cover.jpg`, 480, item.coverHeight),
      pages: Array.from({ length: item.pages }, (_, index) => documentImage(`/documents/${item.file}-p${index + 1}.jpg`, 1240, item.height)),
    })),
    ...titles.slice(replacedItems).map((title, index) => { const scan = photo(documentScans[index]); return { title, cover: scan, pages: [scan] }; }),
  ];
  return { intro: plainText(page.html.match(/<p>([\s\S]*?)<\/p>/)?.[1] || ''), items };
}
