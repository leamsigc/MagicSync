# dev-null.sh integration

## What was done

Added a `/dev/null` integration to MagicSync so users can publish "commits" (posts) to
[dev-null.sh](https://dev-null.sh), a developer social network. Writes to dev-null.sh are
authenticated by SSH signatures verified against keys published on the author's GitHub
account, so the integration is gated on a GitHub connection.

## How it works

1. **GitHub provider** (better-auth) — users connect GitHub (`NUXT_GITHUB_CLIENT_ID` /
   `NUXT_GITHUB_CLIENT_SECRET`). Scopes: `read:user`, `user:email`, `admin:public_key`.
2. **Platform `devnull`** — added to `platformConfigurations` (4000-char limit, 3 images,
   JPEG/PNG/WebP ≤10 MB).
3. **Scheduler plugin** `DevNullPlugin` signs the commit payload with `ssh-keygen -Y sign`
   and POSTs to `https://dev-null.sh/api/cli/commits`.
4. **Connection UI** — `ConnectAddAccount.vue` opens a `DevNullSetup.vue` modal with two tabs:
   - **Guided (default, Option C)** — terminal/GitHub-Actions steps; MagicSync never stores a key.
   - **Stored key (opt-in, Option A)** — generates a dedicated Ed25519 key, stores it encrypted,
     registers the public half on GitHub. Requires explicit risk acknowledgement.

## Security mitigations (Option A)

- Dedicated single-purpose key; never the user's real SSH key.
- Private key encrypted at rest via `better-auth/crypto` (`BETTER_AUTH_SECRET`).
- Explicit opt-in with risk disclosure; default stays guided (no storage).
- Revocation removes the key from both MagicSync and GitHub.
- Audit logging for generate/register/revoke/post.
- Rate-limit aware (10 submissions/min/user).

## Prerequisites

- User must connect GitHub first.
- User must sign in to dev-null.sh at least once (so a `/dev/null` account exists).

## Limitations (dev-null.sh public API)

dev-null.sh's terminal/SSH interface only supports: body, `--reply`, and up to 3 images.
The following dev-null.sh features are **not** reachable from MagicSync today:

- **Polls and voting** — composer-only on dev-null.sh.
- **Quoting a commit** — separate action, not exposed via the terminal interface.
- **Remotes (direct messages) / Orgs** — no public write or read API for DMs.
- **Comments listing** — the public read API exposes `replies_count` but no replies
  endpoint; MagicSync shows the count as an insight instead.

Stats (stars, replies) and image/link-preview metadata are fetched via
`GET /api/v1/commits/{id}` and surfaced as post insights.

## Files touched

- `packages/auth/lib/auth.ts` — github social provider + trustedProviders
- `packages/shared/shared/platformConstants.ts` — devnull platform config
- `packages/db/.../social-media-account.service.ts` — `devnull` in platform union
- `packages/db/.../plugins/devnull.plugin.ts` — new plugin
- `packages/db/package.json` — better-auth dependency
- `packages/scheduler/.../AutoPost.service.ts` — register plugin
- `packages/connect/.../useConnectionManager.ts` — github + devnull connections
- `packages/connect/.../ConnectAddAccount.vue` — wire modal
- `packages/connect/.../DevNullSetup.vue` + `.json` — setup UI + copy
- `packages/connect/server/api/v1/social-accounts/devnull/setup.post.ts`
- `packages/connect/server/api/v1/social-accounts/devnull/revoke.post.ts`