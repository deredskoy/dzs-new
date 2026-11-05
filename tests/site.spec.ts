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
const routes = ['', 'catalog/', 'product/info/proizvodstvo-tormoznoj-diskovoj-nakladki-dlya-samosvala-belaz-130t/', 'states/nash-stanochnyy-park/', 'states/dokumenty/', 'portfolio/', 'contacts/'];

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
      for (const link of await page.locator('.language-switch a').all()) {
        const box = await link.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
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
  await page.getByText('Меню', { exact: false }).first().click();
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Галерея' }).focus();
  await page.keyboard.press('Escape');
  await expect(navigation).not.toBeVisible();
  await expect(page.locator('.mobile-nav summary')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(navigation).toBeVisible();
  await page.locator('.language-switch a').first().focus();
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
  await page.getByLabel('Електронна пошта').fill('review@example.com');
  await page.getByLabel('Що потрібно виготовити чи відновити?').fill('Перевірка полів без надсилання повідомлення.');
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(true);
  await expect(form).toHaveAttribute('action', 'mailto:tovdzs@gmail.com');
  await expect(form.getByRole('button')).toHaveText(/Підготувати лист/);
  await expect(form.locator('.form-note')).toContainText('поштовій програмі');
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
  await page.locator('.rich-content').getByRole('link', { name: 'Our machine shop' }).click();
  await expect(page).toHaveURL(/\/en\/states\/nash-stanochnyy-park\/$/);
  await expect(page.locator('h1')).toHaveText('Our machine shop');
  await expect(page.locator('.rich-content')).toContainText('3000 kg');
  await page.locator('.breadcrumbs').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Products & services' }).click();
  await page.locator('.content-card').filter({ hasText: '130-tonne BelAZ' }).getByRole('link').first().click();
  await expect(page.locator('h1')).toHaveText('Brake lining for BelAZ');
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
