# Acesso administrativo

Esta versão usa Node.js 24 ou superior e SQLite. Cada pessoa tem sua própria conta. O catálogo público continua aberto, e as alterações são autorizadas pelo servidor.

## Primeiro acesso

Na pasta do projeto, execute em um terminal interativo:

```sh
node admin-cli.mjs setup
```

Informe seu e-mail pessoal, nome e senha. A senha deve ter de 15 a 256 caracteres, aparece mascarada no terminal e não é passada por argumentos. O comando só configura o primeiro responsável quando ainda não há um responsável ativo. Não existe senha padrão, conta compartilhada ou cadastro administrativo público.

Depois execute `node server.mjs` e entre em http://localhost:3000/admin. Nenhuma conta real foi criada automaticamente durante a implementação. As contas usadas na conferência existiram apenas em bancos de teste isolados.

## Funcionários

O responsável entra na administração e cria um convite com o nome e o e-mail de cada funcionário. Ele confirma sua própria senha para essa operação. O sistema gera um link pessoal que expira em 30 minutos. O funcionário abre o link e define a própria senha. A aplicação não envia mensagens ou e-mails automaticamente.

Funcionários podem criar, editar e remover produtos. Somente responsáveis podem listar contas, convidar funcionários, emitir recuperação, desativar contas e consultar a auditoria. Cada alteração de produto registra o autor e preserva o endereço original quando o nome muda.

Para criar outro responsável, o administrador do servidor pode usar:

```sh
node admin-cli.mjs create-user --email EMAIL_PESSOAL --name "NOME_DA_PESSOA" --role owner
```

Substitua os campos pelo titular real. A senha é solicitada de forma interativa, com confirmação.

## Sessões e tentativas

- Expiração após 30 minutos sem uso, com limite absoluto de 8 horas.
- Logout exclui a sessão no banco. Copiar o cookie antigo não permite retomar o acesso.
- Desativar uma conta ou emitir recuperação revoga suas sessões.
- Após cinco tentativas de login para uma conta em 15 minutos, a próxima tentativa é bloqueada até terminar a janela. Também há limite de 20 tentativas por endereço de conexão em 15 minutos.
- O banco mantém os bloqueios e as sessões mesmo se o processo reiniciar.
- Confirmações de senha para operações de contas também são limitadas. Recuperação pública e utilização de links têm limites próprios.

Os cookies de produção usam `__Host-`, `Secure`, `HttpOnly` e `SameSite=Strict`. No servidor local HTTP, o cookie continua `HttpOnly` e `SameSite=Strict`, limitado a `/api`. Os identificadores de sessão e recuperação são aleatórios; somente seus hashes ficam no banco.

## Recuperação de funcionário

1. A pessoa abre “Recuperar acesso” e informa o e-mail.
2. O responsável verifica a identidade por um canal já conhecido, sem confiar apenas no e-mail digitado.
3. Em “Contas individuais”, o responsável escolhe “Gerar recuperação” para o titular correto e confirma sua própria senha.
4. Ele entrega o link somente ao titular. O link vale por 30 minutos e por uma única utilização.
5. O titular define a nova senha e faz um novo login. Não há login automático após a recuperação.

A resposta pública é igual para e-mails existentes e inexistentes. Esse modelo é de recuperação assistida; não há um serviço SMTP configurado nem envio automático de links.

## Recuperação do responsável

O administrador do servidor deve confirmar a identidade e executar:

```sh
node admin-cli.mjs recover --email EMAIL_PESSOAL
```

O comando usa o banco local protegido e imprime um link pessoal de uso único. Não publique o link em canais abertos. O token fica no fragmento do endereço, que é retirado pela página após a leitura, e não é incluído no pedido HTTP inicial.

Para listar ou desativar uma conta pelo servidor:

```sh
node admin-cli.mjs list-users
node admin-cli.mjs disable-user --email EMAIL_PESSOAL
```

A aplicação impede a desativação do último responsável ativo. A área web também impede desativar a própria conta.

## Banco e hospedagem

O banco padrão é `data/legado.sqlite`, ignorado pelo Git e inacessível pelo servidor de arquivos. Não coloque o banco na pasta `docs/`. Preserve esse arquivo em armazenamento persistente; para cópias durante uso, adote um backup consistente de SQLite, incluindo o estado do WAL. Dados locais não são enviados ao GitHub.

Esta administração precisa de um servidor Node com armazenamento persistente. GitHub Pages hospeda apenas a vitrine estática de demonstração e não executa os controles administrativos.

Em produção, configure `NODE_ENV=production` e `APP_ORIGIN` com o endereço HTTPS do catálogo, sem caminhos. A aplicação recusa uma origem HTTP de produção e exige que as requisições de alteração tenham essa origem exata. Use HTTPS no serviço de publicação ou no proxy que o antecede. `HOST` e `PORT` controlam a escuta, e `ADMIN_DB_PATH` permite escolher outro arquivo privado para o banco. O limite por endereço usa a conexão direta e não confia em `X-Forwarded-For` enviado pelo cliente; num proxy, planeje a limitação na borda para não tratar toda a equipe como uma única origem de rede.

## Verificação

```sh
npm run check
```

Os 29 testes incluem as regras de acesso, expiração, logout, recuperação, limite de tentativas, concorrência e persistência. Os detalhes da revisão estão em [REVISAO_TECNICA.md](REVISAO_TECNICA.md).
