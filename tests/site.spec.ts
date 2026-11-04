import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

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
    expect(html, relative).toContain('lang="uk"');
    expect(html, relative).toContain('noindex, nofollow');
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
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];
const routes = ['', 'catalog/', 'product/info/proizvodstvo-tormoznoj-diskovoj-nakladki-dlya-samosvala-belaz-130t/', 'states/nash-stanochnyy-park/', 'states/dokumenty/', 'portfolio/', 'contacts/'];

for (const viewport of screens) {
  test('layout and image loading at '+viewport.width+'px', async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of routes) {
      await page.goto(base + route);
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
      if ((viewport.width === 375 || viewport.width === 1440) && (route === '' || route.startsWith('product/'))) {
        await page.screenshot({ path: 'test-results/' + (route ? 'product' : 'home') + '-' + viewport.width + '.png', fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  });
}

test('mobile menu opens and follows a section link', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base);
  const navigation = page.getByRole('navigation', { name: 'Мобільна навігація' });
  await expect(navigation).not.toBeVisible();
  await page.getByText('Меню', { exact: false }).first().click();
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Галерея' }).click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Галерея робіт');
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
