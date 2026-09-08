/**
 * Unit tests for Auto-Reply pure helpers (PRD-AUTO-REPLY §7).
 * Run: node --test packages/scheduler/server/services/auto-reply-pure.test.ts
 * (Node ≥20, no deps — uses node:test + inline .ts import via type stripping.)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hourBucketUtc,
  isHttpsUrl,
  matchKeywords,
  parseMetaWebhook,
  renderTemplate,
  trackedUrl,
  trimContacted,
  verifyWebhookSignature,
} from './auto-reply-pure.ts'

describe('matchKeywords — whole word', () => {
  it('matches case-insensitively', () => {
    assert.equal(matchKeywords('LINK please!', ['LINK'], 'whole'), 'LINK')
    assert.equal(matchKeywords('link please!', ['LINK'], 'whole'), 'LINK')
  })
  it('rejects substrings', () => {
    assert.equal(matchKeywords('blink twice', ['LINK'], 'whole'), null)
    assert.equal(matchKeywords('links are great', ['LINK'], 'whole'), null)
  })
  it('handles unicode boundaries', () => {
    assert.equal(matchKeywords('¡LINK por favor!', ['LINK'], 'whole'), 'LINK')
    assert.equal(matchKeywords('LINK🔥', ['LINK'], 'whole'), 'LINK')
  })
  it('first keyword wins', () => {
    assert.equal(matchKeywords('LINK and INFO', ['INFO', 'LINK'], 'whole'), 'INFO')
  })
  it('ignores blank keywords', () => {
    assert.equal(matchKeywords('hello', ['', '  '], 'whole'), null)
  })
})

describe('matchKeywords — partial', () => {
  it('matches substrings', () => {
    assert.equal(matchKeywords('blink twice', ['LINK'], 'partial'), 'LINK')
  })
  it('is case-insensitive', () => {
    assert.equal(matchKeywords('Give me the Link!', ['link'], 'partial'), 'link')
  })
})

describe('renderTemplate', () => {
  it('replaces username + link slots', () => {
    assert.equal(
      renderTemplate('Hey {username}! Here: {link1} (more: {link2})', { username: 'ana', links: ['https://a.co/1', 'https://a.co/2'] }),
      'Hey ana! Here: https://a.co/1 (more: https://a.co/2)',
    )
  })
  it('leaves unknown slots untouched, empties missing links', () => {
    assert.equal(
      renderTemplate('{username} {link2} {other}', { username: 'bob', links: ['https://a.co/1'] }),
      'bob  {other}',
    )
  })
})

describe('trackedUrl', () => {
  it('builds /r short URLs without double slashes', () => {
    assert.equal(trackedUrl('http://localhost:3000/', 'abc', 'link1'), 'http://localhost:3000/r/abc/link1')
  })
})

describe('isHttpsUrl', () => {
  it('accepts https only', () => {
    assert.equal(isHttpsUrl('https://example.com/x'), true)
    assert.equal(isHttpsUrl('http://example.com/x'), false)
    assert.equal(isHttpsUrl('not a url'), false)
  })
})

describe('hourBucketUtc', () => {
  it('formats yyyyMMddHH in UTC', () => {
    assert.equal(hourBucketUtc(new Date('2026-09-07T14:30:00Z')), '2026090714')
    assert.equal(hourBucketUtc(new Date('2026-01-02T03:04:05Z')).length, 10)
  })
})

describe('trimContacted (cooldown FIFO)', () => {
  it('keeps newest N ids', () => {
    const ids = Array.from({ length: 2005 }, (_, i) => `u${i}`)
    const trimmed = trimContacted(ids, 2000)
    assert.equal(trimmed.length, 2000)
    assert.equal(trimmed[0], 'u5')
    assert.equal(trimmed[1999], 'u2004')
  })
  it('passes through small lists', () => {
    assert.deepEqual(trimContacted(['a', 'b'], 2000), ['a', 'b'])
  })
})

describe('parseMetaWebhook', () => {
  it('parses comment changes', () => {
    const evs = parseMetaWebhook({
      object: 'instagram',
      entry: [{
        id: 'IG123', time: 1757318400000,
        changes: [{ field: 'comments', value: { id: 'C1', text: 'LINK please', from: { id: 'U9', username: 'ana' }, media: { id: 'M7' } } }],
      }],
    })
    assert.equal(evs.length, 1)
    const ev = evs[0]
    assert.equal(ev?.kind, 'comment')
    if (ev?.kind === 'comment') {
      assert.equal(ev.commentId, 'C1')
      assert.equal(ev.mediaId, 'M7')
      assert.equal(ev.senderId, 'U9')
      assert.equal(ev.username, 'ana')
      assert.equal(ev.text, 'LINK please')
    }
  })
  it('parses story-reply DMs and follow flag', () => {
    const evs = parseMetaWebhook({
      object: 'instagram',
      entry: [{
        id: 'IG123', time: 1757318400000,
        messaging: [{
          sender: { id: 'U9' }, recipient: { id: 'IG123' }, timestamp: 1757318400000,
          message: { mid: 'M1', text: 'LINK', reply_to: { story: { id: 'S1' } } },
          is_user_follow_business: false,
        }],
      }],
    })
    assert.equal(evs.length, 1)
    const ev = evs[0]
    assert.equal(ev?.kind, 'message')
    if (ev?.kind === 'message') {
      assert.equal(ev.storyReply, true)
      assert.equal(ev.isUserFollowBusiness, false)
      assert.equal(ev.text, 'LINK')
    }
  })
  it('skips own echoes, reads standby, ignores garbage', () => {
    const evs = parseMetaWebhook({
      object: 'page',
      entry: [
        { id: 'P1', time: 1, messaging: [{ sender: { id: 'P1' }, message: { mid: 'E1', text: 'hi' } }] },
        { id: 'P1', time: 1, standby: [{ sender: { id: 'U2' }, message: { mid: 'M2', text: 'hey' } }] },
        { id: '', time: 1, changes: [] },
      ],
    })
    assert.equal(evs.length, 1)
    assert.equal(evs[0]?.kind, 'message')
    assert.deepEqual(parseMetaWebhook(null), [])
    assert.deepEqual(parseMetaWebhook({ entry: 'nope' }), [])
  })
  it('reads postback taps as text', () => {
    const evs = parseMetaWebhook({
      object: 'instagram',
      entry: [{ id: 'IG1', time: 1, messaging: [{ sender: { id: 'U3' }, postback: { title: 'Get link', payload: 'GET_LINK' } }] }],
    })
    assert.equal(evs.length, 1)
    if (evs[0]?.kind === 'message') assert.equal(evs[0].text, 'Get link')
  })
})

describe('verifyWebhookSignature', () => {
  it('accepts a valid sha256 signature from either secret', async () => {
    const { createHmac } = await import('node:crypto')
    const body = '{"object":"instagram"}'
    const sig = 'sha256=' + createHmac('sha256', 'ig-secret').update(body, 'utf8').digest('hex')
    assert.equal(verifyWebhookSignature(body, sig, ['fb-secret', 'ig-secret']), true)
    assert.equal(verifyWebhookSignature(body, sig, ['fb-secret']), false)
  })
  it('rejects malformed input', () => {
    assert.equal(verifyWebhookSignature('', 'sha256=abc', ['s']), false)
    assert.equal(verifyWebhookSignature('x', 'nope', ['s']), false)
    assert.equal(verifyWebhookSignature('x', 'sha256=zz', ['s']), false)
  })
})
