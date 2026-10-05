# Legado Acessórios

Catálogo digital responsivo de acessórios masculinos com identidade azul e prata.

## Executar localmente

Requer Node.js 18 ou superior. Não é necessário instalar dependências.

```sh
npm run dev
```

Abra http://localhost:3000. Também pode executar `node server.mjs` diretamente.

## Recursos

Menu adaptado para celular, banner inicial, categorias, busca, ordenação por preço, favoritos salvos no navegador e detalhes dos produtos em janela acessível.

## Páginas e pesquisa

- `/` abre a página inicial, preservando o banner e a navegação.
- `/catalogo` abre todos os produtos.
- `/categorias/relogios`, `/categorias/pulseiras`, `/categorias/correntes` e `/categorias/aneis` abrem somente os produtos da categoria correspondente.
- A pesquisa utiliza o nome do produto, ignora acentos e diferenças entre maiúsculas e minúsculas. O parâmetro `busca` preserva a pesquisa ao recarregar ou compartilhar o endereço.
- Limpar a pesquisa mantém a categoria atual.
- Busca sem resultados, catálogo vazio, favoritos vazios e categoria desconhecida têm mensagens e ações de recuperação específicas.

O servidor local atende os endereços diretamente. Uma futura hospedagem deve encaminhar as rotas de páginas para `index.html` e servir arquivos `.mjs` como JavaScript.

## Conteúdo inicial

Os oito produtos, preços e ilustrações SVG são demonstrativos. Atualize a lista `products` em `app.js` com o catálogo real. As ilustrações foram criadas para esta interface e não representam fotografias de produtos reais. Não há pagamento, estoque ou pedidos integrados nesta primeira versão.

As fontes Google Fonts são opcionais. A interface utiliza fontes locais alternativas caso não haja conexão.

## Verificação

```sh
npm run check
```

O servidor é destinado à prévia local e escuta apenas no computador em 127.0.0.1.

Confira os resultados de validação em [TESTES.md](TESTES.md).
