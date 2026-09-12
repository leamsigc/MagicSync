import jwt from 'jsonwebtoken'
import type { UserLlmConfig } from '#layers/BaseDB/db/schema'
import { encryptSecret, isEncryptedSecret } from './publish-crypto'

const JWT_EXPIRES_IN = '1h' // Short-lived token for API calls

// SECURITY: no hard-coded fallback secret. If the env var is missing, fail
// loudly instead of silently signing tokens with a publicly-known constant.
function getJwtSecret(): string {
  const secret = process.env.NUXT_LLM_JWT_SECRET
  if (!secret) {
    throw new Error('[llm-jwt] NUXT_LLM_JWT_SECRET is required — refusing to use an insecure fallback secret')
  }
  return secret
}

export interface LlmJwtPayload {
  userId: string
  email: string
  provider: string
  model: string
  apiKeyEncrypted: string | null
  apiBaseUrl: string | null
  temperature: number
  maxTokens: number
}

/**
 * Create a JWT token containing user's LLM config.
 * Used for secure service-to-service communication with Python backend.
 */
export function createLlmJwt(
  userId: string,
  email: string,
  config: UserLlmConfig | null,
): string {
  // Transport the API key as AES-256-GCM (same envelope as publish-crypto).
  // The Python backend decrypts it with the shared publish/JWT secret.
  // Values already in encrypted form are passed through, never double-wrapped.
  const candidate = config?.apiKey
  const rawKey = candidate && candidate.trim() ? candidate : null
  const apiKeyEncrypted = !rawKey
    ? null
    : isEncryptedSecret(rawKey) ? rawKey : encryptSecret(rawKey)

  const payload: LlmJwtPayload = {
    userId,
    email,
    provider: config?.provider || 'google',
    model: config?.model || 'gemini-3-flash-preview',
    apiKeyEncrypted,
    apiBaseUrl: config?.apiBaseUrl || null,
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens ?? 2048,
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'magicsync-nuxt',
    audience: 'magicsync-python',
  })
}

/**
 * Verify and decode a JWT token.
 * Used internally for validation.
 */
export function verifyLlmJwt(token: string): LlmJwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'magicsync-nuxt',
      audience: 'magicsync-python',
    }) as LlmJwtPayload
    return decoded
  } catch {
    return null
  }
}
