import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { ServiceResponse } from '../services/types'
import { businessProfileService } from '../services/business-profile.service'

const MACHINE_SKEW_SECONDS = 300

function machineSecret(): string {
  const secret = process.env.DSH_BRIDGE_SECRET
  if (!secret) {
    throw new Error('[machine-auth] DSH_BRIDGE_SECRET is required for machine callbacks')
  }
  return secret
}

function timestampFresh(timestamp: string | undefined): boolean {
  if (!timestamp) return false
  const age = Date.now() / 1000 - Number(timestamp)
  return Number.isFinite(age) && Math.abs(age) <= MACHINE_SKEW_SECONDS
}

/**
 * Verify an HMAC machine callback (Python `app/core/machine.py`).
 * Returns an error message, or null when the request is authentic.
 */
export function verifyMachineRequest(event: H3Event, rawBody: string): string | null {
  const timestamp = getHeader(event, 'x-machine-timestamp')
  const signature = getHeader(event, 'x-machine-signature')
  if (!timestampFresh(timestamp) || !signature) return 'Missing or stale machine signature'
  const expected = createHmac('sha256', machineSecret()).update(`${timestamp}.${rawBody}`).digest('hex')
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return 'Invalid machine signature'
  }
  return null
}

/**
 * Authenticate a machine callback end to end (T130): verify the HMAC, parse
 * the body, and resolve the business owner as the acting user. The shared
 * secret vouches for the deployment; service-layer membership checks still
 * apply to everything downstream.
 */
export async function authenticateMachineRequest(
  event: H3Event,
  rawBody: string,
): Promise<ServiceResponse<{ userId: string, body: Record<string, unknown> }>> {
  const machineError = verifyMachineRequest(event, rawBody)
  if (machineError) {
    return { success: false, error: machineError, code: 'UNAUTHORIZED' }
  }
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(rawBody || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { success: false, error: 'Invalid JSON body', code: 'VALIDATION_ERROR' }
    }
    body = parsed as Record<string, unknown>
  } catch {
    return { success: false, error: 'Invalid JSON body', code: 'VALIDATION_ERROR' }
  }
  const businessId = typeof body.businessId === 'string' ? body.businessId : ''
  if (!businessId) {
    return { success: false, error: 'businessId is required', code: 'VALIDATION_ERROR' }
  }
  const business = await businessProfileService.findByIdOnly(businessId)
  if (!business.success || !business.data) {
    return { success: false, error: 'Business not found', code: 'NOT_FOUND' }
  }
  return { success: true, data: { userId: business.data.userId, body } }
}
