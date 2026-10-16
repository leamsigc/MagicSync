---
name: business-team-members
description: Business team members + invitations on the better-auth organization plugin, including the owner/member-only role policy that keeps admin out of the team surface
triggers:
  - "team members"
  - "invite member"
  - "organization invitation"
  - "remove member"
  - "invitation link"
  - "member role"
edges:
  - target: "add-service.md"
    condition: "when adding the team service methods"
  - target: "add-endpoint.md"
    condition: "when adding the team API routes"
last_updated: 2026-10-16
---

# Business team members

## Context

A business maps 1:1 to a better-auth **organization**. Members and invitations
are the organization's rows, read from `getFullOrganization` (which nests each
member's `user` and returns `invitations`) — never app-owned tables.

Service: `packages/auth/server/services/business-team.service.ts`.
UI: `packages/connect/app/components/connect/business/components/TeamMembers.vue`.
Page: `/app/business/[id]/content/edit`.

## Steps

1. Read `{ members, invitations }` from `getFullOrganization`; keep pending
   invitations only.
2. Accept links are per invitation (`${APP_URL}/accept-invitation?id=<id>`).
   Bulk invite = one `createInvitation` per email; no single multi-email link.
3. Wrap the plugin endpoints in `useAuthApi` (headers injected):
   `createInvitation`, `listInvitations`, `cancelInvitation`, `removeMember`,
   `updateMemberRole`.
4. Service returns `ServiceResponse<T>`, never throws. Routes map `!success` to
   `createError`.
5. Scope every mutation to this business's org before acting.

## Role policy

Assignable roles are **`owner`** and **`member`** only. Refuse `admin` in two
layers — the route zod enum and an exported `ASSIGNABLE_TEAM_ROLES` guard in the
service. Platform admins come solely from `/app/admin/users`. Render an existing
admin as a read-only badge (a select lacking `admin` renders blank).

## Gotchas

- `@` in vue-i18n messages throws *"Invalid linked format"* and 500s the page —
  escape as `{'@'}` (email placeholders!).
- A missing label key renders the raw dotted string — verify every `t('...')`.
- `getFullOrganization` throws FORBIDDEN for non-members; wrap reads.
- Creation is a write (`getOrCreateOrgForBusiness`); a bare read before any invite
  is empty, which is correct.

## Verify

- `business-team.spec.ts` — roster + invite modal screenshots, `admin` → 400 on
  invite and role-change, no Admin filter chip, member removal.

## Update Scaffold

- [ ] Wiki: `/guide/business-team-members`
- [ ] Skill: `packages/doc/skills/business-team-members/SKILL.md`
