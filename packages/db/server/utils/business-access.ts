import type { H3Event } from 'h3'
import { createError } from 'h3'
import type { ServiceResponse } from '../services/types'
import {
  businessAccessService,
  type BusinessAccess,
  type BusinessRole,
} from '../services/business-access.service'

export type { BusinessAccess, BusinessRole }

/**
 * Single reusable business authorization gate.
 *
 * Resolves owner-or-member access and the owner ID used to scope shared rows,
 * so organization members share one corpus/playbook instead of fragmenting
 * per-user copies. The resolved access is memoized on the request event, so a
 * handler that checks several surfaces pays for the lookup once.
 *
 * Never throws — returns a ServiceResponse.
 */
export async function requireBusinessAccess(
  event: H3Event,
  userId: string,
  businessId: string,
): Promise<ServiceResponse<BusinessAccess>> {
  return businessAccessService.resolve(userId, businessId, event)
}

/**
 * Owner-only variant of `requireBusinessAccess`.
 *
 * Use for surfaces that change the business itself: profile/details, safe mode,
 * social connections, team membership, API keys, and playbook/corpus writes.
 */
export async function requireBusinessOwner(
  event: H3Event,
  userId: string,
  businessId: string,
): Promise<ServiceResponse<BusinessAccess>> {
  const access = await requireBusinessAccess(event, userId, businessId)
  if (!access.success || !access.data) return access

  if (access.data.role !== 'owner') {
    return {
      success: false,
      error: 'Only the business owner can perform this action',
      code: 'FORBIDDEN',
    }
  }

  return access
}

export function accessErrorStatus(code?: string): number {
  return code === 'FORBIDDEN' ? 403 : 404
}

/**
 * Route helper: resolve owner access or throw the matching HTTP error.
 * Keeps write routes to a single line instead of repeating the status mapping.
 */
export async function assertBusinessOwner(
  event: H3Event,
  userId: string,
  businessId: string,
): Promise<BusinessAccess> {
  const access = await requireBusinessOwner(event, userId, businessId)
  if (!access.success || !access.data) {
    throw createError({
      statusCode: accessErrorStatus(access.code),
      statusMessage: access.error ?? 'Business not found',
    })
  }
  return access.data
}
