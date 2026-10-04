---
name: credential-envelope
description: Remove plaintext/base64 credential assumptions — AES-256-GCM enc:v1: envelopes at rest and in transit, fail-closed reads, cross-runtime (Node/Python) decrypt.
triggers:
  - "plaintext secret"
  - "base64 api key"
  - "encrypt api key"
  - "credential storage"
  - "fail closed secret"
edges:
  - target: ../AGENTS.md
    condition: before starting — service-layer and no-secrets non-negotiables apply
  - target: security-audit.md
    condition: when mapping which routes/services touch the credential first
last_updated: 2026-09-12
---

# Credential Envelope (fail-closed secret hardening)

## Context
Secrets (LLM API keys, publishing tokens) must never rest as plaintext or
base64 ("encryption" that isn't). The envelope is `enc:v1:<iv>.<tag>.<ct>`
(AES-256-GCM, scrypt key from `NUXT_PUBLISH_SECRET`, `magicsync-publish` salt)
in `packages/db/server/utils/publish-crypto.ts`. The legacy
`NUXT_LLM_JWT_SECRET` fallback still decrypts pre-T14 envelopes — new writes
should always set `NUXT_PUBLISH_SECRET`. The old Python mirror was removed
with `packages/python-backend` (T14); no non-Nuxt runtime reads these
envelopes today.

## Steps
1. **Map every touchpoint:** `rg` for `base64.*[Kk]ey`, `apiKeyEncrypted`,
   `encryptSecret|revealSecret|decryptSecret` across `packages/db/server` and
   `packages/agent/server`. Classify each hit: credential-at-rest,
   credential-in-transit, or protocol-required encoding (GitHub file content,
   HTTP Basic framing, file-upload bytes — leave those).
2. **At rest:** write path encrypts (`toStoredApiKey`-style helper: trim,
   empty→null, already-`enc:v1:`→passthrough, else `encryptSecret`); read path
   decrypts into memory only (`withRevealedKey`-style). Update paths must omit
   the key when the caller sends `undefined` so rotations don't wipe it.
3. **New integrations:** store user-supplied secrets (tool backends,
   publishing tokens) with the same helpers — `undefined` keeps the stored
   value, `''` clears it, text encrypts; read paths decrypt into memory only
   and routes return presence booleans, never secrets.
4. **Fail closed everywhere:** `decryptSecret` returns `null` for non-prefixed
   input — never the input itself. Callers already treat null as
   "re-enter credential" (publishing returns `VALIDATION_ERROR`; LLM resolves
   to platform defaults). API routes keep masking (`maskLlmConfig`) so
   decrypted in-memory keys never reach the client; verify each
   `getLlmJwtContext` consumer forwards only provider/model/token.
5. **Tests:** new `tests/test_llm_security.py` covers envelope round-trip,
   base64/plaintext rejection, tamper rejection, wrong-secret rejection, and
   JWT-level behaviour. Prove Node→Python interop once: encrypt with Node
   `crypto`, decrypt with Python `decrypt_secret`.
6. **Record the migration cost:** legacy plaintext rows read as null until
   re-saved — no silent use of old values. Note it in the tracker evidence.

## Gotchas
- `decryptSecret`'s old `return stored` fallback looked harmless — it was the
  plaintext assumption. Deleting it is the fix.
- Python `cryptography` AESGCM wants `ciphertext+tag` concatenated; Node
  stores them as separate envelope parts — join before decrypt.
- Pydantic field `nuxt_publish_secret` picks up `NUXT_PUBLISH_SECRET`
  case-insensitively; no extra env config needed.
- Full-suite single-process pytest OOMs in this env (exit 137) — run
  per-file; `test_chat` failures (live Ollama, stale `qwen3.5` default) are
  pre-existing and unrelated.
