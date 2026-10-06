# Revisão técnica de autenticação administrativa

Realizada em 6 de outubro de 2026. Revisão do código implementado e conferência funcional em bancos isolados; não representa uma auditoria externa nem validação de uma publicação online.

## Resultado da conferência solicitada

| Item | Evidência | Resultado |
| --- | --- | --- |
| Senha incorreta recusada | HTTP 401, mensagem genérica e nenhuma sessão criada; conferido também na interface | Aprovado |
| Sem login não altera produtos | POST, PATCH e DELETE recusados diretamente pela API, com o banco inalterado | Aprovado |
| Logout encerra sessão | Cookie antigo deixa de autorizar leitura de sessão e alteração de produtos, inclusive após recarregar a interface | Aprovado |
| Sessões expiram | Middleware aplica 30 minutos de inatividade e 8 horas absolutas, conferidas com relógio de teste | Aprovado |
| Procedimento de recuperação | Solicitação assistida, emissão restrita ao responsável com senha atual e recuperação do responsável pelo servidor | Aprovado |
| Senhas sem texto simples no banco | Hash scrypt com salt individual; busca no arquivo de teste confirmou ausência da senha e do token de sessão originais | Aprovado |

## Modelo e limites de autorização

Contas individuais, com perfis `owner` e `staff`. Não há senha padrão nem criação pública de contas. O responsável inicial é criado por um comando local interativo, que mascara a senha. Convites deixam a senha indefinida até o próprio titular utilizar o link.

Todas as rotas da API, salvo leitura pública de produtos, login e os dois passos de recuperação, passam pelo controle de sessão. Operações de alteração também exigem origem exata e um token CSRF associado à sessão. Gerenciamento de contas exige perfil responsável e confirmação da senha atual. Não foi usada a ausência de um link no menu como controle de segurança.

## Achados corrigidos durante a revisão

1. **Revogação durante uma requisição em andamento.** Um logout podia acontecer enquanto o corpo de uma alteração chegava ao servidor ou durante a confirmação criptográfica da senha. A sessão agora é verificada novamente após a leitura e após essa confirmação, antes da gravação. Testes cobrem corpo enviado em partes e logout durante emissão de recuperação, confirmando HTTP 401 sem efetuar as alterações.
2. **Concorrência na recuperação.** Duas utilizações simultâneas do mesmo token agora dependem de uma atualização condicional dentro de transação. O teste confirma que somente uma senha é aceita.
3. **HTML em campos administrativos.** Nomes e descrições são escapados na vitrine, e a administração usa `textContent`. Na conferência manual, uma descrição contendo `<b>` apareceu como texto literal, sem criar a marcação.
4. **Exposição de arquivos internos.** O antigo servidor servia arquivos pelo caminho. Foi substituído por uma lista explícita de páginas e assets públicos; banco, CLI, módulos internos, testes e documentos administrativos retornam 404.
5. **Credenciais modificadas durante verificação.** Login e confirmação de senha revalidam a conta após a derivação criptográfica, recusando credenciais alteradas ou contas desativadas nesse intervalo.
6. **Recuperação após bloqueio de conta.** A troca de senha remove o bloqueio por conta, enquanto os limites por conexão continuam aplicados.
7. **Limpeza da interface após logout ou expiração.** Senhas digitadas em formulários, links de recuperação e dados da equipe são removidos da interface ao encerrar o acesso. A proteção das operações continua no servidor.

## Proteções verificadas

- Scrypt com `N=131072`, `r=8`, `p=1`, salt aleatório de 16 bytes e comparação de hash em tempo constante.
- Sessões opacas com 32 bytes aleatórios; banco guarda apenas SHA-256 do identificador.
- Recuperação com 32 bytes aleatórios, armazenada por hash, expiração de 30 minutos, uso único e revogação das sessões do titular.
- Cookies `HttpOnly` e `SameSite=Strict`; na configuração HTTPS, cookie `__Host-` com `Secure` e caminho raiz.
- Sessões, bloqueios e usuários em SQLite, preservados após reinício do processo.
- Limitação por conta e conexão, sem confiar em cabeçalhos de IP enviados por visitantes.
- Consultas parametrizadas, validação de produtos, limite do corpo JSON, CSP, `no-store` nas respostas administrativas e recusa de origem estrangeira.
- Auditoria registra quem criou, alterou ou removeu um produto. Senhas, cookies e tokens de recuperação não são gravados no registro de auditoria.
- Alterações de nome preservam o endereço do produto já cadastrado. A vitrine local carrega o catálogo do banco pela API; a versão estática permanece demonstrativa.

## Testes realizados

**29 testes automatizados aprovados:** 19 de administração/segurança, seis de categorias e quatro de produtos/WhatsApp. Não houve falhas. Os testes de tempo avançam um relógio injetado no banco e verificam a API real, sem alterar a expiração da configuração local.

Conferência manual em banco temporário na porta 3001: senha errada, login válido, cadastro de produto, leitura na vitrine, logout com recarregamento, convite individual, definição de senha e login de funcionário. O funcionário não recebeu os controles de contas. A marcação HTML da descrição permaneceu inerte. O ambiente temporário foi encerrado e não criou contas no banco real.

O assistente de primeiro acesso foi executado em outro banco de teste, com senha mascarada e conta individual criada. O arquivo temporário foi removido. O acesso administrativo local e o catálogo existente foram conferidos; a tela de acesso não apresentou rolagem horizontal em tela menor.

## Condições para uso online

O primeiro responsável real ainda precisa definir suas credenciais com `node admin-cli.mjs setup`. Não foi escolhida uma senha por ele.

Para publicação, são necessários servidor Node 24 ou superior, HTTPS, `APP_ORIGIN` correto e armazenamento persistente do banco. A administração não pode ser publicada no GitHub Pages. Ainda não há hospedagem de backend configurada nesta tarefa nem envio automático de e-mail de recuperação; o procedimento disponível é assistido pelo responsável/administrador do servidor.

## Referências consultadas

- [OWASP: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP: Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP: Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js: SQLite](https://nodejs.org/api/sqlite.html)
