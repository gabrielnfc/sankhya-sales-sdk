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
  /** Provedor externo de cache de token (default: cache em memoria). */
  tokenCacheProvider?: TokenCacheProvider;
  /** Opcoes de logging do SDK. */
  logger?: LoggerOptions;
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
