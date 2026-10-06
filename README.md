# Legado Acessórios

Catálogo digital responsivo de acessórios masculinos com identidade azul e prata.

## Executar localmente

Requer Node.js 24 ou superior. Não é necessário instalar dependências.

```sh
npm run dev
```

Abra http://localhost:3000. Também pode executar `node server.mjs` diretamente.

## Recursos

Menu adaptado para celular, banner inicial, categorias, busca, ordenação por preço, favoritos salvos no navegador e detalhes dos produtos em janela acessível.

## Administração protegida

Abra `/admin`. Configure a primeira conta pessoal com `node admin-cli.mjs setup`, em um terminal interativo. Não há senha padrão. O responsável convida cada funcionário por uma conta individual, com senha definida pelo próprio titular.

Produtos locais agora são persistidos em SQLite e alterados por uma API que exige sessão, origem válida e CSRF. Sessões expiram após 30 minutos sem uso, com limite de 8 horas, e são revogadas no logout. Há bloqueio de tentativas e recuperação por links de uso único com confirmação de identidade pelo responsável.

Confira [ACESSO_ADMINISTRATIVO.md](ACESSO_ADMINISTRATIVO.md) para configurar contas e recuperar acesso, e [REVISAO_TECNICA.md](REVISAO_TECNICA.md) para a conferência de segurança. O backend precisa de hospedagem Node e banco persistente; GitHub Pages só atende a vitrine estática.

## Páginas e pesquisa

- `/` abre a página inicial, preservando o banner e a navegação.
- `/catalogo` abre todos os produtos.
- `/categorias/relogios`, `/categorias/pulseiras`, `/categorias/correntes` e `/categorias/aneis` abrem somente os produtos da categoria correspondente.
- A pesquisa utiliza o nome do produto, ignora acentos e diferenças entre maiúsculas e minúsculas. O parâmetro `busca` preserva a pesquisa ao recarregar ou compartilhar o endereço.
- Limpar a pesquisa mantém a categoria atual.
- Busca sem resultados, catálogo vazio, favoritos vazios e categoria desconhecida têm mensagens e ações de recuperação específicas.

O servidor local atende os endereços diretamente. Uma futura hospedagem deve encaminhar as rotas de páginas para `index.html` e servir arquivos `.mjs` como JavaScript.

## Conteúdo inicial

Os oito produtos, preços e ilustrações SVG são demonstrativos. No servidor, use a administração para alterar o catálogo persistido. A lista de `products.mjs` serve à primeira carga do banco e à geração da vitrine estática; alterá-la não substitui os dados já cadastrados no banco. As ilustrações foram criadas para esta interface e não representam fotografias de produtos reais. O botão Comprar abre o WhatsApp para atendimento; não há pagamento ou estoque integrado.

## Produtos e compra pelo WhatsApp

Cada produto abre em `/produtos/nome-do-produto/`, inclusive por acesso direto e recarregamento. Os detalhes apresentam descrição, preço ilustrativo, favoritos, botão Comprar e cópia do link público. Fechar os detalhes retorna ao endereço anterior ou à categoria do produto quando aberto diretamente.

O destino é `5583986858298`, correspondente a +55 83 98685-8298. O link `wa.me` prepara uma mensagem com o nome e o endereço público do produto. A aplicação não envia mensagens nem usa uma API de envio do WhatsApp.

## Publicação no GitHub Pages

Endereço público previsto: https://fcarlosfisio-droid.github.io/CATALOGO-LEGADO-ACESSORIOS/

Execute `npm run build` para atualizar `docs/` após alterações. São geradas páginas estáticas para início, catálogo, quatro categorias e oito produtos. Os links e caminhos dos arquivos são adaptados ao subdiretório do repositório, permitindo abrir produtos diretamente em outro navegador.

Para ativar, entre nas configurações do repositório em **Settings > Pages**, selecione **Deploy from a branch**, branch **main**, pasta **/docs**, e salve. A geração dos arquivos não ativa a hospedagem. Até essa configuração ser concluída, o endereço público não estará disponível.

O domínio e o número estão centralizados em `site-config.mjs`. Ao adotar outro domínio, atualize `PUBLIC_BASE_URL`, gere novamente `docs/` e confira os links de compra.

As fontes Google Fonts são opcionais. A interface utiliza fontes locais alternativas caso não haja conexão.

## Verificação

```sh
npm run check
```

O servidor é destinado à prévia local e escuta apenas no computador em 127.0.0.1.

Confira os resultados de validação em [TESTES.md](TESTES.md).
