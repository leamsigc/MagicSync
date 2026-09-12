import { SignJWT, jwtVerify } from 'jose'

export const DSH_CAPABILITY_AUDIENCE = 'magicsync-dsh'
export const DSH_CAPABILITY_TTL_SECONDS = 600
const MAX_TTL_SECONDS = 3600

export interface DshCapabilityClaims {
  sub: string
  businessId: string
  workflowId: string
  runId: string
  allowedTools: string[]
  allowedSkills: string[]
}

function capabilitySecret(): Uint8Array {
  const secret = process.env.DSH_BRIDGE_SECRET
  if (!secret) {
    throw new Error('[dsh-capability] DSH_BRIDGE_SECRET is required to mint capability tokens')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Mint a short-lived scoped DSH capability (PRD-DEEPSEEK-HARNESS §8).
 * Verified Python-side by app/services/dsh/capability.py (same HS256
 * contract, audience, and claim names).
 */
export async function issueDshCapability(
  claims: DshCapabilityClaims,
  ttlSeconds = DSH_CAPABILITY_TTL_SECONDS,
): Promise<string> {
  if (ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error('[dsh-capability] TTL out of range')
  }
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({
    businessId: claims.businessId,
    workflowId: claims.workflowId,
    runId: claims.runId,
    allowedTools: claims.allowedTools,
    allowedSkills: claims.allowedSkills,
    nonce: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setAudience(DSH_CAPABILITY_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(capabilitySecret())
}

export async function verifyDshCapability(token: string): Promise<DshCapabilityClaims & { nonce: string }> {
  const { payload } = await jwtVerify(token, capabilitySecret(), { audience: DSH_CAPABILITY_AUDIENCE })
  return {
    sub: String(payload.sub ?? ''),
    businessId: String(payload.businessId ?? ''),
    workflowId: String(payload.workflowId ?? ''),
    runId: String(payload.runId ?? ''),
    allowedTools: Array.isArray(payload.allowedTools) ? payload.allowedTools.map(String) : [],
    allowedSkills: Array.isArray(payload.allowedSkills) ? payload.allowedSkills.map(String) : [],
    nonce: String(payload.nonce ?? ''),
  }
}
