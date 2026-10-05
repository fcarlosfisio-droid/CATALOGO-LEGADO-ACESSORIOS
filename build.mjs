import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { products } from './products.mjs';
import { categories } from './catalog.mjs';
import { PUBLIC_BASE_URL, productSlug } from './site-config.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const output = path.join(root, 'docs');
const base = new URL(PUBLIC_BASE_URL).pathname;
const source = await readFile(path.join(root, 'index.html'), 'utf8');
const html = source.replace(/(href|src)="\//g, `$1="${base}`).replace('<head>', `<head><meta name="app-base" content="${base}">`);
await mkdir(output, { recursive: true });
for (const file of ['styles.css', 'app.js', 'navigation.mjs', 'catalog.mjs', 'products.mjs', 'site-config.mjs']) {
  await copyFile(path.join(root, file), path.join(output, file));
}
const routes = ['', 'catalogo', ...categories.map(item => `categorias/${item.slug}`), ...products.map(item => `produtos/${productSlug(item)}`)];
for (const route of routes) {
  const directory = path.join(output, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
}
await writeFile(path.join(output, '404.html'), html);
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`Publicação estática preparada em docs/: ${routes.length} páginas para ${PUBLIC_BASE_URL}`);
