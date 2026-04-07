# Exemplos -- sankhya-sales-sdk

Scripts executaveis demonstrando as principais funcionalidades do SDK.

## Pre-requisitos

Configure as variaveis de ambiente:

```bash
export SANKHYA_BASE_URL=https://api.sankhya.com.br
export SANKHYA_CLIENT_ID=seu-client-id
export SANKHYA_CLIENT_SECRET=seu-client-secret
export SANKHYA_X_TOKEN=seu-x-token
```

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
