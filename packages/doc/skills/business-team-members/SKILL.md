---
name: business-team-members
description: Build or change a business/team members surface backed by the better-auth organization plugin — roster, invitations (single or bulk with accept links), role changes, removal, and the owner/member-only role policy that keeps `admin` out of the team UI. Use when asked to add/remove team members, invite by list of emails, generate invitation links, or when a member role must not offer `admin`.
---

# Business team members (better-auth organization)

A business maps 1:1 to a better-auth **organization**. Team members and
invitations are the organization's `member` / `invitation` rows — never app-owned
tables.

## Ground truth

| Thing | Where |
|---|---|
| Service (ServiceResponse, business logic) | `packages/auth/server/services/business-team.service.ts` |
| Org bridge | `packages/auth/server/services/business-org.service.ts` |
| Plugin wrapper | `packages/auth/server/utils/useAuthApi.ts` |
| Routes | `packages/connect/server/api/v1/business/[id]/{members,invite,invitations,members/[memberId]}` |
| UI | `packages/connect/app/components/connect/business/components/TeamMembers.vue` |
| Page | `packages/site/app/pages/app/business/[id]/content/edit.vue` |

## Steps

1. **Read from `getFullOrganization`.** It returns `members` (each with a nested
   `user`) and `invitations` in one call — no extra queries. Filter invitations to
   `status === 'pending'`.
2. **Accept links are per invitation.** `${APP_URL}/accept-invitation?id=<id>`.
   better-auth has no single multi-email link: bulk invite = one
   `createInvitation` per email, returning each accept URL.
3. **Add the plugin endpoints to `useAuthApi`** with the request headers injected:
   `createInvitation`, `listInvitations`, `cancelInvitation`, `removeMember`,
   `updateMemberRole`.
4. **Service returns `ServiceResponse<T>`** and never throws; routes stay thin and
   map `!success` to `createError`.
5. **Ownership-scope every mutation.** Look the member / invitation up on *this*
   business's org before acting, so a caller cannot touch another org's rows.

## The role policy (do this by default)

Only **`owner`** and **`member`** are assignable from a business surface. Refuse
`admin` in **two** layers — a UI gate is not a guard:

```ts
// route — 400s before any auth call
role: z.enum(['owner', 'member']).default('member')

// service — exported single source of truth
export const ASSIGNABLE_TEAM_ROLES = ['owner', 'member'] as const
if (!isAssignableRole(role)) return { success: false, error: '...' }
```

Platform admins are created **only** from the admin area (`/app/admin/users`).
An existing admin renders as a read-only badge (never a select whose options omit
`admin` — it would render blank) and is excluded from removal.

## Gotchas

- **`@` 500s vue-i18n.** Email placeholders (`colleague@example.com`) throw
  *"Invalid linked format (error code: 10)"*. Escape as `colleague{'@'}example.com`
  in every locale.
- **Label keys drift.** `t('team.roleAdmin')` silently renders the raw dotted key
  when the JSON has only the legacy `role_admin`. Grep-verify every `t('...')` key
  resolves before shipping.
- `getFullOrganization` **throws FORBIDDEN** when the caller isn't a member —
  wrap reads so a non-member gets an empty list, not a 500.
- Creating the org is a **write** (`getOrCreateOrgForBusiness`, called by invite);
  a plain `GET members` before any invite legitimately returns empty.
- `createOrganization` makes the creator the **owner** — that is the only way a
  business owner is born.

## Verify

- Playwright seeds a member + invitations, captures the roster and invite modal,
  asserts `admin` is **400** on both invite and role-change, and that the role
  filter has no Admin chip.
- Wiki: `/guide/business-team-members`.
