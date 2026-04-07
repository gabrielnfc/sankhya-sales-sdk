import type { SankhyaClient } from '../../src/client.js';
import type { HttpClient } from '../../src/core/http.js';

/**
 * Extract HttpClient from SankhyaClient for integration tests.
 * This bypasses the private accessor — only for test use.
 */
export function getHttpClient(client: SankhyaClient): HttpClient {
  return (client as unknown as { http: HttpClient }).http;
}
