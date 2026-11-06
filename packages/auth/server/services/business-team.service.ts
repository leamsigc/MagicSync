import type { H3Event } from 'h3'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { requireBusinessAccess, requireBusinessOwner } from '#layers/BaseDB/server/utils/business-access'
import { businessOrgService, type OrgDetails } from './business-org.service'
import { useAuthApi } from '../utils/useAuthApi'

/**
 * Team management for a business, backed by the better-auth organization
 * plugin. A business maps 1:1 to an organization (`businessOrgService`), so
 * members and invitations come straight from `getFullOrganization`.
 *
 * Every method returns a `ServiceResponse` — never throws.
 *
 * Authorization is enforced here, not only in the routes: the roster is
 * readable by any business member, while every mutation requires the creator
 * or an invited organization owner.
 */

export interface TeamMember {
  id: string
  userId: string
  role: string
  createdAt?: Date | string
  user?: { id: string, name: string | null, email: string, image: string | null }
}

export interface TeamInvitation {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: Date | string
  createdAt?: Date | string
  acceptUrl: string
}

export interface TeamSnapshot {
  members: TeamMember[]
  invitations: TeamInvitation[]
}

export interface CreatedInvitation {
  id: string
  email: string
  role: string | null
  acceptUrl: string
}

/** Roles the built-in organization plugin understands. */
export const TEAM_ROLES = ['owner', 'admin', 'member'] as const
export type TeamRole = typeof TEAM_ROLES[number]

/**
 * Roles a business may hand out. `admin` is deliberately absent: platform
 * admins are created only from the admin area (`/app/admin/users`), never by a
 * business invitation or role change. Enforced here as well as in the routes.
 */
export const ASSIGNABLE_TEAM_ROLES = ['owner', 'member'] as const
export type AssignableTeamRole = typeof ASSIGNABLE_TEAM_ROLES[number]

const isAssignableRole = (role: string): role is AssignableTeamRole =>
  (ASSIGNABLE_TEAM_ROLES as readonly string[]).includes(role)

const appUrl = (): string =>
  process.env.NUXT_APP_URL || process.env.NUXT_BETTER_AUTH_URL || 'http://localhost:3000'

const acceptUrlFor = (invitationId: string): string =>
  `${appUrl()}/accept-invitation?id=${invitationId}`

const isPending = (status?: string | null): boolean => (status ?? 'pending') === 'pending'

const errorMessage = (error: unknown, fallback: string): string => {
  const e = error as { body?: { message?: string }, message?: string }
  return e?.body?.message || e?.message || fallback
}

const findMember = (org: OrgDetails, idOrEmail: string): TeamMember | undefined =>
  (org.members as TeamMember[] | undefined)?.find(
    member => member.id === idOrEmail || member.user?.email === idOrEmail
  )

const ownerCount = (org: OrgDetails): number =>
  (org.members as TeamMember[] | undefined)?.filter(member => member.role === 'owner').length ?? 0

export const businessTeamService = {
  async getTeam(event: H3Event, businessId: string, userId: string): Promise<ServiceResponse<TeamSnapshot>> {
    const access = await requireBusinessAccess(event, userId, businessId)
    if (!access.success || !access.data) {
      return { success: false, error: access.error ?? 'Business not found', code: access.code }
    }

    try {
      const org = await businessOrgService.getOrgForBusiness(event, businessId)
      if (!org) {
        return { success: true, data: { members: [], invitations: [] } }
      }

      const members = (org.members ?? []) as TeamMember[]
      const invitations = (org.invitations ?? [])
        .filter(invitation => isPending(invitation.status))
        .map(invitation => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role ?? null,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          acceptUrl: acceptUrlFor(invitation.id),
        }))

      return { success: true, data: { members, invitations } }
    }
    catch (error) {
      return { success: false, error: errorMessage(error, 'Failed to load team') }
    }
  },

  /**
   * Invite each email individually — better-auth has no single multi-email
   * invitation. Per-email failures do not abort the batch.
   */
  async invite(
    event: H3Event,
    businessId: string,
    userId: string,
    emails: string[],
    role: AssignableTeamRole = 'member'
  ): Promise<ServiceResponse<{ invitations: CreatedInvitation[], failed: { email: string, error: string }[] }>> {
    if (!isAssignableRole(role)) {
      return { success: false, error: 'Admins are created from the admin area, not by invitation' }
    }

    const access = await requireBusinessOwner(event, userId, businessId)
    if (!access.success || !access.data) {
      return { success: false, error: access.error ?? 'Business not found', code: access.code }
    }

    try {
      const org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
      const authApi = useAuthApi(event)
      const invitations: CreatedInvitation[] = []
      const failed: { email: string, error: string }[] = []

      for (const email of emails) {
        try {
          const invitation = await authApi.inviteMember({
            body: { email, role, organizationId: org.id, resend: true },
          })
          invitations.push({
            id: invitation.id,
            email,
            role: invitation.role ?? role,
            acceptUrl: acceptUrlFor(invitation.id),
          })
        }
        catch (error) {
          failed.push({ email, error: errorMessage(error, 'Failed to send invitation') })
        }
      }

      if (invitations.length === 0) {
        return { success: false, error: failed[0]?.error ?? 'Failed to send invitations' }
      }
      return { success: true, data: { invitations, failed } }
    }
    catch (error) {
      return { success: false, error: errorMessage(error, 'Failed to send invitations') }
    }
  },

  async removeMember(event: H3Event, businessId: string, userId: string, memberIdOrEmail: string): Promise<ServiceResponse<{ removed: true }>> {
    const access = await requireBusinessOwner(event, userId, businessId)
    if (!access.success || !access.data) {
      return { success: false, error: access.error ?? 'Business not found', code: access.code }
    }

    try {
      const org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
      const member = findMember(org, memberIdOrEmail)
      if (!member) {
        return { success: false, error: 'Member not found' }
      }
      if (member.role === 'owner' && ownerCount(org) <= 1) {
        return { success: false, error: 'A business must keep at least one owner' }
      }

      await useAuthApi(event).removeMember({
        body: { memberIdOrEmail: member.id, organizationId: org.id },
      })
      return { success: true, data: { removed: true } }
    }
    catch (error) {
      return { success: false, error: errorMessage(error, 'Failed to remove member') }
    }
  },

  async updateRole(
    event: H3Event,
    businessId: string,
    userId: string,
    memberId: string,
    role: AssignableTeamRole
  ): Promise<ServiceResponse<{ updated: true }>> {
    if (!isAssignableRole(role)) {
      return { success: false, error: 'Admins are managed from the admin area, not from the team' }
    }

    const access = await requireBusinessOwner(event, userId, businessId)
    if (!access.success || !access.data) {
      return { success: false, error: access.error ?? 'Business not found', code: access.code }
    }

    try {
      const org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
      const member = findMember(org, memberId)
      if (!member) {
        return { success: false, error: 'Member not found' }
      }
      if (member.role === 'owner' && role !== 'owner' && ownerCount(org) <= 1) {
        return { success: false, error: 'A business must keep at least one owner' }
      }

      await useAuthApi(event).updateMemberRole({
        body: { memberId: member.id, role, organizationId: org.id },
      })
      return { success: true, data: { updated: true } }
    }
    catch (error) {
      return { success: false, error: errorMessage(error, 'Failed to update role') }
    }
  },

  async cancelInvitation(event: H3Event, businessId: string, userId: string, invitationId: string): Promise<ServiceResponse<{ canceled: true }>> {
    const access = await requireBusinessOwner(event, userId, businessId)
    if (!access.success || !access.data) {
      return { success: false, error: access.error ?? 'Business not found', code: access.code }
    }

    try {
      const org = await businessOrgService.getOrgForBusiness(event, businessId)
      const owned = org?.invitations?.some(invitation => invitation.id === invitationId)
      if (!org || !owned) {
        return { success: false, error: 'Invitation not found' }
      }

      await useAuthApi(event).cancelInvitation({ body: { invitationId } })
      return { success: true, data: { canceled: true } }
    }
    catch (error) {
      return { success: false, error: errorMessage(error, 'Failed to cancel invitation') }
    }
  },
}
