# Exemplos -- sankhya-sales-sdk

Scripts executaveis demonstrando as principais funcionalidades do SDK.

## Pre-requisitos

Configure as variaveis de ambiente:

```bash
export SANKHYA_BASE_URL=https://api.sandbox.sankhya.com.br
export SANKHYA_CLIENT_ID=seu-client-id
export SANKHYA_CLIENT_SECRET=seu-client-secret
export SANKHYA_X_TOKEN=seu-x-token
```

> **Use o sandbox.** Desde a 1.6.0 o `SankhyaClient` tem allowlist de host fail-closed:
> host de sandbox sobe sem flag; host de produção exige `allowProduction: true` e emite
> um `logger.warn`; qualquer outro host precisa constar de `allowedHosts`, senão o
> construtor **aborta**. Todos os scripts desta pasta leem `SANKHYA_BASE_URL` do ambiente
> — aponte-a para o sandbox. Ver
> [SankhyaClient — Guarda de ambiente](../docs/api-reference/cliente-sdk.md#guarda-de-ambiente-allowlist-de-host-fail-closed).

## Executando

```bash
npx tsx examples/01-quick-start.ts
```

## Exemplos

| Arquivo | Descricao |
|---------|-----------|
| 01-quick-start.ts | Configuracao basica e primeira chamada API |
| 02-listar-produtos.ts | Paginacao manual e automatica com listarTodos |
| 03-criar-pedido.ts | Fluxo completo: criar pedido, adicionar item, confirmar |
| 04-error-handling.ts | Tratamento de cada tipo de erro com type guards |
| 05-gateway-generico.ts | CRUD generico via Gateway (loadRecords/saveRecord) |
