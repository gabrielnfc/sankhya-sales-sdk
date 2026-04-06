'use strict';

const sdk = require('../../dist/index.cjs');
const { SankhyaClient, ApiError, AuthError, GatewayError, TimeoutError } = sdk;

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    failures++;
  }
}

// Verify exports exist
assert(typeof SankhyaClient === 'function', 'SankhyaClient is not a function');
assert(typeof ApiError === 'function', 'ApiError is not a function');
assert(typeof AuthError === 'function', 'AuthError is not a function');
assert(typeof GatewayError === 'function', 'GatewayError is not a function');
assert(typeof TimeoutError === 'function', 'TimeoutError is not a function');

// Verify instanceof works (class identity preserved across CJS)
const err = new ApiError('test', '/test', 'GET', 400);
assert(err instanceof ApiError, 'instanceof ApiError broken in CJS');
assert(err instanceof Error, 'ApiError does not extend Error in CJS');

// Verify constructor output for SankhyaClient
assert(SankhyaClient.toString().includes('class'), 'SankhyaClient is not a class');

if (failures > 0) {
  console.error(`\n${failures} CJS smoke test(s) failed`);
  process.exit(1);
}

console.log('PASS: CJS smoke test');
