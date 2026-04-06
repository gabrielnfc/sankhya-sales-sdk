import { SankhyaClient, ApiError, AuthError, GatewayError, TimeoutError } from '../../dist/index.js';

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

// Verify instanceof works (class identity preserved across ESM)
const err = new ApiError('test', '/test', 'GET', 400);
assert(err instanceof ApiError, 'instanceof ApiError broken in ESM');
assert(err instanceof Error, 'ApiError does not extend Error in ESM');

if (failures > 0) {
  console.error(`\n${failures} ESM smoke test(s) failed`);
  process.exit(1);
}

console.log('PASS: ESM smoke test');
