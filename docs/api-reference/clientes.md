# sankhya.clientes

Módulo para gerenciamento de clientes (parceiros) e contatos.

**API Layer:** REST v1
**Base path:** `/v1/parceiros/clientes`

---

## Métodos

### `listar(params?)`

Lista clientes paginados.

```typescript
sankhya.clientes.listar(params?: ListarClientesParams): Promise<PaginatedResult<Cliente>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | `number` | Não (default: 1) | Página (inicia em 1) |
| `dataHoraAlteracao` | `string` | Não | Retorna registros alterados a partir da data (`dd/mm/aaaa hh:mm`) |

**Exemplo:**

```typescript
// Listar primeira página
const resultado = await sankhya.clientes.listar();
console.log(resultado.data);     // Cliente[]
console.log(resultado.hasMore);  // boolean

// Sync incremental
const novos = await sankhya.clientes.listar({
  dataHoraAlteracao: '01/03/2026 00:00',
});
```

**Paginação automática:**

```typescript
for await (const page of sankhya.clientes.listarTodos()) {
  for (const cliente of page.data) {
    console.log(cliente.nome);
  }
}
```

**Endpoint REST:** `GET /v1/parceiros/clientes?page={page}`

---

### `criar(dados)`

Inclui um novo cliente.

```typescript
sankhya.clientes.criar(dados: CriarClienteInput): Promise<{ codigoCliente: number }>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `tipo` | `'PF' \| 'PJ'` | Sim | Tipo de pessoa |
| `cnpjCpf` | `string` | Sim | CNPJ ou CPF (sem formatação) |
| `nome` | `string` | Sim | Nome fantasia (PJ) ou nome (PF) |
| `razao` | `string` | Não | Razão social |
| `ieRg` | `string` | Não | Inscrição Estadual ou RG |
| `email` | `string` | Não | E-mail |
| `telefoneDdd` | `string` | Não | DDD |
| `telefoneNumero` | `string` | Não | Número |
| `limiteCredito` | `number` | Não | Limite de crédito |
| `grupoAutorizacao` | `string` | Não | Grupo de autorização |
| `endereco` | `Endereco` | Sim | Endereço completo |
| `contatos` | `Contato[]` | Não | Lista de contatos |

**Exemplo:**

```typescript
const { codigoCliente } = await sankhya.clientes.criar({
  tipo: 'PJ',
  cnpjCpf: '12345678000199',
  nome: 'Empresa Exemplo',
  razao: 'Empresa Exemplo Ltda',
  email: 'contato@exemplo.com',
  endereco: {
    logradouro: 'Rua Exemplo',
    numero: '100',
    bairro: 'Centro',
    cidade: 'São Paulo',
    codigoIbge: '3550308',
    uf: 'SP',
    cep: '01001000',
  },
});
```

**Endpoint REST:** `POST /v1/parceiros/clientes`
**Erros:** `400` dados inválidos | `409` cadastro já existe

---

### `atualizar(codigoCliente, dados)`

Atualiza um cliente existente.

```typescript
sankhya.clientes.atualizar(
  codigoCliente: number,
  dados: AtualizarClienteInput
): Promise<{ codigoCliente: number }>
```

**Exemplo:**

```typescript
await sankhya.clientes.atualizar(123, {
  email: 'novo@email.com',
  limiteCredito: 100000,
});
```

**Endpoint REST:** `PUT /v1/parceiros/clientes/{codigoCliente}`

> **Nota:** Os campos `tipo` e `cnpjCpf` são opcionais no update.

---

### `incluirContato(codigoCliente, contato)`

Adiciona um contato a um cliente.

```typescript
sankhya.clientes.incluirContato(
  codigoCliente: number,
  contato: Contato
): Promise<{ codigoContato: number; codigoCliente: number }>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nome` | `string` | Sim | Nome do contato |
| `email` | `string` | Não | E-mail |
| `telefoneDdd` | `string` | Não | DDD |
| `telefoneNumero` | `string` | Não | Telefone |
| `logradouro` | `string` | Sim | Logradouro |
| `numero` | `string` | Sim | Número |
| `complemento` | `string` | Não | Complemento |
| `bairro` | `string` | Sim | Bairro |
| `cidade` | `string` | Sim | Cidade |
| `codigoIbge` | `string` | Sim | Código IBGE |
| `uf` | `string` | Sim | UF |
| `cep` | `string` | Sim | CEP |

**Exemplo:**

```typescript
const { codigoContato } = await sankhya.clientes.incluirContato(123, {
  nome: 'João Silva',
  email: 'joao@exemplo.com',
  logradouro: 'Rua Exemplo',
  numero: '100',
  bairro: 'Centro',
  cidade: 'São Paulo',
  codigoIbge: '3550308',
  uf: 'SP',
  cep: '01001000',
});
```

**Endpoint REST:** `POST /v1/parceiros/clientes/{codigoCliente}/contatos`

---

### `atualizarContato(codigoCliente, codigoContato, dados)`

Atualiza um contato existente.

```typescript
sankhya.clientes.atualizarContato(
  codigoCliente: number,
  codigoContato: number,
  dados: Partial<Contato>
): Promise<void>
```

**Exemplo:**

```typescript
await sankhya.clientes.atualizarContato(123, 456, {
  email: 'novo.email@exemplo.com',
});
```

**Endpoint REST:** `PUT /v1/parceiros/clientes/{codigoCliente}/contatos/{codigoContato}`

---

## Links

- [Tipos: Cliente, Endereco, Contato](./tipos.md#clientes)
- [SankhyaClient](./cliente-sdk.md)
