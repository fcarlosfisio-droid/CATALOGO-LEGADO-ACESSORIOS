# Conferência de categorias e pesquisa

Realizada em 5 de outubro de 2026 na prévia local.

## Testes manuais no navegador

| Categoria | Endereço | Produtos conferidos | Resultado |
| --- | --- | --- | --- |
| Relógios | /categorias/relogios | Relógio Essencial Azul e Relógio Essencial Grafite | Aprovado |
| Pulseiras | /categorias/pulseiras | Pulseira Elo Prata e Pulseira Elo Grafite | Aprovado |
| Correntes | /categorias/correntes | Corrente Clássica e Corrente Urbana | Aprovado |
| Anéis | /categorias/aneis | Anel Signet Prata e Anel Signet Azul | Aprovado |

1. As quatro categorias foram abertas pelos links da interface, e os endereços foram conferidos.
2. Cada página mostrou exatamente dois produtos da categoria correspondente.
3. A pesquisa “Anel Signet Azul” mostrou uma peça e registrou a busca no endereço.
4. A pesquisa “abacaxiinexistente” mostrou zero produtos, explicou o resultado e apresentou o botão “Limpar pesquisa”.
5. O botão do estado vazio limpou o campo e o endereço, manteve a categoria Anéis e restaurou seus dois produtos.
6. O link de início restaurou a página inicial com banner e oito produtos.

Também foram conferidos o recarregamento direto da página Anéis, o layout de Relógios em 390 pixels de largura e a abertura do menu móvel com retorno à página inicial. Não houve rolagem horizontal na categoria em tela menor. A consulta aos registros do navegador após o fluxo principal não apresentou erros.

## Testes automatizados

Os seis testes de `catalog.test.mjs` passaram, cobrindo:

- Correspondência entre endereço, categoria e produtos.
- Pesquisa por nome com acentos, maiúsculas e espaços nas extremidades.
- Palavra inexistente e restauração após limpeza dentro da mesma categoria.
- Catálogo e categoria sem produtos, com mensagens específicas.
- Reabertura de endereço com pesquisa e recuperação de categoria desconhecida.
- Estado inicial, favoritos vazios e ordenação sem modificar os dados de origem.

Os arquivos de aplicação, navegação e servidor também passaram pela verificação de sintaxe.

Todas as categorias demonstrativas possuem produtos. O cenário de categoria sem produtos foi validado nos testes automatizados com uma lista vazia; não foi apresentado como se tivesse sido testado manualmente com o catálogo atual.
