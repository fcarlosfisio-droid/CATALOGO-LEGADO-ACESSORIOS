import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { products as initialProducts } from './products.mjs';
import { productSlug } from './site-config.mjs';

const derive = promisify(scrypt);
const HASH_OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
export const digest = value => createHash('sha256').update(value).digest('hex');
export const csrfFor = token => createHmac('sha256', token).update('legado-session-csrf').digest('hex');
export function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 15 || password.length > 256) throw Object.assign(new Error('Use uma senha de 15 a 256 caracteres.'), { status: 400 });
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, HASH_OPTIONS);
  return `scrypt$131072$8$1$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const pieces = String(stored).split('$');
  if (pieces.length !== 6 || pieces.slice(0, 4).join('$') !== 'scrypt$131072$8$1' || !/^[a-f0-9]{32}$/.test(pieces[4]) || !/^[a-f0-9]{128}$/.test(pieces[5])) return false;
  const candidate = await derive(password, pieces[4], 64, HASH_OPTIONS);
  return timingSafeEqual(candidate, Buffer.from(pieces[5], 'hex'));
}
export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Informe um e-mail válido.'), { status: 400 });
  return email;
}
export function validateProduct(value, id) {
  const error = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) error('Produto inválido.');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  if (!name || name.length > 100) error('Informe um nome de até 100 caracteres.');
  if (description.length > 2000) error('A descrição deve ter até 2000 caracteres.');
  if (!['Relógios', 'Pulseiras', 'Correntes', 'Anéis'].includes(value.category)) error('Categoria inválida.');
  if (typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price < 0 || value.price > 1000000) error('Preço inválido.');
  const variant = value.variant || 'silver';
  if (!['silver', 'dark'].includes(variant)) error('Variação inválida.');
  return { ...(id ? { id } : {}), name, description, category: value.category, price: Math.round(value.price * 100) / 100, variant, badge: '' };
}

export class AdminStore {
  constructor({ filename = path.resolve('data/legado.sqlite'), clock = Date.now, idleMs = 30 * 60 * 1000, absoluteMs = 8 * 60 * 60 * 1000, recoveryMs = 30 * 60 * 1000 } = {}) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.clock = clock;
    this.idleMs = idleMs;
    this.absoluteMs = absoluteMs;
    this.recoveryMs = recoveryMs;
    this.db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','staff')), password_hash TEXT, disabled INTEGER NOT NULL DEFAULT 0, recovery_requested_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS recovery_tokens (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL, used_at INTEGER);
      CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_products (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, resource_id TEXT, created_at INTEGER NOT NULL);`);
    if (!this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('products_seeded')) {
      this.transaction(() => {
        const statement = this.db.prepare('INSERT INTO catalog_products(id, slug, data) VALUES(?, ?, ?)');
        for (const product of initialProducts) statement.run(product.id, productSlug(product), JSON.stringify(product));
        this.db.prepare('INSERT INTO metadata VALUES(?, ?)').run('products_seeded', '1');
      });
    }
    this.dummyHash = hashPassword(randomBytes(24).toString('hex'));
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  audit(userId, action, resource = '') { this.db.prepare('INSERT INTO audit(user_id, action, resource_id, created_at) VALUES(?, ?, ?, ?)').run(userId || null, action, String(resource), this.clock()); }
  users() { return this.db.prepare('SELECT id,email,name,role,disabled,recovery_requested_at,created_at FROM users ORDER BY id').all(); }
  userByEmail(email) { return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email); }
  async createUser({ email, name, role = 'staff', password }) {
    email = normalizeEmail(email);
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || !['owner', 'staff'].includes(role)) throw Object.assign(new Error('Nome ou perfil inválido.'), { status: 400 });
    const hash = password === undefined ? null : await hashPassword(password);
    if (this.userByEmail(email)) throw Object.assign(new Error('Já existe uma conta com este e-mail.'), { status: 409 });
    const result = this.db.prepare('INSERT INTO users(email,name,role,password_hash,created_at) VALUES(?,?,?,?,?)').run(email, name.trim(), role, hash, this.clock());
    this.audit(null, 'account.created', result.lastInsertRowid);
    return Number(result.lastInsertRowid);
  }
  throttle(keys, limit, windowMs) {
    const now = this.clock();
    return this.transaction(() => {
      this.db.prepare('DELETE FROM attempts WHERE window_start <= ?').run(now - 24 * 60 * 60 * 1000);
      const states = keys.map(key => ({ key: digest(key), row: this.db.prepare('SELECT * FROM attempts WHERE key = ?').get(digest(key)) }));
      const blocked = states.find(({ row }, index) => row && now - row.window_start < windowMs && row.count >= (Array.isArray(limit) ? limit[index] : limit));
      if (blocked) return Math.max(1, Math.ceil((blocked.row.window_start + windowMs - now) / 1000));
      for (const { key, row } of states) {
        if (!row || now - row.window_start >= windowMs) this.db.prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,window_start=excluded.window_start').run(key, now);
        else this.db.prepare('UPDATE attempts SET count=count+1 WHERE key=?').run(key);
      }
      return 0;
    });
  }
  async authenticate(email, password) {
    const user = this.userByEmail(email);
    const valid = await verifyPassword(password, user?.password_hash || await this.dummyHash);
    const current = user ? this.userByEmail(email) : null;
    if (!current || current.disabled || !current.password_hash || current.password_hash !== user.password_hash || !valid) { this.audit(user?.id, 'auth.login_failed'); return null; }
    this.db.prepare('DELETE FROM attempts WHERE key=?').run(digest('login-account:' + email));
    this.audit(user.id, 'auth.login');
    return user;
  }
  session(userId) {
    const token = randomBytes(32).toString('hex');
    const now = this.clock();
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR last_seen_at <= ?').run(now, now - this.idleMs);
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(digest(token), userId, now, now, now + this.absoluteMs);
    return token;
  }
  resolveSession(token, { touch = true } = {}) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.db.prepare('SELECT s.*, u.email,u.name,u.role,u.disabled FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(digest(token));
    const now = this.clock();
    if (!row) return null;
    if (row.disabled || row.expires_at <= now || row.last_seen_at + this.idleMs <= now) { this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); return null; }
    if (touch) this.db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(now, digest(token));
    return { ...row, expires_at: Math.min(row.expires_at, (touch ? now : row.last_seen_at) + this.idleMs) };
  }
  logout(token) { this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); }
  issueRecovery(userId, actorId = null) {
    const user = this.db.prepare('SELECT * FROM users WHERE id=? AND disabled=0').get(userId);
    if (!user) throw Object.assign(new Error('Conta não disponível.'), { status: 404 });
    const token = randomBytes(32).toString('hex');
    this.transaction(() => {
      this.db.prepare('DELETE FROM recovery_tokens WHERE user_id=?').run(userId);
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
      this.db.prepare('INSERT INTO recovery_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token), userId, this.clock() + this.recoveryMs);
      this.db.prepare('UPDATE users SET recovery_requested_at=NULL WHERE id=?').run(userId);
      this.audit(actorId, 'account.recovery_issued', userId);
    });
    return token;
  }
  requestRecovery(email) { this.db.prepare('UPDATE users SET recovery_requested_at=? WHERE email=? AND disabled=0').run(this.clock(), email); }
  async recover(token, password) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
    const row = this.db.prepare('SELECT r.*,u.disabled FROM recovery_tokens r JOIN users u ON u.id=r.user_id WHERE token_hash=?').get(digest(token));
    if (!row || row.disabled || row.used_at !== null || row.expires_at <= this.clock()) return false;
    const hash = await hashPassword(password);
    return this.transaction(() => {
      if (this.db.prepare('SELECT disabled FROM users WHERE id=?').get(row.user_id)?.disabled !== 0) return false;
      const changed = this.db.prepare('UPDATE recovery_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?').run(this.clock(), digest(token), this.clock());
      if (!changed.changes) return false;
      this.db.prepare('UPDATE users SET password_hash=?,recovery_requested_at=NULL WHERE id=? AND disabled=0').run(hash, row.user_id);
      const account = this.db.prepare('SELECT email FROM users WHERE id=?').get(row.user_id);
      this.db.prepare('DELETE FROM attempts WHERE key=?').run(digest('login-account:' + account.email));
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
      this.audit(row.user_id, 'account.password_reset');
      return true;
    });
  }
  disableUser(userId, actorId) {
    if (userId === actorId) throw Object.assign(new Error('Você não pode desativar sua própria conta.'), { status: 400 });
    const user = this.db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    if (!user) throw Object.assign(new Error('Conta não encontrada.'), { status: 404 });
    if (user.role === 'owner' && this.db.prepare("SELECT count(*) AS total FROM users WHERE role='owner' AND disabled=0").get().total <= 1) throw Object.assign(new Error('Mantenha ao menos um responsável ativo.'), { status: 400 });
    this.transaction(() => {
      this.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(userId);
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
      this.db.prepare('DELETE FROM recovery_tokens WHERE user_id=?').run(userId);
      this.audit(actorId, 'account.disabled', userId);
    });
  }
  products() { return this.db.prepare('SELECT data FROM catalog_products ORDER BY id').all().map(row => JSON.parse(row.data)); }
  saveProduct(data, id, userId) {
    const existing = id ? this.db.prepare('SELECT * FROM catalog_products WHERE id=?').get(id) : null;
    if (id && !existing) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
    const product = validateProduct(data, id);
    const slug = existing?.slug || productSlug(product);
    if (!slug) throw Object.assign(new Error('Use um nome que permita criar o endereço do produto.'), { status: 400 });
    const duplicate = this.db.prepare('SELECT id FROM catalog_products WHERE slug=?').get(slug);
    if (!id && duplicate) throw Object.assign(new Error('Já existe um produto com este endereço.'), { status: 409 });
    return this.transaction(() => {
      if (!id) {
        const result = this.db.prepare('INSERT INTO catalog_products(slug,data) VALUES(?,?)').run(slug, '{}');
        product.id = Number(result.lastInsertRowid);
      }
      product.slug = slug;
      this.db.prepare('UPDATE catalog_products SET data=? WHERE id=?').run(JSON.stringify(product), product.id);
      this.audit(userId, id ? 'product.updated' : 'product.created', product.id);
      return product;
    });
  }
  deleteProduct(id, userId) {
    return this.transaction(() => {
      const result = this.db.prepare('DELETE FROM catalog_products WHERE id=?').run(id);
      if (!result.changes) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
      this.audit(userId, 'product.deleted', id);
    });
  }
}
