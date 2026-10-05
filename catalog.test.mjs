import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, selectProducts, readRoute, emptyState } from './catalog.mjs';

const products = [
  { id: 1, name: 'Relógio Essencial Azul', category: 'Relógios', price: 249.9 },
  { id: 2, name: 'Pulseira Elo Prata', category: 'Pulseiras', price: 89.9 },
  { id: 3, name: 'Corrente Clássica', category: 'Correntes', price: 119.9 },
  { id: 4, name: 'Anel Signet Prata', category: 'Anéis', price: 79.9 },
];

test('cada endereço seleciona apenas os produtos da categoria correspondente', () => {
  for (const item of categories) {
    const route = readRoute(new URL(`http://localhost:3000/categorias/${item.slug}`));
    assert.equal(route.category, item.name);
    const selected = selectProducts(products, route);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].category, item.name);
  }
});
test('pesquisa por nome ignora acentos, maiúsculas e espaços nas extremidades', () => {
  assert.deepEqual(selectProducts(products, { query: '  RELOGIO essencial  ' }).map(p => p.id), [1]);
  assert.deepEqual(selectProducts(products, { query: 'categoria' }), []);
});
test('palavra inexistente exibe recuperação e limpar restaura a categoria', () => {
  assert.deepEqual(selectProducts(products, { category: 'Anéis', query: 'inexistente' }), []);
  assert.equal(emptyState({ category: 'Anéis', query: 'inexistente' }).kind, 'search');
  assert.equal(selectProducts(products, { category: 'Anéis', query: '' }).length, 1);
});
test('categoria vazia e catálogo vazio oferecem mensagens específicas', () => {
  assert.deepEqual(selectProducts([], { category: 'Relógios' }), []);
  assert.match(emptyState({ category: 'Relógios' }).message, /Ainda não há produtos em Relógios/);
  assert.match(emptyState().message, /ainda não tem produtos cadastrados/);
});
test('endereço com pesquisa pode ser reaberto e categorias inválidas têm recuperação', () => {
  const route = readRoute(new URL('http://localhost:3000/categorias/relogios/?busca=azul'));
  assert.equal(route.category, 'Relógios');
  assert.equal(route.query, 'azul');
  assert.equal(readRoute(new URL('http://localhost:3000/categorias/desconhecida')).page, 'missing');
  assert.equal(emptyState({ missing: true }).action, 'Ver todos os produtos');
});
test('estado inicial, favoritos vazios e ordenação não alteram os produtos de origem', () => {
  assert.equal(readRoute(new URL('http://localhost:3000/#inicio')).page, 'home');
  assert.deepEqual(selectProducts(products, { onlyFavorites: true }), []);
  assert.equal(emptyState({ onlyFavorites: true }).title, 'Você ainda não tem favoritos');
  assert.equal(selectProducts(products, { sort: 'asc' })[0].id, 4);
  assert.equal(products[0].id, 1);
});
