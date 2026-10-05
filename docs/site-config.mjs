export const PUBLIC_BASE_URL = 'https://fcarlosfisio-droid.github.io/CATALOGO-LEGADO-ACESSORIOS/';
export const APP_BASE_PATH = typeof document === 'undefined' ? '/' : document.querySelector('meta[name="app-base"]')?.content || '/';

export function sitePath(path, basePath = APP_BASE_PATH) {
  const prefix = basePath.replace(/\/$/, '');
  if (prefix && (path === prefix || path.startsWith(prefix + '/'))) return path;
  return prefix + (path.startsWith('/') ? path : '/' + path);
}

export const productSlug = product => product.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const productPublicUrl = (product, baseUrl = PUBLIC_BASE_URL) => new URL(`produtos/${productSlug(product)}/`, baseUrl).href;
export const WHATSAPP_NUMBER = '5583986858298';
export function purchaseUrl(product) {
  const message = `Olá! Tenho interesse em comprar ${product.name}.\nLink do produto: ${productPublicUrl(product)}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
