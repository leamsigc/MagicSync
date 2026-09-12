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
(AES-256-GCM, scrypt key from `NUXT_PUBLISH_SECRET || NUXT_LLM_JWT_SECRET`,
`magicsync-publish` salt) in `packages/db/server/utils/publish-crypto.ts`.
Python mirrors it in `packages/python-backend/app/core/security.py`
(`decrypt_secret`, same scrypt params `n=16384,r=8,p=1,dklen=32`, AESGCM from
`cryptography`). Scrypt parity was verified byte-for-byte across runtimes.

## Steps
1. **Map every touchpoint:** `rg` for `base64.*[Kk]ey`, `apiKeyEncrypted`,
   `encryptSecret|revealSecret|decryptSecret` across `packages/db/server` and
   `packages/python-backend/app`. Classify each hit: credential-at-rest,
   credential-in-transit, or protocol-required encoding (GitHub file content,
   HTTP Basic framing, file-upload bytes — leave those).
2. **At rest:** write path encrypts (`toStoredApiKey`-style helper: trim,
   empty→null, already-`enc:v1:`→passthrough, else `encryptSecret`); read path
   decrypts into memory only (`withRevealedKey`-style). Update paths must omit
   the key when the caller sends `undefined` so rotations don't wipe it.
3. **In transit (Nuxt→Python JWT):** `createLlmJwt` puts the `enc:v1:`
   envelope in `apiKeyEncrypted` (never base64, never double-wrap);
   `decode_llm_jwt` decrypts and fails closed to `None`.
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
