import type { H3Event } from 'h3'
import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from '../services/types'
import { businessProfileService } from '../services/business-profile.service'

export type BusinessRole = 'owner' | 'member'

export interface BusinessAccess {
  business: BusinessProfile
  role: BusinessRole
  /** User ID that owns shared business rows (corpus, playbook editions). */
  ownerUserId: string
}

function toRole(businessUserId: string, userId: string): BusinessRole {
  return businessUserId === userId ? 'owner' : 'member'
}

/**
 * Single reusable business authorization gate (PRD-BUSINESS-PLAYBOOK-INTAKE §6).
 * Resolves owner-or-member access and the owner ID used to scope shared rows,
 * so organization members share one corpus/playbook instead of fragmenting
 * per-user copies. Never throws — returns a ServiceResponse.
 */
export async function requireBusinessAccess(
  event: H3Event,
  userId: string,
  businessId: string,
): Promise<ServiceResponse<BusinessAccess>> {
  try {
    const profile = await businessProfileService.findById(businessId, userId, event)
    if (!profile.success || !profile.data) {
      return { success: false, error: profile.error ?? 'Business not found', code: 'NOT_FOUND' }
    }
    return {
      success: true,
      data: {
        business: profile.data,
        role: toRole(profile.data.userId, userId),
        ownerUserId: profile.data.userId,
      },
    }
  } catch {
    return { success: false, error: 'Failed to verify business access' }
  }
}

export function accessErrorStatus(code?: string): number {
  return code === 'FORBIDDEN' ? 403 : 404
}
