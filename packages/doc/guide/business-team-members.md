# Business Team Members

The **Team** section of `/app/business/[id]/content/edit` is now a Members
surface: a roster of members and pending invitations, search, a role filter,
role changes, removal, and invitations one at a time or as a batch of emails.

![Members table](/img/screenshots/app-business-id-content-edit/page.png)

## Where the data comes from

A business maps 1:1 to a better-auth **organization** (`businessOrgService`).
Members and invitations are not separate tables we own — they come straight from
`getFullOrganization`, which joins the organization's `member` and `invitation`
rows and nests each member's `user`:

```ts
const org = await businessOrgService.getOrgForBusiness(event, businessId)
org.members      // [{ id, userId, role, createdAt, user: { name, email, image } }]
org.invitations  // [{ id, email, role, status, expiresAt, ... }]
```

`members.get.ts` returns `{ members, invitations }` (pending invitations only).

### Invitation links

Each invitation has a stable accept URL — the same one the invitation email uses:

```
${APP_URL}/accept-invitation?id=<invitationId>
```

because **better-auth has no single multi-email link**, the "Multiple emails"
mode creates **one invitation per address** and returns every accept URL, which
the modal lists with copy buttons. Emails are still sent; the links are a
convenience for sharing directly.

![Invite modal — bulk mode](/img/screenshots/app-business-id-content-edit/invite-modal.png)

## Role policy — `admin` is never assignable here

The only roles this surface hands out are **`owner`** and **`member`**.
`admin` is refused by **two** layers, because "prevent at all cost" means the UI
gate is not the guard:

| Layer | Where | Behaviour |
|---|---|---|
| Route validation | `invite.post.ts` / `members/[memberId].patch.ts` | `z.enum(['owner', 'member'])` → `admin` is a 400 before any auth call |
| Service guard | `business-team.service.ts` | `isAssignableRole()` rejects anything outside `ASSIGNABLE_TEAM_ROLES` |

`ASSIGNABLE_TEAM_ROLES = ['owner', 'member']` (exported) is the single source of
truth; `TEAM_ROLES` still lists `admin` for *reading* existing members. Platform
admins are created only from `/app/admin/users`.

An existing `admin` member (created in the admin area) renders as a read-only
**Admin** badge — no select, and it is excluded from removal so admin membership
stays managed centrally.

The invite role defaults to `member`; the Role field carries a help line
("Admins are created from the admin area, never here.").

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/business/[id]/members` | `{ members, invitations }` |
| `POST` | `/api/v1/business/[id]/invite` | `{ emails[], role }` → `{ invitations: [{ email, acceptUrl }] }` |
| `PATCH` | `/api/v1/business/[id]/members/[memberId]` | `{ role }` (owner / member) |
| `DELETE` | `/api/v1/business/[id]/members/[memberId]` | remove (member id **or** email) |
| `DELETE` | `/api/v1/business/[id]/invitations/[invitationId]` | cancel a pending invitation |

Routes stay thin; everything lives in `businessTeamService`, which returns
`ServiceResponse<T>` and never throws. `useAuthApi` wraps the plugin endpoints
(`createInvitation`, `listInvitations`, `cancelInvitation`, `removeMember`,
`updateMemberRole`) with the request headers injected.

## Files

- `packages/auth/server/services/business-team.service.ts` (new)
- `packages/auth/server/utils/useAuthApi.ts` (added the member/invitation endpoints)
- `packages/connect/server/api/v1/business/[id]/members.get.ts` (rewritten)
- `packages/connect/server/api/v1/business/[id]/invite.post.ts` (rewritten — batch)
- `packages/connect/server/api/v1/business/[id]/members/[memberId].{patch,delete}.ts` (new)
- `packages/connect/server/api/v1/business/[id]/invitations/[invitationId].delete.ts` (new)
- `packages/connect/app/components/connect/business/components/TeamMembers.vue` (new, replaces `InviteTeamMember.vue`)
- `packages/site/app/pages/app/business/business.json` (`team.*`, 4 locales)

## Gotchas

- **`@` breaks vue-i18n messages.** An email placeholder like
  `colleague@example.com` throws *"Invalid linked format (error code: 10)"* and
  500s the page — `@` is vue-i18n's linked-message operator. Escape it:
  `colleague{'@'}example.com`.
- **Role labels are a separate key set.** The chip/select labels use
  `team.roleOwner` / `team.roleAdmin` / `team.roleMember`; the older
  `role_member` / `role_admin` keys are unrelated. A missing label renders the raw
  dotted key, which is easy to miss.
- **Only plain members are re-rolable.** Owners and admins are rendered read-only
  so an existing admin never lands in a select whose options exclude `admin`
  (which would render blank).
- The Teams and Roles & permissions tabs from the reference design are **not**
  built — this plugin has no `teams` and no custom access control.

## Verify

```bash
pnpm --filter @local-monorepo/site exec playwright test business-team.spec.ts --reporter=list
```

The spec seeds a member and two invitations, captures the roster and the invite
modal, asserts **`admin` is rejected by both the invite and role-change APIs**
(400) and is absent from the role filter, then removes the member.
