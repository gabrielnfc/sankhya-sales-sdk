/** Resposta bruta do endpoint OAuth 2.0 do Sankhya. */
export interface AuthResponse {
  /** Token de acesso JWT. */
  access_token: string;
  /** Tempo de vida do token em segundos. */
  expires_in: number;
  /** Tempo de vida do refresh token em segundos. */
  refresh_expires_in: number;
  /** Tipo do token (geralmente `'Bearer'`). */
  token_type: string;
  /** Politica not-before (timestamp Unix). */
  'not-before-policy': number;
  /** Escopos concedidos. */
  scope: string;
}

/** Token processado com data de expiracao calculada. */
export interface TokenData {
  /** Token de acesso JWT. */
  accessToken: string;
  /** Timestamp Unix (ms) de expiracao do token. */
  expiresAt: number;
}
