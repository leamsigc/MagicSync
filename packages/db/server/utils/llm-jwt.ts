import jwt from 'jsonwebtoken'
import type { UserLlmConfig } from '#layers/BaseDB/db/schema'

// Shared secret - must be set in env and match Python backend
const JWT_SECRET = process.env.NUXT_LLM_JWT_SECRET || 'magicsync-llm-secret-change-me'
const JWT_EXPIRES_IN = '1h' // Short-lived token for API calls

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
  // Encrypt API key if present (simple base64 for now, can be improved)
  const apiKeyEncrypted = config?.apiKey
    ? Buffer.from(config.apiKey).toString('base64')
    : null

  const payload: LlmJwtPayload = {
    userId,
    email,
    provider: config?.provider || 'ollama',
    model: config?.model || 'qwen3.5',
    apiKeyEncrypted,
    apiBaseUrl: config?.apiBaseUrl || null,
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens ?? 2048,
  }

  return jwt.sign(payload, JWT_SECRET, {
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
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'magicsync-nuxt',
      audience: 'magicsync-python',
    }) as LlmJwtPayload
    return decoded
  } catch {
    return null
  }
}
