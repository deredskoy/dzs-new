import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { emailDraft } from '../src/lib/contact';

const base = '/dzs-new/';
function htmlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? htmlFiles(path.join(dir, entry.name)) : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : []);
}
const output = htmlFiles('dist');

test('every built page and its local links and media resolve', async ({ request }) => {
  const targets = new Set<string>();
  for (const file of output) {
    const relative = file.replace(/^dist\//, '').replace(/index\.html$/, '');
    const response = await request.get(base + relative);
    expect(response.status(), relative).toBe(200);
    const html = await response.text();
    const language = relative.startsWith('en/') ? 'en' : 'uk';
    expect(html, relative).toContain('lang="' + language + '"');
    expect(html, relative).toContain('noindex, nofollow');
    expect(html, relative).toContain('hreflang="uk"');
    expect(html, relative).toContain('hreflang="en"');
    expect(html, relative).toContain('hreflang="x-default"');
    if (language === 'en') {
      expect(html, 'Untranslated text or labels in ' + relative).not.toMatch(/[А-Яа-яІіЇїЄєҐґЁё]/u);
    }
    expect((html.match(/<h1(?:\s|>)/g) || []).length, relative).toBe(1);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = match[1].split('#')[0].split('?')[0];
      if (target.startsWith(base)) targets.add(target);
      else expect(target.startsWith('/') && !target.startsWith('//'), 'Unprefixed URL in '+relative+': '+target).toBe(false);
    }
  }
  const results = await Promise.all([...targets].map(async target => ({ target, response: await request.get(target) })));
  for (const { target, response } of results) expect(response.ok(), target).toBeTruthy();
});

const screens = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 1000 },
];
const product = {
  hitachi: 'product/info/proizvodstvo-tormoznoj-diskovoj-kolodki-4674697-hitachi-eh-3500/',
  lathe: 'product/info/vypolnim-tokarnye-raboty-na-karusel-nom-stanke/',
  komatsu: 'product/info/remont-planetarnogo-reduktora-povorota-ekskavatora-komatsu-pc-3000/',
  planetary: 'product/info/izgotovlenie-planetarnyh-reduktorov-hoda-i-povorota/',
};
const company = ['about-company/', 'states/o-predpriyatii/', 'states/nash-stanochnyy-park/', 'states/dokumenty/', 'states/kollektiv-i-vakansii/'];
const routes = ['', 'catalog/', 'catalog/category/prodam-kuplyu/', 'product/info/proizvodstvo-tormoznoj-diskovoj-nakladki-dlya-samosvala-belaz-130t/', ...Object.values(product), ...company, 'portfolio/', 'contacts/'];

for (const viewport of screens) {
  test('layout and image loading at '+viewport.width+'px', async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const locale of ['uk', 'en']) {
      for (const route of routes) {
      await page.goto(base + (locale === 'en' ? 'en/' : '') + route);
      await page.evaluate(async () => {
        document.querySelectorAll<HTMLImageElement>('img').forEach(img => img.loading = 'eager');
        await document.fonts.ready;
        await Promise.all([...document.images].map(img => img.decode().catch(() => undefined)));
      });
      const state = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        brokenImages: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src),
      }));
      expect(state.scrollWidth, route).toBeLessThanOrEqual(state.width + 1);
      expect(state.brokenImages, route).toEqual([]);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.language-switch a:visible')).not.toHaveCount(0);
      for (const link of await page.locator('.language-switch a:visible').all()) {
        const box = await link.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      const phone = page.locator('.header-phone');
      await expect(phone, route).toBeVisible();
      await expect(phone).toHaveAttribute('href', 'tel:+380673775670');
      await expect(phone).toContainText('+38 (067) 377-56-70');
      const phoneBox = await phone.boundingBox();
      expect(phoneBox?.width).toBeGreaterThanOrEqual(44);
      expect(phoneBox?.height).toBeGreaterThanOrEqual(44);
      if (route === 'contacts/') await expect(page.locator('#contact a[href$="/contacts/"]')).toHaveCount(0);
      if ((viewport.width === 375 || viewport.width === 1440) && (route === '' || route.startsWith('product/'))) {
        await page.screenshot({ path: 'test-results/' + locale + '-' + (route ? 'product' : 'home') + '-' + viewport.width + '.png', fullPage: true });
        if (route === '') {
          await page.screenshot({ path: 'test-results/' + locale + '-hero-' + viewport.width + '.png' });
          await page.locator(viewport.width === 375 ? '.contact-form' : '.contact-grid').screenshot({ path: 'test-results/' + locale + '-form-' + viewport.width + '.png' });
        }
      }
      }
    }
    expect(errors).toEqual([]);
  });
}

test('mobile menu supports dismissal, focus and active sections', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base);
  const navigation = page.getByRole('navigation', { name: 'Мобільна навігація' });
  await expect(navigation).not.toBeVisible();
  await page.locator('.mobile-nav summary').click();
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Галерея' }).focus();
  await page.keyboard.press('Escape');
  await expect(navigation).not.toBeVisible();
  await expect(page.locator('.mobile-nav summary')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(navigation).toBeVisible();
  await page.locator('.language-switch a:visible').first().focus();
  await expect(navigation).not.toBeVisible();
  await page.locator('.mobile-nav summary').click();
  await page.locator('.hero-baseline > span').click();
  await expect(navigation).not.toBeVisible();
  await page.locator('.mobile-nav summary').click();
  await navigation.getByRole('link', { name: 'Галерея' }).click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Галерея робіт');
  await page.locator('.mobile-nav summary').click();
  await expect(navigation.getByRole('link', { name: 'Галерея' })).toHaveAttribute('aria-current', 'page');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('.mobile-nav')).toHaveJSProperty('open', false);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(navigation).not.toBeVisible();
});

test('contact form uses visible labels and native validation without sending', async ({ page }) => {
  await page.goto(base + 'contacts/');
  const form = page.locator('[data-contact-form]');
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(false);
  await page.getByLabel('Ваше ім’я').fill('Перевірка форми');
  await page.getByLabel('Що потрібно виготовити чи відновити?').fill('Перевірка полів без надсилання повідомлення.');
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(true);
  await page.getByLabel('Електронна пошта').fill('не адреса');
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(false);
  await page.getByLabel('Електронна пошта').fill('review@example.com');
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(true);
  const labels = JSON.parse((await form.getAttribute('data-email-labels'))!);
  const data = new FormData();
  data.set('name', 'Перевірка');
  data.set('email', '');
  data.set('message', 'Опис');
  expect(new URL(emailDraft(data, labels)).searchParams.get('body')).toContain('Email: —');
  await expect(form).toHaveAttribute('action', 'mailto:tovdzs@gmail.com');
  await expect(form.getByRole('button')).toHaveText(/Підготувати лист/);
  await expect(form.locator('.form-note')).toContainText('поштовій програмі');
});

test('product pages add facts, real lists and one graphic from the source data', async ({ page }) => {
  await page.goto(base + product.hitachi);
  await expect(page.locator('.product-facts')).toContainText('4674697');
  await expect(page.locator('.product-facts')).toContainText('ТУ У 29.3-32510553-001:2017');
  await expect(page.locator('.parts-timeline li')).toHaveCount(4);
  await expect(page.locator('.parts-timeline [aria-current="page"]')).toContainText('2016');
  await expect(page.locator('.contact-brief li')).toHaveCount(4);
  const related = page.locator('.related-section .card-link');
  await expect(related).toHaveCount(3);
  for (const link of await related.all()) expect(await link.getAttribute('href')).not.toContain('4674697-hitachi');

  await page.goto(base + product.lathe);
  await expect(page.locator('.machine-figure svg')).toBeVisible();
  await expect(page.locator('.rich-content li', { hasText: 'свердління' })).toHaveCount(1);
  const dashLines = await page.locator('.rich-content p').evaluateAll(items => items.filter(item => /^\s*[-–—]\s/.test(item.textContent || '')).length);
  expect(dashLines).toBe(0);

  await page.goto(base + product.komatsu);
  await expect(page.locator('.rich-content ol.worksheet li')).toHaveCount(6);
  await expect(page.locator('.product-facts')).toContainText('Полтавський ГЗК');

  await page.goto(base + product.planetary);
  await expect(page.locator('.model-group')).toHaveCount(4);
  await expect(page.locator('.model-groups')).toContainText('PC 8000-6');
  await expect(page.locator('.rich-content', { hasText: 'PC 8000-6' })).toHaveCount(0);
  expect(await page.locator('.model-groups').evaluate(element => element.closest('.rich-content') === null)).toBe(true);

  await page.goto(base + 'en/' + product.hitachi);
  await expect(page.locator('.product-facts')).toContainText('Part number');
  await expect(page.locator('.parts-timeline')).toContainText('This page');
});

test('skip link supports keyboard navigation', async ({ page }) => {
  await page.goto(base);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Перейти до вмісту' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('language switch preserves the page and section, including legacy aliases and errors', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const pairs = [
    ['', 'en/'],
    ['product/info/proizvodstvo-tormoznoj-diskovoj-nakladki-dlya-samosvala-belaz-130t/', 'en/product/info/proizvodstvo-tormoznoj-diskovoj-nakladki-dlya-samosvala-belaz-130t/'],
    ['portfolio/remont-planetarnogo-reduktora-hoda-ekg-10i/', 'en/portfolio/remont-planetarnogo-reduktora-hoda-ekg-10i/'],
    ['catalog/category/remont-planetarnyh-reduktorov-hoda-povorota-ekskavatorov/', 'en/catalog/category/remont-planetarnyh-reduktorov-hoda-povorota-ekskavatorov/'],
    ['404.html', 'en/404/'],
  ];
  for (const [uk, en] of pairs) {
    const hash = uk === '404.html' ? '' : '#contact';
    await page.goto(base + uk + hash);
    await page.locator('.language-switch a[hreflang="en"]').click();
    expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe(base + en + hash);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.language-switch a[hreflang="en"]')).toHaveAttribute('aria-current', 'true');
    await page.locator('.language-switch a[hreflang="uk"]').click();
    expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe(base + uk + hash);
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  }
});

test('English navigation, breadcrumbs and content links remain in English', async ({ page }) => {
  await page.goto(base + 'en/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Company', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/about-company\/$/);
  await page.locator('.letter').getByRole('link', { name: 'explore our machine shop' }).click();
  await expect(page).toHaveURL(/\/en\/states\/nash-stanochnyy-park\/$/);
  await expect(page.locator('h1')).toHaveText('Our machine shop');
  await expect(page.locator('.machine-park')).toContainText('3000 kg');
  await page.locator('.breadcrumbs').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Products & services' }).click();
  await page.locator('.content-card').filter({ hasText: '130-tonne BelAZ' }).getByRole('link').first().click();
  await expect(page.locator('h1')).toHaveText('Brake lining 75131-3577060-01 for 130-tonne BelAZ');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Products & services' })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('.rich-content')).toContainText('75131-3577060-01');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/dzs-new\/en\/product\//);
});

test('English contact form and prepared email use English labels', async ({ page }) => {
  await page.goto(base + 'en/contacts/');
  await page.getByLabel('Your name').fill('Jane + Alex');
  await page.getByLabel('Email', { exact: false }).first().fill('review@example.com');
  await page.getByLabel('What do you need manufactured or repaired?').fill('Parts & assemblies — 75131-3577060-01');
  const form = page.locator('[data-contact-form]');
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(true);
  await expect(form.getByRole('button')).toHaveText(/Prepare an email/);
  const labels = JSON.parse((await form.getAttribute('data-email-labels'))!);
  const data = new FormData();
  data.set('name', 'Jane + Alex');
  data.set('email', 'review@example.com');
  data.set('message', 'Parts & assemblies — 75131-3577060-01');
  const draft = emailDraft(data, labels);
  expect(draft).toContain('subject=Enquiry%20to%20DZS');
  expect(draft).toContain('Jane%20%2B%20Alex');
  const parsed = new URL(draft);
  expect(parsed.searchParams.get('body')).toContain('Name: Jane + Alex');
  expect(parsed.searchParams.get('body')).toContain('Parts & assemblies — 75131-3577060-01');
  expect(await form.getAttribute('data-email-status')).toContain('Send the prepared draft');
});

test('header shows the logo, the company name and the working hours', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await page.goto(base);
    await expect(page.locator('.brand img')).toHaveAttribute('src', /logo-dzs\.png$/);
    await expect(page.locator('.brand-name')).toBeVisible();
    await expect(page.locator('.brand-name')).toHaveText(/Дніпропетровський\s*завод спецремонта/);
    const name = await page.locator('.brand-name').boundingBox();
    const controls = await page.locator('.header-controls').boundingBox();
    expect(name!.x + name!.width, 'company name overlaps the controls at ' + viewport.width).toBeLessThan(controls!.x);
  }
  await expect(page.locator('.header-phone-hours')).toHaveText('Пн–Пт, 08:00–17:00');
  await expect(page.locator('.hours')).toContainText('Понеділок — п’ятниця');
  await expect(page.locator('.hours')).toContainText('08:00–17:00');
  await page.goto(base + 'en/');
  await expect(page.locator('.header-phone-hours')).toHaveText('Mon–Fri, 08:00–17:00');
  await expect(page.locator('.hours')).toContainText('Monday — Friday');
});

test('hero gears mesh on their pitch circles and the large gear is toned', async ({ page }) => {
  await page.goto(base);
  const gears = await page.locator('.gear-drawing .gd-pitch').evaluateAll(circles => circles.map(circle => {
    const match = circle.parentElement!.getAttribute('transform')!.match(/translate\(([\d.]+) ([\d.]+)\)/)!;
    return { x: Number(match[1]), y: Number(match[2]), r: Number(circle.getAttribute('r')) };
  }));
  expect(gears).toHaveLength(3);
  expect(gears[0].r).toBeGreaterThan(gears[1].r);
  expect(gears[0].r).toBeGreaterThan(gears[2].r);
  for (const [a, b] of [[gears[0], gears[1]], [gears[1], gears[2]]]) {
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(a.r + b.r, 1);
  }
  const fill = await page.locator('.gd-gear-1').evaluate(element => getComputedStyle(element).fill);
  expect(fill).not.toBe('none');
  await expect(page.locator('.gear-drawing text', { hasText: 'Ø280' })).toHaveCount(1);
  await expect(page.locator('.gear-drawing .gd-title')).toContainText('Передача зубчаста');
});

test('documents open as watermarked pages in a viewer, not as files', async ({ page, request }) => {
  await page.goto(base + 'states/dokumenty/');
  const card = page.locator('.document-card').first();
  await card.click();
  const viewer = page.getByRole('dialog', { name: /Виписка з Єдиного державного реєстру/ });
  await expect(viewer).toBeVisible();
  const pages = viewer.locator('.document-viewer-pages img');
  await expect(pages).toHaveCount(3);
  await expect(pages.nth(2)).toHaveAttribute('src', /vypyska-yedr-2026-p3\.jpg$/);
  await expect(pages.nth(0)).toHaveAttribute('alt', /сторінка 1$/);
  await pages.nth(0).evaluate((image: HTMLImageElement) => image.decode());
  expect(await pages.nth(0).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1240);
  expect(await pages.nth(0).evaluate(image => getComputedStyle(image).pointerEvents)).toBe('none');
  expect(await pages.nth(0).evaluate(image => image.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(viewer).not.toBeVisible();
  await expect(card).toBeFocused();
  await page.locator('.document-card').nth(2).click();
  await expect(page.locator('.document-viewer-pages img')).toHaveCount(1);
  await page.getByRole('button', { name: /Закрити/ }).click();
  await expect(page.locator('dialog')).not.toBeVisible();
  for (const file of ['vypyska-yedr-2026.pdf', 'vytiah-platnyka-pdv.pdf', 'nakaz-pryznachennia-dyrektora.pdf']) {
    expect((await request.get(base + 'documents/' + file)).status(), file).toBe(404);
  }
});

test('the press service shows the current photo of the press', async ({ page }) => {
  await page.goto(base + 'product/info/vypolnim-raspressovku-promyshlennym-pressom/');
  await expect(page.locator('.product-hero-image img')).toHaveAttribute('src', /press-250t-2026\.jpg$/);
  await page.goto(base + 'catalog/category/uslugi/');
  await expect(page.locator('.content-card img[src$="press-250t-2026.jpg"]')).toHaveCount(1);
});

test('the sales tab stays in the catalogue without offers', async ({ page, request }) => {
  await page.goto(base);
  await expect(page.locator('.capabilities a')).toHaveCount(3);
  await expect(page.locator('.capabilities a[href*="prodam-kuplyu"]')).toHaveCount(0);
  await page.goto(base + 'catalog/');
  await expect(page.locator('.section-nav a[href$="/catalog/category/prodam-kuplyu/"]')).toHaveText('Продаж редукторів і агрегатів');
  await expect(page.locator('.content-card a[href*="prodam-reduktor"]')).toHaveCount(0);
  await page.goto(base + 'catalog/category/prodam-kuplyu/');
  await expect(page.locator('.empty-catalog')).toHaveText('Зараз пропозицій немає.');
  await expect(page.locator('.content-card')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Продаємо та купуємо спеціальні редуктори');
  expect((await request.get(base + 'product/info/prodam-reduktor-c2sh-800-20-11/')).status()).toBe(404);
});

test('company pages use the full width and keep their content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + 'about-company/');
  await expect(page.locator('.letter-greeting')).toHaveText('Шановні партнери!');
  await expect(page.locator('.letter-body a')).toHaveCount(4);
  const letter = (await page.locator('.letter').boundingBox())!;
  expect(Math.abs(letter.x + letter.width / 2 - 720)).toBeLessThan(2);

  for (const path of ['states/o-predpriyatii/', 'states/kollektiv-i-vakansii/']) {
    await page.goto(base + path);
    const text = (await page.locator('.company-text').boundingBox())!;
    const aside = (await page.locator('.company-aside').boundingBox())!;
    expect(aside.x, path).toBeGreaterThan(text.x + text.width);
  }
  await expect(page.locator('.company-vacancy')).toContainText('Від 5 років');

  await page.goto(base + 'states/nash-stanochnyy-park/');
  await expect(page.locator('.machine')).toHaveCount(14);
  await expect(page.locator('.machine-index a')).toHaveCount(14);
  await expect(page.locator('#tokarno-karyselniy-stanok h2')).toHaveText('Карусельний двостійковий верстат 1553 Ø2300');
  await expect(page.locator('#tokarno-karyselniy-stanok img')).toHaveCount(1);
  await expect(page.locator('#tokarno-karyselniy-stanok img')).toHaveAttribute('src', /lathe-1553-2026\.jpg$/);
  const photo = (await page.locator('#tokarno-vintorezniy-stanok-dip-400 .machine-photo').boundingBox())!;
  const description = (await page.locator('#tokarno-vintorezniy-stanok-dip-400 .machine-text').boundingBox())!;
  expect(description.x).toBeGreaterThan(photo.x + photo.width);
  await page.locator('.machine-index a').nth(7).click();
  await expect(page).toHaveURL(/#press$/);

  await page.goto(base + 'states/dokumenty/');
  const documents = page.locator('.document-grid li');
  await expect(documents).toHaveCount(9);
  await expect(page.locator('.documents a')).toHaveCount(0);
  await expect(documents.nth(0)).toContainText('Виписка з Єдиного державного реєстру');
  await expect(documents.nth(0).locator('.document-pages-count')).toHaveText('3 стор.');
  await expect(documents.nth(2)).toContainText('Наказ про призначення директора');
  await expect(documents.nth(3)).toContainText('Дозвіл №1118.14.12');
  await expect(documents.nth(3).locator('button')).toHaveAttribute('data-pages', /8c723c805bbbd7dc\.jpg/);
  await expect(documents.nth(4).locator('button')).toHaveAttribute('data-pages', /4433b5c9966bde7c\.jpg/);
  await expect(documents.nth(6)).toContainText('Сертифікат відповідності типу');
  const first = (await documents.nth(0).boundingBox())!;
  const fifth = (await documents.nth(4).boundingBox())!;
  expect(fifth.y).toBeCloseTo(first.y, 0);
});

test('links are named after the pages they open', async ({ page }) => {
  const generic = /^(Докладніше|Переглянути роботу|Наші можливості|Увесь каталог|Більше про ДЗС|Уся галерея|Усі контакти|Усі напрями|Learn more|View project)$/;
  const anchors = async () => page.locator('a[href]').evaluateAll(links => links.map(link => (link.textContent || '').replace(/\s+/g, ' ').trim()));
  for (const route of ['', 'catalog/', 'catalog/category/remont/', product.hitachi, 'portfolio/', 'states/o-predpriyatii/', 'en/', 'en/catalog/']) {
    await page.goto(base + route);
    for (const text of await anchors()) {
      expect(text, route).not.toMatch(generic);
      expect(text, route).not.toMatch(/[↗→]/);
    }
  }

  // Cards carry the heading of the page they open.
  await page.goto(base + 'catalog/');
  const cards = page.locator('.card-link');
  for (const index of [0, 6, 10]) {
    const name = (await cards.nth(index).textContent())!.trim();
    await cards.nth(index).click();
    await expect(page.locator('h1')).toHaveText(name);
    await page.goBack();
  }

  // Products show their catalogue section in the breadcrumbs and in structured data.
  await page.goto(base + product.lathe);
  await expect(page.locator('.breadcrumbs a')).toHaveText(['Головна', 'Продукція та послуги', 'Механічна обробка металу']);
  const crumbs = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(crumbs['@type']).toBe('BreadcrumbList');
  expect(crumbs.itemListElement).toHaveLength(4);
  expect(crumbs.itemListElement[2].item).toMatch(/\/catalog\/category\/uslugi\/$/);

  // The lathe service and the lathe on the machine-shop page link to each other.
  await page.locator('.product-facts a', { hasText: 'Токарно-карусельний 1553' }).click();
  await expect(page).toHaveURL(/\/states\/nash-stanochnyy-park\/#tokarno-karyselniy-stanok$/);
  await page.locator('#tokarno-karyselniy-stanok .machine-service').click();
  await expect(page.locator('h1')).toHaveText('Токарні роботи на карусельному верстаті 1553');

  // Source texts link their first mention of a product or section.
  await page.goto(base + 'states/o-predpriyatii/');
  await expect(page.locator('.company-text a')).toHaveText(['верстатний парк', 'планетарних редукторів ходу та повороту Komatsu, Hitachi, Caterpillar', 'фрикційних виробів для спецтехніки та обладнання', 'гальмівних колодок для великовантажного самоскида Hitachi 3500']);
  await page.goto(base + 'news/8/');
  await expect(page.locator('main a[href$="/news/8/"]')).toHaveCount(0);
  await expect(page.locator('.rich-content a[href*="4674697-hitachi"]')).toHaveCount(1);

  // The footer lists the catalogue sections on every page; the timeline keeps words apart.
  await expect(page.locator('.site-footer nav').first().locator('a')).toHaveText(['Виготовлення деталей і вузлів', 'Ремонт редукторів і агрегатів', 'Механічна обробка металу']);
  await page.goto(base + product.hitachi);
  await expect(page.locator('.parts-timeline a').first()).toHaveText('2017 Сальник для HITACHI EH 3500 4703800');
});
