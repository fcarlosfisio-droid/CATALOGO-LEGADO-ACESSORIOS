import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AdminStore, digest, hashPassword, verifyPassword } from './admin-store.mjs';
import { createApplication } from './app-server.mjs';

const PASSWORD = 'Senha de teste pessoal 2026!';
const NEW_PASSWORD = 'Uma nova senha pessoal segura 2026!';
const SAMPLE = { name:'Pulseira de teste', category:'Pulseiras', price:85.5, description:'Registro isolado de teste.', variant:'silver' };

async function fixture(t, { secure = false } = {}) {
  let now = 1800000000000, origin;
  const store = new AdminStore({ filename:':memory:', clock:() => now });
  await store.dummyHash;
  const ownerId = await store.createUser({ email:'responsavel@example.test', name:'Responsável de teste', role:'owner', password:PASSWORD });
  const staffId = await store.createUser({ email:'funcionario@example.test', name:'Funcionário de teste', role:'staff', password:PASSWORD });
  const server = http.createServer(createApplication({ store, origin:() => origin, secureCookies:secure }));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  async function call(url, { method='GET', body, auth, csrf=true, originHeader=origin } = {}) {
    const headers = { ...(method !== 'GET' ? { Origin:originHeader } : {}), ...(body !== undefined ? { 'Content-Type':'application/json' } : {}), ...(auth ? { Cookie:auth.cookie } : {}), ...(auth && csrf ? { 'X-CSRF-Token':auth.csrfToken } : {}) };
    const response = await fetch(origin + url, { method, headers, ...(body !== undefined ? { body:JSON.stringify(body) } : {}) });
    const text = await response.text();
    let data; try { data=JSON.parse(text); } catch { data=text; }
    return { status:response.status, headers:response.headers, data };
  }
  async function login(email='responsavel@example.test', password=PASSWORD) {
    const response = await call('/api/auth/login', { method:'POST', body:{ email,password } });
    assert.equal(response.status,200);
    return { ...response.data, cookie:response.headers.get('set-cookie').split(';')[0], headers:response.headers };
  }
  return { store, call, login, ownerId, staffId, origin, server, advance:ms => { now+=ms; } };
}

test('senhas usam scrypt com salts diferentes, sem texto simples', async () => {
  const first = await hashPassword(PASSWORD), second = await hashPassword(PASSWORD);
  assert.match(first,/^scrypt\$131072\$8\$1\$/);
  assert.notEqual(first,second);
  assert.ok(!first.includes(PASSWORD));
  assert.equal(await verifyPassword(PASSWORD,first),true);
  assert.equal(await verifyPassword('Senha incorreta',first),false);
});

test('senha incorreta e conta inexistente são recusadas sem criar sessão', async t => {
  const f=await fixture(t);
  const wrong=await f.call('/api/auth/login',{method:'POST',body:{email:'responsavel@example.test',password:'Senha errada'}});
  const missing=await f.call('/api/auth/login',{method:'POST',body:{email:'ausente@example.test',password:PASSWORD}});
  assert.equal(wrong.status,401); assert.equal(missing.status,401);
  assert.equal(wrong.data.error,missing.data.error);
  assert.equal(f.store.db.prepare('SELECT count(*) AS total FROM sessions').get().total,0);
});

test('todas as alterações de produtos e de contas exigem login no servidor', async t => {
  const f=await fixture(t), before=f.store.products();
  for (const [url,method,body] of [['/api/products','POST',SAMPLE],['/api/products/1','PATCH',SAMPLE],['/api/products/1','DELETE'],['/api/admin/users','POST',{email:'novo@example.test',name:'Novo'}],['/api/admin/users/2/recovery','POST',{}],['/api/admin/users/2/disable','POST',{}]]) {
    assert.equal((await f.call(url,{method,body})).status,401);
  }
  assert.deepEqual(f.store.products(),before);
  assert.equal((await f.call('/api/admin/users')).status,401);
  assert.equal((await f.call('/api/products')).status,200);
});

test('sessão usa cookie HttpOnly SameSite e token opaco armazenado somente por hash', async t => {
  const f=await fixture(t,{secure:true}), auth=await f.login();
  const cookie=auth.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Strict/); assert.match(cookie,/Secure/);
  assert.match(cookie,/^__Host-legado_session=/); assert.match(cookie,/Path=\//);
  const token=auth.cookie.split('=')[1], row=f.store.db.prepare('SELECT token_hash FROM sessions').get();
  assert.equal(row.token_hash,digest(token)); assert.notEqual(row.token_hash,token);
  const session=await f.call('/api/auth/session',{auth});
  assert.equal(session.status,200); assert.equal(session.data.user.email,'responsavel@example.test');
  assert.equal(session.data.csrfToken,auth.csrfToken);
});

test('origem estrangeira e ausência de CSRF bloqueiam alteração mesmo com cookie válido', async t => {
  const f=await fixture(t), auth=await f.login();
  assert.equal((await f.call('/api/products',{method:'POST',body:SAMPLE,auth,csrf:false})).status,403);
  assert.equal((await f.call('/api/products',{method:'POST',body:SAMPLE,auth,originHeader:'https://outro.example'})).status,403);
  assert.equal(f.store.products().length,8);
});

test('funcionário pode gerir produtos, mas não contas, e alterações têm autoria', async t => {
  const f=await fixture(t), auth=await f.login('funcionario@example.test');
  assert.equal((await f.call('/api/admin/users',{auth})).status,403);
  const created=await f.call('/api/products',{method:'POST',body:SAMPLE,auth});
  assert.equal(created.status,201); const id=created.data.product.id, slug=created.data.product.slug;
  const edited=await f.call('/api/products/'+id,{method:'PATCH',body:{...SAMPLE,name:'Nome alterado',price:90},auth});
  assert.equal(edited.status,200); assert.equal(edited.data.product.slug,slug);
  assert.equal(f.store.db.prepare("SELECT user_id FROM audit WHERE action='product.updated' AND resource_id=?").get(String(id)).user_id,f.staffId);
  assert.equal((await f.call('/api/products/'+id,{method:'DELETE',auth})).status,200);
  assert.equal(f.store.products().length,8);
});

test('logout revoga a sessão e replay do cookie não autoriza novas operações', async t => {
  const f=await fixture(t), auth=await f.login();
  assert.equal((await f.call('/api/auth/logout',{method:'POST',auth})).status,200);
  assert.equal((await f.call('/api/products',{method:'POST',body:SAMPLE,auth})).status,401);
  assert.equal((await f.call('/api/auth/session',{auth})).status,401);
});

test('expiração por inatividade e limite absoluto são aplicados no servidor', async t => {
  const f=await fixture(t);
  let auth=await f.login(); f.advance(30*60000+1);
  assert.equal((await f.call('/api/products',{method:'POST',body:SAMPLE,auth})).status,401);
  auth=await f.login();
  for(let i=0;i<16;i++){f.advance(29*60000); assert.equal((await f.call('/api/auth/session',{auth})).status,200);}
  f.advance(17*60000);
  assert.equal((await f.call('/api/auth/session',{auth})).status,401);
});

test('tentativas são limitadas por conta e por endereço, com Retry-After', async t => {
  const f=await fixture(t);
  for(let i=0;i<5;i++) assert.equal((await f.call('/api/auth/login',{method:'POST',body:{email:'responsavel@example.test',password:'errada'}})).status,401);
  const blocked=await f.call('/api/auth/login',{method:'POST',body:{email:'responsavel@example.test',password:PASSWORD}});
  assert.equal(blocked.status,429); assert.ok(Number(blocked.headers.get('retry-after'))>0);
  f.advance(15*60000+1); assert.ok(await f.login());
  assert.equal(f.store.throttle(['another-ip'],1,60000),0); assert.ok(f.store.throttle(['another-ip'],1,60000)>0);
});

test('recuperação não revela contas nem entrega tokens publicamente', async t => {
  const f=await fixture(t);
  const existing=await f.call('/api/auth/recovery-request',{method:'POST',body:{email:'funcionario@example.test'}});
  const missing=await f.call('/api/auth/recovery-request',{method:'POST',body:{email:'ausente@example.test'}});
  assert.deepEqual(existing.data,missing.data); assert.equal(existing.status,200);
  assert.equal(f.store.db.prepare('SELECT count(*) AS total FROM recovery_tokens').get().total,0);
  assert.ok(f.store.userByEmail('funcionario@example.test').recovery_requested_at);
});

test('recuperação exige responsável e confirmação de senha; token é único e revoga sessões', async t => {
  const f=await fixture(t), owner=await f.login(), staff=await f.login('funcionario@example.test');
  const url=`/api/admin/users/${f.staffId}/recovery`;
  assert.equal((await f.call(url,{method:'POST',body:{currentPassword:'incorreta'},auth:owner})).status,403);
  assert.equal((await f.call(url,{method:'POST',body:{currentPassword:PASSWORD},auth:staff})).status,403);
  const recovery=await f.call(url,{method:'POST',body:{currentPassword:PASSWORD},auth:owner});
  assert.equal(recovery.status,200);
  const token=new URL(recovery.data.setupUrl).hash.slice('#recuperar='.length);
  assert.equal(f.store.db.prepare('SELECT token_hash FROM recovery_tokens').get().token_hash,digest(token));
  assert.equal((await f.call('/api/auth/session',{auth:staff})).status,401);
  const reset=await f.call('/api/auth/reset-password',{method:'POST',body:{token,password:NEW_PASSWORD}});
  assert.equal(reset.status,200);
  assert.equal((await f.call('/api/auth/reset-password',{method:'POST',body:{token,password:PASSWORD}})).status,400);
  assert.ok(await f.login('funcionario@example.test',NEW_PASSWORD));
  assert.equal((await f.call('/api/auth/login',{method:'POST',body:{email:'funcionario@example.test',password:PASSWORD}})).status,401);
  assert.ok(!f.store.userByEmail('funcionario@example.test').password_hash.includes(NEW_PASSWORD));
});

test('links de recuperação expiram e novo convite substitui o anterior', async t => {
  const f=await fixture(t);
  const first=f.store.issueRecovery(f.staffId), second=f.store.issueRecovery(f.staffId);
  assert.equal(await f.store.recover(first,NEW_PASSWORD),false);
  f.advance(30*60000+1);
  assert.equal(await f.store.recover(second,NEW_PASSWORD),false);
});

test('convite cria conta individual sem senha padrão; desativação revoga acesso', async t => {
  const f=await fixture(t), owner=await f.login();
  const invited=await f.call('/api/admin/users',{method:'POST',body:{email:'convite@example.test',name:'Pessoa convidada',currentPassword:PASSWORD},auth:owner});
  assert.equal(invited.status,201);
  assert.equal(f.store.userByEmail('convite@example.test').password_hash,null);
  const token=new URL(invited.data.setupUrl).hash.slice('#recuperar='.length);
  assert.equal((await f.call('/api/auth/reset-password',{method:'POST',body:{token,password:PASSWORD}})).status,200);
  const auth=await f.login('convite@example.test'), id=auth.user.id;
  assert.equal((await f.call(`/api/admin/users/${id}/disable`,{method:'POST',body:{currentPassword:PASSWORD},auth:owner})).status,200);
  assert.equal((await f.call('/api/auth/session',{auth})).status,401);
  assert.equal((await f.call('/api/auth/login',{method:'POST',body:{email:'convite@example.test',password:PASSWORD}})).status,401);
});

test('banco e módulos internos não são servidos como arquivos públicos', async t => {
  const f=await fixture(t);
  for(const url of ['/data/legado.sqlite','/admin-store.mjs','/admin-cli.mjs','/app-server.mjs','/.gitignore','/README.md','/catalog.test.mjs','/docs/../admin-store.mjs']) assert.equal((await f.call(url)).status,404);
  const page=await f.call('/admin'); assert.equal(page.status,200);
  assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  assert.equal(page.headers.get('cache-control'),'no-store');
  assert.equal((await f.call('/api/auth/session')).headers.get('cache-control'),'no-store');
});

test('validação rejeita papéis, preços inválidos e senha curta sem gravar dados', async t => {
  const f=await fixture(t), owner=await f.login();
  assert.equal((await f.call('/api/products',{method:'POST',body:{...SAMPLE,price:-1},auth:owner})).status,400);
  const token=f.store.issueRecovery(f.staffId);
  assert.equal((await f.call('/api/auth/reset-password',{method:'POST',body:{token,password:'curta'}})).status,400);
  assert.equal(await f.store.recover(token,NEW_PASSWORD),true);
  await assert.rejects(f.store.createUser({email:'errado@example.test',name:'Nome',role:'superuser',password:PASSWORD}),/perfil inválido/);
});

test('logout durante recebimento de uma alteração revoga também a requisição em andamento', async t => {
  const f=await fixture(t), auth=await f.login();
  const body=JSON.stringify(SAMPLE);
  let request;
  const received=new Promise(resolve => f.server.once('request', resolve));
  const completed=new Promise((resolve,reject) => {
    request=http.request(f.origin+'/api/products',{method:'POST',headers:{Origin:f.origin,Cookie:auth.cookie,'X-CSRF-Token':auth.csrfToken,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}}, response => {
      response.resume(); response.on('end',()=>resolve(response.statusCode));
    });
    request.on('error',reject);
  });
  request.write(body.slice(0,20));
  await received;
  assert.equal((await f.call('/api/auth/logout',{method:'POST',auth})).status,200);
  request.end(body.slice(20));
  assert.equal(await completed,401);
  assert.equal(f.store.products().length,8);
});

test('duas utilizações simultâneas do mesmo link aceitam somente uma troca de senha', async t => {
  const f=await fixture(t), token=f.store.issueRecovery(f.staffId);
  const results=await Promise.all([f.store.recover(token,NEW_PASSWORD), f.store.recover(token,'Outra senha pessoal segura 2026!')]);
  assert.equal(results.filter(Boolean).length,1);
});

test('logout durante confirmação de senha impede a emissão de recuperação administrativa', async t => {
  const f=await fixture(t), owner=await f.login(), staff=await f.login('funcionario@example.test');
  const received=new Promise(resolve=>f.server.once('request',resolve));
  const recovering=f.call(`/api/admin/users/${f.staffId}/recovery`,{method:'POST',body:{currentPassword:PASSWORD},auth:owner});
  await received;
  assert.equal((await f.call('/api/auth/logout',{method:'POST',auth:owner})).status,200);
  assert.equal((await recovering).status,401);
  assert.equal((await f.call('/api/auth/session',{auth:staff})).status,200);
  assert.equal(f.store.db.prepare('SELECT count(*) AS total FROM recovery_tokens').get().total,0);
});

test('sessões e bloqueios persistem após reinício, sem credenciais em texto simples no arquivo', async () => {
  const directory=fileURLToPath(new URL('../../work/',import.meta.url));
  await mkdir(directory,{recursive:true});
  const filename=directory+'auth-persistence-'+randomUUID()+'.sqlite';
  let now=1800000000000, store;
  try {
    store=new AdminStore({filename,clock:()=>now}); await store.dummyHash;
    const id=await store.createUser({email:'persistencia@example.test',name:'Teste de persistência',role:'owner',password:PASSWORD});
    const token=store.session(id);
    assert.equal(store.throttle(['persistent-key'],1,60000),0);
    store.close(); store=null;
    const bytes=await readFile(filename);
    assert.equal(bytes.includes(Buffer.from(PASSWORD)),false);
    assert.equal(bytes.includes(Buffer.from(token)),false);
    store=new AdminStore({filename,clock:()=>now}); await store.dummyHash;
    assert.ok(store.resolveSession(token));
    assert.ok(store.throttle(['persistent-key'],1,60000)>0);
    now+=30*60000+1;
    assert.equal(store.resolveSession(token),null);
  } finally {
    if(store) store.close();
    for(const suffix of ['','-wal','-shm']) { try { await unlink(filename+suffix); } catch(error) { if(error.code!=='ENOENT') throw error; } }
  }
});
