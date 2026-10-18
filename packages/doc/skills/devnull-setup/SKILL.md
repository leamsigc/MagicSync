---
name: devnull-setup
description: Set up dev-null.sh posting in MagicSync. Use when connecting a dev-null.sh account, generating/storing an SSH key for dev-null.sh, or revoking a stored key. Covers both the guided (Option C, no key storage) and stored-key (Option A, opt-in) flows.
---

# dev-null.sh Setup Skill

## When to trigger
- User asks to "connect dev-null.sh", "post to dev-null", "set up devnull", "enable stored key for devnull".
- A bug report mentions dev-null.sh posting failing.

## Steps

1. Ensure GitHub is connected first (better-auth github provider). If not, prompt connect GitHub.
2. Ensure the user has signed in to dev-null.sh at least once with GitHub.
3. Open the dev-null setup modal (ConnectAddAccount → devnull card).
4. Default to the Guided tab (Option C): show terminal + GitHub Actions steps. No private key stored.
5. Only if the user explicitly opts in (checkbox) and acknowledges risks, run the stored-key flow:
   - POST /api/v1/social-accounts/devnull/setup with { businessId }
   - Server generates Ed25519 keypair, registers public key on GitHub, stores encrypted private key.
6. To revoke: POST /api/v1/social-accounts/devnull/revoke with { businessId }.

## Security notes
- Never reuse the user's real SSH key.
- Private key encrypted at rest (BETTER_AUTH_SECRET).
- Audit log all generate/register/revoke/post actions.
- Default stays guided (no storage).