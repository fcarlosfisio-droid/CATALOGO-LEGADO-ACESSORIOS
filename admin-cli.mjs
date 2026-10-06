import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdminStore, normalizeEmail } from './admin-store.mjs';
import { createInterface } from 'node:readline/promises';

const root = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
function readSecret(prompt) {
  if (!process.stdin.isTTY) throw new Error('Use um terminal interativo. Não passe a senha como argumento nem por arquivo.');
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let value = '';
    const finish = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', input); process.stdout.write('\n'); };
    const input = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') { finish(); reject(new Error('Operação cancelada.')); return; }
        if (character === '\r' || character === '\n') { finish(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') { if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); } }
        else if (character >= ' ' && value.length < 256) { value += character; process.stdout.write('*'); }
      }
    };
    process.stdin.on('data', input);
  });
}

let store;
try {
  if (!['setup', 'create-user', 'recover', 'list-users', 'disable-user'].includes(args[0])) throw new Error('Comandos: setup; create-user --email EMAIL --name NOME --role owner|staff; recover --email EMAIL; list-users; disable-user --email EMAIL.');
  store = new AdminStore({ filename: process.env.ADMIN_DB_PATH || path.join(root, 'data/legado.sqlite') });
  if (args[0] === 'setup') {
    if (!process.stdin.isTTY) throw new Error('Abra este comando em um terminal interativo.');
    if (store.users().some(user => user.role === 'owner' && !user.disabled)) throw new Error('O responsável já foi configurado. Use os comandos de contas individuais.');
    const terminal = createInterface({ input:process.stdin, output:process.stdout });
    let email, name;
    try { email = normalizeEmail(await terminal.question('Seu e-mail pessoal: ')); name = await terminal.question('Seu nome: '); }
    finally { terminal.close(); }
    const password = await readSecret('Sua senha pessoal (mínimo 15 caracteres): ');
    const confirmation = await readSecret('Confirme a senha: ');
    if (password !== confirmation) throw new Error('As senhas não coincidem.');
    await store.createUser({ email, name, role:'owner', password });
    console.log('Conta responsável criada. Entre em /admin com seu e-mail e senha.');
  }
  else if (args[0] === 'list-users') {
    for (const user of store.users()) console.log(`${user.id} | ${user.email} | ${user.name} | ${user.role} | ${user.disabled ? 'desativado' : 'ativo'}`);
  } else {
    const email = normalizeEmail(option('email'));
    if (args[0] === 'create-user') {
      const password = await readSecret('Senha pessoal (mínimo 15 caracteres): ');
      const confirmation = await readSecret('Confirme a senha: ');
      if (password !== confirmation) throw new Error('As senhas não coincidem.');
      const id = await store.createUser({ email, name: option('name'), role: option('role') || 'staff', password });
      console.log(`Conta individual criada: ${email} (ID ${id}).`);
    } else {
      const user = store.userByEmail(email);
      if (!user) throw new Error('Conta não encontrada.');
      if (args[0] === 'disable-user') { store.disableUser(user.id, -1); console.log('Conta desativada e sessões revogadas.'); }
      else {
        const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
        const token = store.issueRecovery(user.id);
        console.log('Após confirmar a identidade, entregue este link somente ao titular. Válido por 30 minutos e uma única utilização:');
        console.log(origin + '/admin#recuperar=' + token);
      }
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { if (store) { await store.dummyHash; store.close(); } }
