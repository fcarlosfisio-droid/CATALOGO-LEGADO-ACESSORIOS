const $ = selector => document.querySelector(selector);
let session = null, products = [], users = [], recoveryToken = '';
function message(text, error = false) { $('#feedback').textContent = text; $('#feedback').classList.toggle('error', error); }
function show(panel) { for (const id of ['login-panel','recovery-panel','reset-panel','dashboard']) { const section=$('#' + id); section.hidden=id!==panel; if(section.hidden) section.querySelectorAll('input[type="password"]').forEach(input=>{input.value='';}); } }
function clearPrivateState() {
  session = null; products = []; users = [];
  $('#admin-products').replaceChildren(); $('#team-list').replaceChildren();
  $('#signed-user').textContent = ''; $('#personal-link-value').value = '';
  $('#personal-link').hidden = true; $('#account-action-form').hidden = true;
  for(const id of ['product-form','invite-form','account-action-form']) $('#' + id).reset();
}
async function request(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session?.csrfToken && method !== 'GET' ? { 'X-CSRF-Token': session.csrfToken } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && session) { clearPrivateState(); show('login-panel'); }
    throw new Error(data.error || 'Não foi possível concluir a operação.');
  }
  return data;
}
function formData(form) { return Object.fromEntries(new FormData(form)); }
function onForm(id, action) {
  $(id).addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try { await action(event.currentTarget); }
    catch (error) { message(error.message, true); }
    finally { button.disabled = false; }
  });
}
function control(text, fn) { const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = text; button.addEventListener('click', fn); return button; }
function clearProductForm() { $('#product-form').reset(); $('#product-form').elements.id.value = ''; $('#product-form-title').textContent = 'Novo produto'; }
async function refreshProducts() {
  products = (await request('/api/products')).products;
  $('#admin-products').replaceChildren();
  if (!products.length) { $('#admin-products').textContent = 'Nenhum produto cadastrado.'; return; }
  for (const product of products) {
    const row = document.createElement('div'); row.className = 'product-row';
    const name = document.createElement('strong'); name.textContent = product.name;
    const details = document.createElement('small'); details.textContent = `${product.category} · ${product.price.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}`;
    const actions = document.createElement('div'); actions.className = 'row-actions';
    actions.append(control('Editar', () => {
      for (const key of ['id','name','category','price','description','variant']) $('#product-form').elements[key].value = product[key] ?? '';
      $('#product-form-title').textContent = 'Editar produto';
      $('#product-form').elements.name.focus();
      $('#product-form').scrollIntoView({ behavior:'smooth', block:'start' });
    }), control('Remover', async () => {
      if (!confirm(`Remover o produto ${product.name}?`)) return;
      try { await request('/api/products/' + product.id, { method:'DELETE' }); clearProductForm(); await refreshProducts(); message('Produto removido.'); }
      catch (error) { message(error.message, true); }
    }));
    row.append(name, details, actions); $('#admin-products').append(row);
  }
}
function showPersonalLink(data) {
  $('#personal-link').hidden = false;
  $('#personal-link-message').textContent = data.message;
  $('#personal-link-value').value = data.setupUrl;
  $('#personal-link').scrollIntoView({ behavior:'smooth', block:'center' });
}
async function refreshUsers() {
  if (session?.user.role !== 'owner') return;
  users = (await request('/api/admin/users')).users;
  $('#team-list').replaceChildren();
  for (const user of users) {
    const row = document.createElement('div'); row.className = 'team-row';
    const name = document.createElement('strong'); name.textContent = user.name;
    const details = document.createElement('small'); details.textContent = `${user.email} · ${user.role === 'owner' ? 'Responsável' : 'Funcionário'} · ${user.disabled ? 'Desativado' : 'Ativo'}${user.recovery_requested_at ? ' · Recuperação solicitada' : ''}`;
    row.append(name, details);
    if (!user.disabled) {
      const actions = document.createElement('div'); actions.className = 'row-actions';
      for (const [action, label] of [['recovery','Gerar recuperação'],['disable','Desativar conta']]) {
        if (user.id === session.user.id) continue;
        actions.append(control(label, () => {
          $('#account-action-form').hidden = false;
          $('#account-action-form').reset();
          $('#account-action-form').elements.userId.value = user.id;
          $('#account-action-form').elements.action.value = action;
          $('#account-action-title').textContent = `${label}: ${user.name}`;
          $('#account-action-form').elements.currentPassword.focus();
        }));
      }
      row.append(actions);
    }
    $('#team-list').append(row);
  }
}
async function enterDashboard(data) {
  session = data;
  show('dashboard');
  $('#signed-user').textContent = `${session.user.name} · ${session.user.email}`;
  $('#team-panel').hidden = session.user.role !== 'owner';
  $('#personal-link').hidden = true;
  $('#personal-link-value').value = '';
  clearProductForm();
  await refreshProducts();
  await refreshUsers();
}
onForm('#login-form', async form => { const data = await request('/api/auth/login', { method:'POST', body:formData(form) }); form.reset(); message(''); await enterDashboard(data); });
onForm('#product-form', async form => {
  const body = formData(form); const id = body.id; delete body.id; body.price = Number(body.price);
  await request('/api/products' + (id ? '/' + id : ''), { method:id ? 'PATCH' : 'POST', body });
  clearProductForm(); await refreshProducts(); message('Produto salvo. A alteração já aparece no catálogo.');
});
onForm('#invite-form', async form => { const data = await request('/api/admin/users', { method:'POST', body:formData(form) }); form.reset(); showPersonalLink(data); await refreshUsers(); message('Convite criado para uma conta individual.'); });
onForm('#account-action-form', async form => {
  const body = formData(form);
  const data = await request(`/api/admin/users/${body.userId}/${body.action}`, { method:'POST', body:{ currentPassword:body.currentPassword } });
  form.reset(); form.hidden = true;
  if (data.setupUrl) showPersonalLink(data);
  message(data.message); await refreshUsers();
});
onForm('#recovery-form', async form => { const data = await request('/api/auth/recovery-request', { method:'POST', body:formData(form) }); form.reset(); message(data.message); });
onForm('#reset-form', async form => {
  const data = formData(form);
  if (data.password !== data.confirmation) throw new Error('As senhas não coincidem.');
  const result = await request('/api/auth/reset-password', { method:'POST', body:{ token:recoveryToken, password:data.password } });
  recoveryToken = ''; form.reset(); session = null; show('login-panel'); message(result.message);
});
$('#logout').addEventListener('click', async () => {
  try { await request('/api/auth/logout', { method:'POST' }); clearPrivateState(); show('login-panel'); message('Sessão encerrada.'); }
  catch (error) { message(error.message, true); }
});
$('#forgot-access').addEventListener('click', () => { show('recovery-panel'); message(''); });
document.querySelectorAll('[data-show-login]').forEach(button => button.addEventListener('click', () => { recoveryToken = ''; show('login-panel'); message(''); }));
$('#cancel-edit').addEventListener('click', clearProductForm);
$('#cancel-account-action').addEventListener('click', () => { $('#account-action-form').reset(); $('#account-action-form').hidden = true; });
$('#copy-personal-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#personal-link-value').value); message('Link pessoal copiado. Entregue somente ao titular.'); }
  catch { $('#personal-link-value').focus(); $('#personal-link-value').select(); message('Copie o link selecionado e entregue somente ao titular.'); }
});
const token = new URLSearchParams(location.hash.slice(1)).get('recuperar');
if (token) {
  recoveryToken = token;
  history.replaceState(null, '', '/admin');
  show('reset-panel');
} else {
  try { await enterDashboard(await request('/api/auth/session')); }
  catch { session = null; show('login-panel'); }
}
