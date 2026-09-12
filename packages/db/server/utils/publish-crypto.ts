import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const PREFIX = 'enc:v1:'

function getKey(): Buffer {
  const secret = process.env.NUXT_PUBLISH_SECRET || process.env.NUXT_LLM_JWT_SECRET
  if (!secret) {
    throw new Error('[publish-crypto] NUXT_PUBLISH_SECRET (or NUXT_LLM_JWT_SECRET) is required')
  }
  return scryptSync(secret, 'magicsync-publish', 32)
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const pack = (part: Buffer) => part.toString('base64url')
  return `${PREFIX}${pack(iv)}.${pack(tag)}.${pack(ciphertext)}`
}

const ENCRYPTED_PATTERN = /^enc:v1:([^.]+)\.([^.]+)\.([^.]+)$/

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function decryptSecret(stored: string | null): string | null {
  if (!stored) {
    return null
  }
  // Fail closed: legacy plaintext values are never returned. Callers treat
  // null as "credential must be re-entered" instead of using raw secrets.
  if (!stored.startsWith(PREFIX)) {
    return null
  }
  try {
    const match = ENCRYPTED_PATTERN.exec(stored)
    if (!match) {
      return null
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getKey(),
      Buffer.from(match[1], 'base64url')
    )
    decipher.setAuthTag(Buffer.from(match[2], 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(match[3], 'base64url')),
      decipher.final()
    ])
    return plaintext.toString('utf8')
  } catch {
    return null
  }
}

export function revealSecret(stored: string | null): string | null {
  try {
    return decryptSecret(stored)
  } catch {
    return null
  }
}
