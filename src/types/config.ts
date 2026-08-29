/** Configuracao de conexao com a API Sankhya. */
export interface SankhyaConfig {
  /** URL base da API (ex: `'https://api.sankhya.com.br'`). */
  baseUrl: string;
  /** Client ID do OAuth 2.0. */
  clientId: string;
  /** Client Secret do OAuth 2.0. */
  clientSecret: string;
  /** Token de seguranca adicional exigido pelo Sankhya. */
  xToken: string;
  /** Timeout padrao em milissegundos para requisicoes (default: 30000). */
  timeout?: number;
  /** Numero maximo de tentativas em caso de erro transiente. */
  retries?: number;
  /** Politica de retry da autenticacao OAuth (backoff exponencial + jitter). */
  authRetry?: AuthRetryConfig;
  /** Politica do circuit breaker de autenticacao. */
  circuitBreaker?: CircuitBreakerConfig;
  /** Provedor externo de cache de token (default: cache em memoria). */
  tokenCacheProvider?: TokenCacheProvider;
  /** Opcoes de logging do SDK. */
  logger?: LoggerOptions;
  /**
   * O que fazer quando uma resposta chega degradada.
   *
   * - `'flag'` (default na 1.5.0): marca `degraded` no resultado e emite
   *   `logger.error`. Nao lanca.
   *
   * O default passa a `'throw'` na 2.0.0.
   *
   * Este campo nao tem efeito na 1.5.0 — o SDK nao le seu valor em lugar
   * nenhum, ja que so existe uma politica implementada (`'flag'`). Reservado
   * para a 2.0.0, quando `'throw'` vira uma opcao real.
   */
  onDegradedResponse?: 'flag';
}

/**
 * Politica de retry para a autenticacao OAuth 2.0.
 *
 * Aplica backoff exponencial com jitter APENAS a falhas transientes
 * (timeout, 5xx, 429, erro de rede). Erros de credencial/request
 * (HTTP 400/401/403) falham imediatamente, sem retry, para evitar
 * lockout por retentativa de credencial invalida.
 */
export interface AuthRetryConfig {
  /** Numero maximo de retentativas apos a 1a tentativa (default: 3). */
  maxRetries?: number;
  /** Delay base em ms (default: 500). */
  baseDelayMs?: number;
  /** Fator de crescimento exponencial (default: 2). */
  factor?: number;
  /** Amplitude do jitter como fracao do delay, +-ratio (default: 0.5). */
  jitterRatio?: number;
}

/**
 * Politica do circuit breaker de autenticacao.
 *
 * Apos `threshold` falhas consecutivas de autenticacao, o breaker abre
 * e chamadas subsequentes falham rapido com `CircuitOpenError` (sem
 * contatar o servidor) durante a janela de reabertura.
 */
export interface CircuitBreakerConfig {
  /** Falhas consecutivas para abrir o breaker (default: 3). */
  threshold?: number;
  /** Janela base de reabertura em ms (default: 30000). */
  resetTimeoutMs?: number;
  /** Jitter aditivo na janela como fracao, 0..ratio (default: 0.2). Evita thundering herd. */
  jitterRatio?: number;
}

/**
 * Provedor de cache para tokens OAuth 2.0.
 *
 * Permite armazenar tokens em Redis, banco de dados ou outro
 * mecanismo externo para cenarios multi-processo.
 */
export interface TokenCacheProvider {
  /** Recupera um valor do cache pela chave. */
  get(key: string): Promise<string | null>;
  /** Armazena um valor no cache com TTL em segundos. */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Remove um valor do cache pela chave. */
  del(key: string): Promise<void>;
}

/** Opcoes de configuracao do logger do SDK. */
export interface LoggerOptions {
  /** Nivel minimo de log (default: `'warn'`). */
  level?: LogLevel;
  /** Logger customizado — substitui o logger padrao do SDK. */
  custom?: Logger;
}

/** Niveis de log disponiveis. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** Interface de logger injetavel no SDK. */
export interface Logger {
  /** Loga mensagem de debug (detalhes internos). */
  debug(message: string, ...args: unknown[]): void;
  /** Loga mensagem informativa. */
  info(message: string, ...args: unknown[]): void;
  /** Loga aviso recuperavel. */
  warn(message: string, ...args: unknown[]): void;
  /** Loga erro critico. */
  error(message: string, ...args: unknown[]): void;
}

/** Opcoes extras por requisicao individual. */
export interface RequestOptions {
  /** Timeout especifico para esta requisicao (ms). */
  timeout?: number;
  /** AbortSignal externo para cancelamento. */
  signal?: AbortSignal;
  /** Chave de idempotencia para operacoes de escrita. */
  idempotencyKey?: string;
}
