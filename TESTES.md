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

## Detalhes e WhatsApp

- Foram abertos os oito produtos pelos controles da interface. Cada um mostrou seu nome, descrição e preço, com endereço próprio e mensagem correspondente.
- O botão Comprar do Relógio Essencial Azul foi clicado. A página do WhatsApp mostrou **Conversar com +55 83 98685-8298 no WhatsApp** e a mensagem com o nome da peça e o link público. Nenhuma mensagem foi enviada.
- O controle Copiar link apresentou a confirmação “Link copiado”. O campo de compartilhamento contém o mesmo link público usado na mensagem.
- O acesso independente à página estática do Relógio Essencial Azul foi validado em outra aba, pelo servidor local e com o mesmo subdiretório planejado para o GitHub Pages. A peça correta abriu sem passar pela página inicial.
- Em tela de 390 × 640, os detalhes permitiram rolagem, mantiveram o botão Fechar visível e fecharam corretamente. Não houve rolagem horizontal.
- O navegador não apresentou erros durante a conferência dos oito produtos.

Os quatro testes de `product.test.mjs` e os seis testes de categorias passaram: **10 aprovados**. A geração estática de 14 páginas também foi concluída.

### Pendência de hospedagem pública

O link público foi aberto em uma aba separada e o GitHub Pages informou que ainda não existe um site publicado. A conta do navegador não estava conectada ao GitHub para ativar a configuração Pages. O teste público externo permanece pendente até a ativação; o teste local independente não substitui essa validação.
