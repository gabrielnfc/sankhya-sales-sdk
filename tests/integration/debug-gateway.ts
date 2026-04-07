import { readFileSync } from 'node:fs';

function loadEnv() {
  const content = readFileSync('.env', 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    process.env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
  }
}

loadEnv();

async function main() {
  // 1. Auth
  const authUrl = `${process.env.SANKHYA_BASE_URL}/authenticate`;
  const authBody = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SANKHYA_CLIENT_ID ?? '',
    client_secret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  });

  const authResp = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Token': process.env.SANKHYA_X_TOKEN ?? '',
    },
    body: authBody.toString(),
  });
  const authData = await authResp.json();
  const token = authData.access_token;
  console.log('Token:', `${token.slice(0, 20)}...`);

  // 2. Gateway call
  const gwUrl = `${process.env.SANKHYA_BASE_URL}/gateway/v1/mge/service.sbr`;
  const gwPayload = {
    serviceName: 'CRUDServiceProvider.loadRecords',
    requestBody: {
      dataSet: {
        rootEntity: 'Produto',
        includePresentationFields: 'N',
        offsetPage: '0',
        criteria: {
          expression: "this.ATIVO = 'S'",
        },
        entity: {
          fieldset: { list: 'CODPROD,DESCRPROD,CODVOL,ATIVO' },
        },
      },
    },
  };

  console.log('\n--- Gateway Request ---');
  console.log('URL:', gwUrl);
  console.log('Payload:', JSON.stringify(gwPayload, null, 2));

  const gwResp = await fetch(gwUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Token': process.env.SANKHYA_X_TOKEN ?? '',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(gwPayload),
  });

  console.log('\n--- Gateway Response ---');
  console.log('Status:', gwResp.status);
  console.log('Content-Type:', gwResp.headers.get('content-type'));
  const text = await gwResp.text();
  console.log('Body (first 1000 chars):', text.slice(0, 1000));
}

main().catch(console.error);
