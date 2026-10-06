import { categories, selectProducts, readRoute, emptyState } from './catalog.mjs';
import { APP_BASE_PATH, sitePath, productSlug, productPublicUrl, purchaseUrl } from './site-config.mjs';

export function mountCatalog({ products, favorites, art, icon }) {
  const $ = selector => document.querySelector(selector);
  const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let route, category = 'Todos', query = '', onlyFavorites = false, sort = 'featured';
  let toastTimeout;
  const categoryPath = name => sitePath(name === 'Todos' ? '/catalogo' : `/categorias/${categories.find(item => item.name === name).slug}`);
  const controls = [{ name: 'Todos', slug: '' }, ...categories];
  $('#year').textContent = new Date().getFullYear();
  $('#filters').innerHTML = controls.map(item => `<a href="${categoryPath(item.name)}" data-category="${item.name}">${item.name}</a>`).join('');

  function closeMenu() {
    $('#navigation').classList.remove('open');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    $('#menu-toggle').setAttribute('aria-label', 'Abrir menu');
    $('#menu-toggle').innerHTML = icon('menu');
  }

  function syncSearchAddress() {
    const url = new URL(location.href);
    if (query.trim()) url.searchParams.set('busca', query.trim());
    else url.searchParams.delete('busca');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function applyRoute({ scroll = false } = {}) {
    route = readRoute(new URL(location.href), APP_BASE_PATH);
    const selectedProduct = route.page === 'product' ? products.find(product => productSlug(product) === route.slug) : null;
    if (route.page === 'product' && !selectedProduct) route.page = 'missing';
    category = route.category;
    if (selectedProduct) category = selectedProduct.category;
    query = route.query;
    onlyFavorites = false;
    sort = 'featured';
    $('#sort').value = sort;
    $('#search').value = query;
    const home = route.page === 'home';
    $('#inicio').hidden = !home;
    $('.breadcrumbs').hidden = home;
    $('#breadcrumb-category').textContent = route.page === 'category' || selectedProduct ? `/ ${category}` : '';
    $('#search-panel').hidden = home && !query;
    $('#catalog-title').textContent = route.page === 'category' || selectedProduct ? category : route.page === 'missing' ? 'Página não encontrada' : 'Explore o catálogo';
    document.title = `${selectedProduct ? selectedProduct.name : route.page === 'category' ? category : home ? 'LEGADO' : 'Catálogo'} | Acessórios masculinos`;
    $('#catalogo').classList.toggle('category-page', !home);
    document.querySelectorAll('#navigation a').forEach(link => {
      const active = home ? link.hash === '#inicio' : link.pathname === sitePath('/catalogo');
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    render();
    closeMenu();
    if (selectedProduct) showProduct(selectedProduct);
    else $('#product-dialog').close();
    if (scroll) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function navigate(href, state = null) {
    const url = new URL(href, location.origin);
    url.pathname = sitePath(url.pathname);
    history.pushState(state, '', url.pathname + url.search + url.hash);
    $('#product-dialog').close();
    applyRoute({ scroll: true });
  }

  function renderEmpty() {
    const state = emptyState({ missing: route.page === 'missing', onlyFavorites, query, category });
    const container = document.createElement('div');
    container.className = 'empty';
    const heading = document.createElement('h3');
    heading.textContent = state.title;
    const description = document.createElement('p');
    description.textContent = state.message;
    const action = document.createElement(state.kind === 'search' ? 'button' : 'a');
    action.className = 'button empty-action';
    action.textContent = state.action;
    if (state.kind === 'search') action.dataset.clearSearch = '';
    else action.href = sitePath('/catalogo');
    container.append(heading, description, action);
    $('#products').replaceChildren(container);
  }

  function render() {
    const list = route.page === 'missing' ? [] : selectProducts(products, { category, query, onlyFavorites, favorites, sort });
    if (list.length) $('#products').innerHTML = list.map(p => `<article class="product"><div class="product-image"><div class="art">${art(p.category, p.variant)}</div>${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}<button class="favorite" data-favorite="${p.id}" aria-label="${favorites.has(p.id) ? 'Remover dos' : 'Adicionar aos'} favoritos: ${p.name}" aria-pressed="${favorites.has(p.id)}">${icon('heart')}</button></div><div class="product-info"><small>${p.category}</small><button class="product-title" data-product="${p.id}">${p.name}</button><div class="product-meta"><span class="price">${money(p.price)}</span><button class="details" data-product="${p.id}">Ver detalhes</button></div></div></article>`).join('');
    else renderEmpty();
    $('#results-count').textContent = `${list.length} ${list.length === 1 ? 'acessório encontrado' : 'acessórios encontrados'}${onlyFavorites ? ' nos favoritos' : ''}`;
    $('#clear-search').hidden = !query;
    $('#reset').hidden = !query && !onlyFavorites;
    $('#reset').textContent = query ? 'Limpar pesquisa' : 'Ver todos os produtos';
    document.querySelectorAll('#filters a').forEach(link => {
      const selected = link.dataset.category === category && route.page !== 'missing';
      link.classList.toggle('selected', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $('#favorite-count').textContent = favorites.size;
    $('#favorite-count').hidden = !favorites.size;
    $('#favorites-toggle').setAttribute('aria-pressed', String(onlyFavorites));
  }

  function clearSearch() {
    query = '';
    $('#search').value = '';
    syncSearchAddress();
    render();
    $('#search').focus({ preventScroll: true });
  }

  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 2300);
  }

  function toggleFavorite(id) {
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    try { localStorage.setItem('legado-favorites', JSON.stringify([...favorites])); } catch {}
    render();
    toast(favorites.has(id) ? 'Acessório salvo nos favoritos' : 'Acessório removido dos favoritos');
    const button = $('#dialog-content [data-favorite]');
    if (button) {
      button.innerHTML = `${icon('heart')} ${favorites.has(id) ? 'Remover dos favoritos' : 'Salvar nos favoritos'}`;
      button.setAttribute('aria-pressed', String(favorites.has(id)));
    }
  }

  function showProduct(product) {
    $('#dialog-content').innerHTML = `<div class="dialog-grid"><div class="dialog-art">${art(product.category, product.variant)}</div><div class="dialog-copy"><div class="eyebrow">${product.category}</div><h2 id="product-name">${product.name}</h2><p>${product.description}</p><span class="price">${money(product.price)}</span><p><small>Peça demonstrativa. Confirme material, medidas, disponibilidade e preço final com a loja.</small></p><div class="purchase-actions"><a class="button buy-button" href="${purchaseUrl(product)}" rel="noopener noreferrer">Comprar ${icon('arrow')}</a><button class="detail-favorite" data-favorite="${product.id}" aria-pressed="${favorites.has(product.id)}">${icon('heart')} ${favorites.has(product.id) ? 'Remover dos favoritos' : 'Salvar nos favoritos'}</button></div><p class="purchase-note">Você será levado ao WhatsApp com a mensagem pronta. O envio é feito por você.</p><details class="share-product"><summary>Compartilhar produto</summary><label for="product-share-link">Link público do produto</label><input id="product-share-link" type="url" readonly value="${productPublicUrl(product)}"><button class="copy-link" type="button">Copiar link</button><span class="copy-feedback" role="status"></span></details></div></div>`;
    const modal = $('#product-dialog');
    modal.setAttribute('aria-labelledby', 'product-name');
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
  }

  function closeProduct() {
    if (history.state?.returnTo) history.back();
    else navigate(categoryPath(category));
  }

  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (anchor && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && anchor.origin === location.origin && !anchor.target && !anchor.hasAttribute('download')) {
      event.preventDefault();
      navigate(anchor.href);
      return;
    }
    if (event.target.closest('[data-clear-search], #clear-search')) { clearSearch(); return; }
    if (event.target.closest('.copy-link')) {
      const field = $('#product-share-link');
      navigator.clipboard.writeText(field.value).then(() => {
        $('.copy-feedback').textContent = 'Link copiado.';
        toast('Link do produto copiado');
      }).catch(() => {
        field.focus();
        field.select();
        $('.copy-feedback').textContent = 'Selecione e copie o link no campo acima.';
      });
      return;
    }
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) toggleFavorite(Number(favorite.dataset.favorite));
    const target = event.target.closest('[data-product]');
    if (target) {
      const product = products.find(item => item.id === Number(target.dataset.product));
      navigate(sitePath(`/produtos/${productSlug(product)}/`), { returnTo: location.pathname + location.search + location.hash });
    }
  });
  $('#sort').addEventListener('change', event => { sort = event.target.value; render(); });
  $('#search').addEventListener('input', event => { query = event.target.value; syncSearchAddress(); render(); });
  $('#search-toggle').addEventListener('click', () => {
    if (route.page === 'home' || route.page === 'missing' || route.page === 'product') navigate('/catalogo');
    $('#search-panel').hidden = false;
    $('#search').focus({ preventScroll: true });
  });
  $('#favorites-toggle').addEventListener('click', () => {
    const requested = !onlyFavorites;
    if (route.page !== 'catalog') navigate('/catalogo');
    onlyFavorites = requested;
    query = '';
    $('#search').value = '';
    syncSearchAddress();
    render();
  });
  $('#reset').addEventListener('click', () => query ? clearSearch() : navigate('/catalogo'));
  $('#menu-toggle').addEventListener('click', () => {
    const open = $('#navigation').classList.toggle('open');
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
    $('#menu-toggle').setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    $('#menu-toggle').innerHTML = icon(open ? 'close' : 'menu');
  });
  const dialog = $('#product-dialog');
  dialog.querySelector('.close-dialog').addEventListener('click', closeProduct);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeProduct(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeProduct();
    }
  });
  window.addEventListener('popstate', () => applyRoute({ scroll: true }));
  window.addEventListener('hashchange', () => applyRoute());
  applyRoute();
}
