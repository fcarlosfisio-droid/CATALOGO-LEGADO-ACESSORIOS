import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizeEmail, verifyPassword, csrfFor, safeEqual, digest } from './admin-store.mjs';
import { PUBLIC_BASE_URL } from './site-config.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicPrefix = new URL(PUBLIC_BASE_URL).pathname.replace(/\/$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
const publicAssets = new Set(['styles.css', 'app.js', 'navigation.mjs', 'catalog.mjs', 'products.mjs', 'site-config.mjs']);
const adminAssets = new Set(['admin.js', 'admin.css']);
const issue = (status, message) => Object.assign(new Error(message), { status });

async function readJson(request) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw issue(415, 'Use conteúdo JSON.');
  if (Number(request.headers['content-length']) > 16384) throw issue(413, 'Conteúdo muito grande.');
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw issue(413, 'Conteúdo muito grande.');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw issue(400, 'Conteúdo inválido.'); }
}

export function createApplication({ store, origin = 'http://localhost:3000', secureCookies = false }) {
  const COOKIE = secureCookies ? '__Host-legado_session' : 'legado_session';
  const getOrigin = () => typeof origin === 'function' ? origin() : origin;
  const cookie = (token, age = Math.floor(store.absoluteMs / 1000)) => `${COOKIE}=${token}; Path=${secureCookies ? '/' : '/api'}; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookies ? '; Secure' : ''}`;
  const tokenFrom = request => String(request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  const publicUser = row => ({ id: row.user_id ?? row.id, name: row.name, email: row.email, role: row.role });
  const json = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(body)); };
  const sameOrigin = request => { if (request.headers.origin !== getOrigin()) throw issue(403, 'Origem da solicitação não permitida.'); };
  const rateLimit = (response, keys, limits, minutes = 15) => {
    const seconds = store.throttle(keys, limits, minutes * 60000);
    if (seconds) { response.setHeader('Retry-After', seconds); throw issue(429, 'Muitas tentativas. Aguarde antes de tentar novamente.'); }
  };
  function authenticated(request, response, { mutate = false, owner = false } = {}) {
    const token = tokenFrom(request);
    const session = store.resolveSession(token);
    if (!session) { response.setHeader('Set-Cookie', cookie('', 0)); throw issue(401, 'Faça login para continuar.'); }
    if (owner && session.role !== 'owner') throw issue(403, 'Esta operação exige uma conta responsável.');
    if (mutate) {
      sameOrigin(request);
      const csrf = request.headers['x-csrf-token'];
      if (!/^[a-f0-9]{64}$/.test(String(csrf || '')) || !safeEqual(csrf, csrfFor(token))) throw issue(403, 'Solicitação inválida. Atualize a página e tente novamente.');
    }
    return { session, token };
  }
  async function reauthenticate(request, response, userId, password) {
    rateLimit(response, ['reauth-account:' + userId, 'reauth-ip:' + request.socket.remoteAddress], [5, 20]);
    const user = store.db.prepare('SELECT * FROM users WHERE id=? AND disabled=0').get(userId);
    if (!user || !await verifyPassword(password, user.password_hash)) throw issue(403, 'A senha atual não foi confirmada.');
    const current = store.db.prepare('SELECT * FROM users WHERE id=? AND disabled=0').get(userId);
    if (!current || current.password_hash !== user.password_hash) throw issue(401, 'Faça login novamente para continuar.');
    authenticated(request, response, { mutate: true, owner: true });
    store.db.prepare('DELETE FROM attempts WHERE key=?').run(digest('reauth-account:' + userId));
  }

  async function api(request, response, url) {
    response.setHeader('Cache-Control', 'no-store');
    const method = request.method;
    const pathname = url.pathname;
    const ip = request.socket.remoteAddress || 'unknown';
    if (pathname === '/api/products' && method === 'GET') return json(response, 200, { products: store.products(), publicBaseUrl: secureCookies ? getOrigin() + '/' : PUBLIC_BASE_URL });
    if (pathname === '/api/auth/login' && method === 'POST') {
      sameOrigin(request);
      const body = await readJson(request);
      const email = normalizeEmail(body.email);
      rateLimit(response, ['login-account:' + email, 'login-ip:' + ip], [5, 20]);
      const user = await store.authenticate(email, body.password);
      if (!user) throw issue(401, 'E-mail ou senha incorretos.');
      const previous = tokenFrom(request);
      if (previous) store.logout(previous);
      const token = store.session(user.id);
      response.setHeader('Set-Cookie', cookie(token));
      return json(response, 200, { user: publicUser(user), csrfToken: csrfFor(token), expiresAt: store.clock() + Math.min(store.idleMs, store.absoluteMs) });
    }
    if (pathname === '/api/auth/session' && method === 'GET') {
      const { session, token } = authenticated(request, response);
      return json(response, 200, { user: publicUser(session), csrfToken: csrfFor(token), expiresAt: session.expires_at });
    }
    if (pathname === '/api/auth/recovery-request' && method === 'POST') {
      sameOrigin(request);
      const body = await readJson(request);
      let email;
      try { email = normalizeEmail(body.email); } catch { email = ''; }
      rateLimit(response, ['recovery-account:' + email, 'recovery-ip:' + ip], [3, 10], 30);
      if (email) store.requestRecovery(email);
      return json(response, 200, { message: 'Se houver uma conta ativa, o responsável poderá fornecer um link após confirmar sua identidade. Entre em contato com ele.' });
    }
    if (pathname === '/api/auth/reset-password' && method === 'POST') {
      sameOrigin(request);
      rateLimit(response, ['reset-ip:' + ip], 10, 30);
      const body = await readJson(request);
      const success = await store.recover(body.token, body.password);
      if (!success) throw issue(400, 'Este link está inválido, expirou ou já foi utilizado. Peça um novo link ao responsável.');
      response.setHeader('Set-Cookie', cookie('', 0));
      return json(response, 200, { message: 'Senha alterada. Faça login com a nova senha.' });
    }
    // Todas as rotas restantes da API exigem sessão. Operações não seguras também exigem origem e CSRF.
    const mutate = !['GET', 'HEAD'].includes(method);
    const owner = pathname.startsWith('/api/admin/');
    authenticated(request, response, { mutate, owner });
    const body = mutate && !(pathname === '/api/auth/logout' || method === 'DELETE') ? await readJson(request) : null;
    const { session, token } = authenticated(request, response, { mutate, owner });
    if (pathname === '/api/auth/logout' && method === 'POST') {
      store.logout(token);
      store.audit(session.user_id, 'auth.logout');
      response.setHeader('Set-Cookie', cookie('', 0));
      return json(response, 200, { message: 'Sessão encerrada.' });
    }
    if (pathname === '/api/products' && method === 'POST') {
      const product = store.saveProduct(body, null, session.user_id);
      return json(response, 201, { product });
    }
    const productId = pathname.match(/^\/api\/products\/([1-9][0-9]*)$/);
    if (productId && method === 'PATCH') return json(response, 200, { product: store.saveProduct(body, Number(productId[1]), session.user_id) });
    if (productId && method === 'DELETE') { store.deleteProduct(Number(productId[1]), session.user_id); return json(response, 200, { message: 'Produto removido.' }); }
    if (pathname === '/api/admin/users' && method === 'GET') return json(response, 200, { users: store.users() });
    if (pathname === '/api/admin/users' && method === 'POST') {
      await reauthenticate(request, response, session.user_id, body.currentPassword);
      const id = await store.createUser({ email: body.email, name: body.name, role: 'staff' });
      store.audit(session.user_id, 'account.invited', id);
      const resetToken = store.issueRecovery(id, session.user_id);
      return json(response, 201, { setupUrl: getOrigin() + '/admin#recuperar=' + resetToken, message: 'Link pessoal válido por 30 minutos. Entregue somente após confirmar a identidade do funcionário.' });
    }
    const accountAction = pathname.match(/^\/api\/admin\/users\/([1-9][0-9]*)\/(recovery|disable)$/);
    if (accountAction && method === 'POST') {
      await reauthenticate(request, response, session.user_id, body.currentPassword);
      const id = Number(accountAction[1]);
      if (accountAction[2] === 'disable') { store.disableUser(id, session.user_id); return json(response, 200, { message: 'Conta desativada e sessões revogadas.' }); }
      const resetToken = store.issueRecovery(id, session.user_id);
      return json(response, 200, { setupUrl: getOrigin() + '/admin#recuperar=' + resetToken, message: 'Link de uso único válido por 30 minutos. Confirme a identidade antes de entregá-lo.' });
    }
    if (pathname === '/api/admin/audit' && method === 'GET') return json(response, 200, { events: store.db.prepare('SELECT a.id,a.action,a.resource_id,a.created_at,u.name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100').all() });
    throw issue(404, 'Operação não encontrada.');
  }

  return async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if (secureCookies) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(request.url, getOrigin());
      if (url.pathname.startsWith('/api/')) return await api(request, response, url);
      if (!['GET', 'HEAD'].includes(request.method)) throw issue(405, 'Método não permitido.');
      const pathname = decodeURIComponent(url.pathname);
      const preview = pathname === publicPrefix || pathname.startsWith(publicPrefix + '/');
      const relative = preview ? pathname.slice(publicPrefix.length) : pathname;
      const isPage = relative === '' || relative === '/' || /^\/catalogo\/?$/.test(relative) || /^\/(categorias|produtos)\/[a-z0-9-]+\/?$/.test(relative);
      const isAdmin = !preview && /^\/admin\/?$/.test(relative);
      const asset = relative.startsWith('/') ? relative.slice(1) : relative;
      if (!isPage && !isAdmin && !publicAssets.has(asset) && !(adminAssets.has(asset) && !preview)) throw issue(404, 'Página não encontrada.');
      const file = isAdmin ? path.join(root, 'admin.html') : isPage ? path.join(root, preview ? 'docs/index.html' : 'index.html') : path.join(root, preview ? 'docs' : '', asset);
      const content = await readFile(file);
      response.setHeader('Cache-Control', isAdmin || adminAssets.has(asset) ? 'no-store' : 'no-cache');
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      json(response, status, { error: status === 500 ? 'Não foi possível concluir a operação.' : error.message });
    }
  };
}
