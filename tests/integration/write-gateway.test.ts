import { describe, it, expect, beforeAll } from 'vitest';
import { SankhyaClient } from '../../src/client.js';

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!has)('Gateway CRUD — Sandbox Validation', () => {
  let sankhya: SankhyaClient;
  let savedCodparc: string;

  beforeAll(async () => {
    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();
  }, 60_000);

  it.sequential('gateway.saveRecord() -- INSERT new Parceiro', async () => {
    const uniqueCnpj = '99' + String(Date.now()).slice(-12);

    const result = await sankhya.gateway.saveRecord({
      entity: 'Parceiro',
      fields: 'CODPARC,NOMEPARC,TIPPESSOA,CGC_CPF,ATIVO,CLIENTE',
      data: {
        NOMEPARC: 'SDK Test Partner ' + Date.now(),
        TIPPESSOA: 'J',
        CGC_CPF: uniqueCnpj,
        ATIVO: 'S',
        CLIENTE: 'S',
      },
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.CODPARC).toBeDefined();
    savedCodparc = result.CODPARC!;
    console.log(`Saved Parceiro CODPARC=${savedCodparc}, CNPJ=${uniqueCnpj}`);
  }, 60_000);

  it.sequential('gateway.loadRecord() -- retrieve created Parceiro', async () => {
    expect(savedCodparc).toBeDefined();

    const result = await sankhya.gateway.loadRecord({
      entity: 'Parceiro',
      fields: 'CODPARC,NOMEPARC,TIPPESSOA',
      primaryKey: { CODPARC: savedCodparc },
    });

    expect(result).not.toBeNull();
    expect(result!.NOMEPARC).toContain('SDK Test Partner');
    expect(result!.TIPPESSOA).toBe('J');
    console.log(`Loaded Parceiro: CODPARC=${result!.CODPARC}, NOME=${result!.NOMEPARC}`);
  }, 60_000);

  it.sequential('gateway.loadRecord() -- not found returns null', async () => {
    const result = await sankhya.gateway.loadRecord({
      entity: 'Parceiro',
      fields: 'CODPARC,NOMEPARC',
      primaryKey: { CODPARC: '999999999' },
    });

    expect(result).toBeNull();
    console.log('loadRecord for non-existent CODPARC=999999999 returned null');
  }, 60_000);

  it.sequential('gateway.saveRecord() -- UPDATE existing Parceiro', async () => {
    expect(savedCodparc).toBeDefined();

    const updatedName = 'SDK Test Updated ' + Date.now();
    const result = await sankhya.gateway.saveRecord({
      entity: 'Parceiro',
      fields: 'CODPARC,NOMEPARC',
      data: {
        CODPARC: savedCodparc,
        NOMEPARC: updatedName,
      },
    });

    expect(result).toBeDefined();
    expect(result.CODPARC).toBe(savedCodparc);
    console.log(`Updated Parceiro CODPARC=${savedCodparc}, new name=${updatedName}`);

    // Verify the update by loading the record again
    const loaded = await sankhya.gateway.loadRecord({
      entity: 'Parceiro',
      fields: 'CODPARC,NOMEPARC',
      primaryKey: { CODPARC: savedCodparc },
    });

    expect(loaded).not.toBeNull();
    expect(loaded!.NOMEPARC).toBe(updatedName);
    console.log(`Verified update: NOMEPARC=${loaded!.NOMEPARC}`);
  }, 60_000);
});
