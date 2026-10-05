export const categories = [
  { name: 'Relógios', slug: 'relogios' },
  { name: 'Pulseiras', slug: 'pulseiras' },
  { name: 'Correntes', slug: 'correntes' },
  { name: 'Anéis', slug: 'aneis' },
];

export const normalizeName = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function selectProducts(products, { category = 'Todos', query = '', onlyFavorites = false, favorites = new Set(), sort = 'featured' } = {}) {
  const term = normalizeName(query);
  const result = products.filter(product =>
    (category === 'Todos' || product.category === category) &&
    (!onlyFavorites || favorites.has(product.id)) &&
    normalizeName(product.name).includes(term)
  );
  if (sort === 'asc') result.sort((a, b) => a.price - b.price);
  if (sort === 'desc') result.sort((a, b) => b.price - a.price);
  if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return result;
}

export function readRoute(url, basePath = '/') {
  const prefix = basePath.replace(/\/$/, '');
  const relative = prefix && (url.pathname === prefix || url.pathname.startsWith(prefix + '/')) ? url.pathname.slice(prefix.length) : url.pathname;
  const pathname = relative.replace(/\/+$/, '') || '/';
  const query = url.searchParams.get('busca') || '';
  if (pathname === '/') return { page: 'home', category: 'Todos', query };
  if (pathname === '/catalogo') return { page: 'catalog', category: 'Todos', query };
  const product = pathname.match(/^\/produtos\/([a-z0-9-]+)$/);
  if (product) return { page: 'product', category: 'Todos', query: '', slug: product[1] };
  const category = categories.find(item => pathname === `/categorias/${item.slug}`);
  if (category) return { page: 'category', category: category.name, query };
  return { page: 'missing', category: 'Todos', query: '' };
}

export function emptyState({ missing = false, onlyFavorites = false, query = '', category = 'Todos' } = {}) {
  if (missing) return { title: 'Categoria não encontrada', message: 'Este endereço não corresponde a uma categoria do catálogo. Explore as categorias disponíveis.', action: 'Ver todos os produtos', kind: 'catalog' };
  if (query.trim()) return { title: 'Nenhum resultado encontrado', message: `Não encontramos produtos com o nome “${query.trim()}”${category === 'Todos' ? '' : ` na categoria ${category}`}. Confira o nome ou tente outra palavra.`, action: 'Limpar pesquisa', kind: 'search' };
  if (onlyFavorites) return { title: 'Você ainda não tem favoritos', message: 'Toque no coração de um produto para salvar seus acessórios preferidos.', action: 'Explorar o catálogo', kind: 'catalog' };
  return { title: 'Nenhum produto disponível', message: category === 'Todos' ? 'O catálogo ainda não tem produtos cadastrados. Volte em breve para conferir as novidades.' : `Ainda não há produtos em ${category}. Explore as outras categorias ou volte em breve.`, action: 'Ver todos os produtos', kind: 'catalog' };
}
