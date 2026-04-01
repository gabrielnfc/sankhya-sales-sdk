# Visão Geral do Projeto

## O que é o sankhya-sales-sdk?

SDK TypeScript para integração com as **APIs comerciais do Sankhya ERP** (Om v4.34+). Oferece uma interface moderna, tipada e ergonômica para operações de vendas B2B — substituindo a necessidade de lidar diretamente com as peculiaridades das APIs REST v1 e Gateway Services do Sankhya.

## Problema que Resolve

Integrar com o Sankhya ERP diretamente apresenta diversos desafios:

- **Duas camadas de API** com padrões diferentes (REST v1 vs Gateway Services)
- **Paginação inconsistente** entre endpoints (page vs pagina vs offsetPage)
- **Gateway retorna HTTP 200 em erros de negócio** — exige verificação manual do campo `status`
- **Serialização Gateway** com formato proprietário (`{ "$": "valor" }`)
- **Autenticação OAuth 2.0** com gerenciamento manual de token e refresh
- **Endpoints críticos sem REST v1** (confirmação de pedido, tipos de negociação, modelos de nota)
- **Divergência URL/body** em serviços como `CACSP.confirmarNota` / `ServicosNfeSP.confirmarNota`
- **Documentação parcial** — nem todos os serviços Gateway estão documentados oficialmente

O SDK abstrai todas essas complexidades, oferecendo uma API consistente e previsível.

## Público-Alvo

- Desenvolvedores TypeScript/JavaScript que integram com Sankhya ERP
- Times que constroem aplicações de força de vendas B2B
- Projetos que precisam de operações comerciais: pedidos, preços, estoque, clientes

## Escopo

### O que cobre

| Domínio | Endpoints REST v1 | Serviços Gateway |
|---------|-------------------|------------------|
| Autenticação | 1 | — |
| Clientes | 5 | — |
| Vendedores | 2 | — |
| Produtos | 9 | 1 |
| Preços | 4 | — |
| Estoque | 4 | 1 |
| Pedidos de Venda | 4 | 5 |
| Financeiros | 13 | — |
| Cadastros Básicos | 11 | 2 |
| Fiscal | 2 | — |
| Gateway CRUD | — | 3 |
| **Total** | **55** | **12** |

**Total: 67 operações cobertas** (55 REST v1 + 12 Gateway)

### O que NÃO cobre

- Módulos de RH e Folha de Pagamento
- Contabilidade avançada (plano de contas, lançamentos contábeis)
- WMS (Warehouse Management System)
- Produção e PCP
- Compras e Suprimentos
- Relatórios e Dashboards do ERP
- Administração do sistema (permissões, configurações)

## Princípios do SDK

| Princípio | Descrição |
|-----------|-----------|
| **Zero dependencies** | Apenas `fetch` nativo (Node 20+). Sem axios, got, ou node-fetch. |
| **Tipagem completa** | Todos os inputs e outputs com tipos TypeScript rigorosos. Sem `any`. |
| **Agnóstico de framework** | Funciona com NestJS, Express, Next.js, Fastify, ou standalone. |
| **Errors como valores** | Hierarquia de erros tipados. Gateway errors detectados automaticamente. |
| **Paginação normalizada** | Interface consistente independente do padrão do endpoint. |
| **Token management** | Cache automático em memória, mutex no refresh, token cache injetável. |
| **Configuração mínima** | 3 credenciais + base URL = pronto para usar. |

## Requisitos

- **Node.js** >= 20.0.0 (para `fetch` nativo)
- **TypeScript** >= 5.0 (recomendado)
- **Sankhya Om** >= 4.34
- **Credenciais:** `client_id`, `client_secret`, `X-Token`

## Links

- [Arquitetura do SDK](./arquitetura.md)
- [Roadmap de Implementação](./roadmap.md)
- [Guia de Início Rápido](../guia/inicio-rapido.md)
- [API Reference](../api-reference/cliente-sdk.md)
