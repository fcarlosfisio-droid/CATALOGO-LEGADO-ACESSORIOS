import test from 'node:test';
import assert from 'node:assert/strict';
import { productSlug, productPublicUrl, purchaseUrl, sitePath, WHATSAPP_NUMBER } from './site-config.mjs';
import { readRoute } from './catalog.mjs';

const product = { name: 'Relógio Essencial Azul' };
test('mensagem identifica o produto e o número completo com código do Brasil', () => {
  const url = new URL(purchaseUrl(product));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/5583986858298');
  assert.equal(WHATSAPP_NUMBER, '5583986858298');
  assert.equal(url.searchParams.get('text'), `Olá! Tenho interesse em comprar Relógio Essencial Azul.\nLink do produto: ${productPublicUrl(product)}`);
});
test('link público é HTTPS e abre a rota exata mesmo fora da página inicial', () => {
  const url = new URL(productPublicUrl(product));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'fcarlosfisio-droid.github.io');
  const route = readRoute(url, '/CATALOGO-LEGADO-ACESSORIOS/');
  assert.equal(route.page, 'product');
  assert.equal(route.slug, productSlug(product));
});
test('nomes com acentos produzem endereços distintos e não incluem pesquisa', () => {
  const names = ['Relógio Essencial Azul', 'Relógio Essencial Grafite', 'Pulseira Elo Prata', 'Pulseira Elo Grafite', 'Corrente Clássica', 'Corrente Urbana', 'Anel Signet Prata', 'Anel Signet Azul'];
  assert.equal(new Set(names.map(name => productSlug({ name }))).size, 8);
  for (const name of names) assert.equal(new URL(productPublicUrl({ name })).search, '');
});
test('navegação funciona no servidor local e no subdiretório público', () => {
  assert.equal(sitePath('/catalogo', '/'), '/catalogo');
  assert.equal(sitePath('/catalogo', '/CATALOGO-LEGADO-ACESSORIOS/'), '/CATALOGO-LEGADO-ACESSORIOS/catalogo');
  assert.equal(sitePath('/CATALOGO-LEGADO-ACESSORIOS/catalogo', '/CATALOGO-LEGADO-ACESSORIOS/'), '/CATALOGO-LEGADO-ACESSORIOS/catalogo');
  assert.equal(readRoute(new URL('https://fcarlosfisio-droid.github.io/CATALOGO-LEGADO-ACESSORIOS/'), '/CATALOGO-LEGADO-ACESSORIOS/').page, 'home');
});
