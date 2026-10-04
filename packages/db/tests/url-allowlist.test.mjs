import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// T120 — WordPress site URL allowlist (no network for blocked cases).
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/url-allowlist.test.mjs

import { validatePublicSiteUrl } from '../server/utils/url-allowlist.ts'

describe('url allowlist (T120)', () => {
  it('rejects non-https schemes and credentials', async () => {
    assert.match(await validatePublicSiteUrl('http://example.com/') ?? '', /https/)
    assert.match(await validatePublicSiteUrl('ftp://example.com/') ?? '', /https/)
    assert.match(await validatePublicSiteUrl('https://user:pass@example.com/') ?? '', /credentials/)
  })

  it('rejects blocked hosts without DNS', async () => {
    assert.ok(await validatePublicSiteUrl('https://localhost/'))
    assert.ok(await validatePublicSiteUrl('https://127.0.0.1/'))
    assert.ok(await validatePublicSiteUrl('https://10.1.2.3/'))
    assert.ok(await validatePublicSiteUrl('https://metadata.google.internal/'))
  })

  it('rejects disallowed ports and garbage', async () => {
    assert.ok(await validatePublicSiteUrl('https://example.com:8443/'))
    assert.ok(await validatePublicSiteUrl('not a url'))
  })
})
