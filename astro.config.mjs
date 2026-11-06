import { defineConfig } from 'astro/config';
export default defineConfig({
  site: process.env.SITE_URL || 'https://deredskoy.github.io',
  base: process.env.BASE_PATH || '/dzs-new',
  output: 'static',
  trailingSlash: 'always',
});
