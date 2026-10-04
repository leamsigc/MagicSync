import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

/**
 * T20: one declared capability per former raw-completion call site (PRD §3.7).
 * Each test keeps the call site's prompt semantics with a scripted completion
 * (capturing the exact prompt sent) plus output validation — no network,
 * no API keys.
 */

const OWNER = 'gen-owner'
const BUSINESS = 'gen-business'

let cleanupDb
let runCapability

before(async () => {
  const init = await initTestDb()
  cleanupDb = init.cleanup
  await insertUser(init.db, { id: OWNER, email: 'gen@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Gen Co' })
  const index = await import('../server/capabilities/index.ts')
  runCapability = index.runCapability
})

after(() => cleanupDb())

function baseCtx(overrides = {}) {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    complete: async () => { throw new Error('scripted completion missing') },
    systemContext: '',
    ...overrides,
  }
}

/** Scripted completion capturing every call's { system, prompt, maxTokens }. */
function scriptedComplete(response) {
  const calls = []
  const complete = async (input) => {
    calls.push(input)
    return typeof response === 'function' ? response(input) : response
  }
  return { complete, calls }
}

function makeIdeas(count) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Idea ${i + 1}`,
    brief: `Brief ${i + 1}`,
    platforms: ['instagram'],
  }))
}

describe('social generation capabilities (T20)', () => {
  it('social.caption keeps the caption prompt semantics and validates output', async () => {
    const { complete, calls } = scriptedComplete('{"text":"Hello world #a","hashtags":["#a","#b"]}')
    const outcome = await runCapability('social.caption', {
      topic: 'roofing',
      platform: 'facebook',
      tone: 'casual',
      includeHashtags: true,
      includeCta: true,
      system: 'Brand voice.',
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.text, 'Hello world #a')
    assert.deepEqual(outcome.output.hashtags, ['#a', '#b'])
    const prompt = calls[0].prompt
    assert.match(prompt, /facebook post about: roofing/)
    assert.match(prompt, /Tone: casual/)
    assert.match(prompt, /Include 3-5 relevant hashtags/)
    assert.match(prompt, /call to action/)
    assert.match(prompt, /strict JSON/)
    assert.equal(calls[0].system, 'Brand voice.')
  })

  it('social.caption rejects empty topics with VALIDATION_ERROR', async () => {
    const outcome = await runCapability('social.caption', { topic: '', platform: 'facebook' }, baseCtx())
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'VALIDATION_ERROR')
  })

  it('social.hooks maps hooks and defaults the hook type', async () => {
    const { complete, calls } = scriptedComplete('{"hooks":[{"hook":"Stop scrolling"},{"hook_type":"x"}]}')
    const outcome = await runCapability('social.hooks', {
      topic: 'roofing',
      platform: 'instagram',
      count: 2,
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.deepEqual(outcome.output.hooks, [{ hook: 'Stop scrolling', hook_type: 'general' }])
    assert.match(calls[0].prompt, /2 scroll-stopping hooks/)
    assert.match(calls[0].prompt, /instagram post about: roofing/)
  })

  it('social.hooks reports AI_PARSE_FAILED when no hooks survive', async () => {
    const { complete } = scriptedComplete('{"hooks":[]}')
    const outcome = await runCapability('social.hooks', { topic: 'roofing', platform: 'instagram' }, baseCtx({ complete }))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'AI_PARSE_FAILED')
  })

  it('social.hashtags keeps the hashtag prompt semantics', async () => {
    const { complete, calls } = scriptedComplete('{"hashtags":["#roof","#care"]}')
    const outcome = await runCapability('social.hashtags', {
      topic: 'roofing',
      platform: 'tiktok',
      count: 2,
      style: 'niche',
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.deepEqual(outcome.output.hashtags, ['#roof', '#care'])
    assert.match(calls[0].prompt, /2 niche hashtags/)
    assert.match(calls[0].prompt, /tiktok post about: roofing/)
  })

  it('social.hashtags reports AI_PARSE_FAILED on empty results', async () => {
    const { complete } = scriptedComplete('no hashtags here')
    const outcome = await runCapability('social.hashtags', { topic: 'roofing', platform: 'tiktok' }, baseCtx({ complete }))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'AI_PARSE_FAILED')
  })

  it('social.batch keeps the batch prompt semantics and groups posts per platform', async () => {
    const { complete, calls } = scriptedComplete('{"posts":{"facebook":[{"text":"FB post","hashtags":["#fb"]}],"instagram":[{"text":"IG post","hashtags":[]}]}}')
    const outcome = await runCapability('social.batch', {
      topic: 'roof inspections',
      platforms: ['facebook', 'instagram'],
      countPerPlatform: 2,
      tone: 'friendly',
      includeHashtags: true,
      includeCta: true,
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.posts.facebook[0].text, 'FB post')
    assert.equal(outcome.output.posts.instagram[0].text, 'IG post')
    assert.match(calls[0].prompt, /Write 2 post\(s\) per platform for: roof inspections\./)
    assert.match(calls[0].prompt, /Platforms: facebook, instagram\. Tone: friendly\./)
    assert.match(calls[0].prompt, /Include 3-5 relevant hashtags per post\./)
    assert.match(calls[0].prompt, /End each post with a clear call to action\./)
    assert.equal(calls[0].maxTokens, 2400)
  })

  it('social.batch drops empty entries and rejects invalid platforms', async () => {
    const { complete } = scriptedComplete('{"posts":{"facebook":[{"text":"","hashtags":[]},{"text":"Kept","hashtags":[]}]}}')
    const outcome = await runCapability('social.batch', {
      topic: 'roofing',
      platforms: ['facebook'],
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.posts.facebook.length, 1)
    assert.equal(outcome.output.posts.facebook[0].text, 'Kept')

    const invalid = await runCapability('social.batch', { topic: 'roofing', platforms: [] }, baseCtx())
    assert.equal(invalid.ok, false)
    assert.equal(invalid.code, 'VALIDATION_ERROR')
  })

  it('social.thread keeps the thread prompt semantics', async () => {
    const { complete, calls } = scriptedComplete('{"tweets":[{"text":"One","hashtags":[]},{"text":"Two","hashtags":["#x"]}]}')
    const outcome = await runCapability('social.thread', {
      topic: 'roof maintenance',
      platform: 'twitter',
      count: 6,
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.deepEqual(outcome.output.posts.map(post => post.text), ['One', 'Two'])
    assert.match(calls[0].prompt, /Write a 6-post twitter thread about: roof maintenance\./)
    assert.match(calls[0].prompt, /Start with a strong hook\./)
    assert.match(calls[0].prompt, /"tweets"/)
  })

  it('social.thread honours hookFirst false and validates its range', async () => {
    const { complete, calls } = scriptedComplete('{"tweets":[{"text":"One","hashtags":[]}]}')
    const outcome = await runCapability('social.thread', {
      topic: 'roofing',
      platform: 'twitter',
      count: 2,
      hookFirst: false,
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.match(calls[0].prompt, /Do not start with a hook\./)

    const invalid = await runCapability('social.thread', { topic: 'roofing', count: 1 }, baseCtx())
    assert.equal(invalid.ok, false)
    assert.equal(invalid.code, 'VALIDATION_ERROR')
  })

  it('social.variations keeps the variations prompt semantics', async () => {
    const { complete, calls } = scriptedComplete('{"variations":[{"text":"Variant A","hashtags":[]},{"text":"Variant B","hashtags":[]}]}')
    const outcome = await runCapability('social.variations', {
      baseContent: 'We fix roofs fast.',
      platform: 'instagram',
      count: 2,
      variationType: 'shorten',
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.deepEqual(outcome.output.posts.map(post => post.text), ['Variant A', 'Variant B'])
    assert.match(calls[0].prompt, /Create 2 shorten variations of this instagram post:/)
    assert.match(calls[0].prompt, /We fix roofs fast\./)
    assert.match(calls[0].prompt, /"variations"/)

    const invalid = await runCapability('social.variations', { baseContent: '' }, baseCtx())
    assert.equal(invalid.ok, false)
    assert.equal(invalid.code, 'VALIDATION_ERROR')
  })
})

describe('content.sql capability (T20)', () => {
  it('keeps the text-to-SQL prompt semantics and validates output', async () => {
    const { complete, calls } = scriptedComplete('{"sql":"SELECT 1","explanation":"trivial","tables_used":["posts"]}')
    const outcome = await runCapability('content.sql', { question: 'How many posts?' }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.sql, 'SELECT 1')
    assert.deepEqual(outcome.output.tables_used, ['posts'])
    assert.match(calls[0].prompt, /Turso\/libSQL/)
    assert.match(calls[0].prompt, /How many posts\?/)
    assert.match(calls[0].prompt, /Only produce SELECT statements/)
  })

  it('rejects blank questions with VALIDATION_ERROR', async () => {
    const outcome = await runCapability('content.sql', { question: '  ' }, baseCtx())
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'VALIDATION_ERROR')
  })
})

describe('playbook.refine capability (T20)', () => {
  it('validates a playbook-shaped refinement', async () => {
    const { complete, calls } = scriptedComplete('{"playbook":{"identity":{"name":"Acme"},"voice":{"tone":"bold"}}}')
    const outcome = await runCapability('playbook.refine', {
      draft: {},
      answers: [{ answer: 'We fix roofs' }],
      missingFields: ['identity.name'],
      businessContext: '',
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.playbook.identity.name, 'Acme')
    assert.match(calls[0].prompt, /Empty fields to prefer: identity\.name/)
    assert.match(calls[0].prompt, /We fix roofs/)
  })

  it('reports AI_PARSE_FAILED when the model returns no playbook', async () => {
    const { complete } = scriptedComplete('looks good!')
    const outcome = await runCapability('playbook.refine', {
      draft: {},
      answers: [{ answer: 'x' }],
    }, baseCtx({ complete }))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'AI_PARSE_FAILED')
  })
})

describe('workflow.idea_scan capability (T20)', () => {
  it('returns schema-validated ideas with the count in the prompt', async () => {
    const { complete, calls } = scriptedComplete(() => JSON.stringify({ ideas: makeIdeas(12) }))
    const outcome = await runCapability('workflow.idea_scan', { count: 12 }, baseCtx({ complete }))
    assert.equal(outcome.ok, true)
    assert.equal(outcome.output.ideas.length, 12)
    assert.match(calls[0].prompt, /12/)
  })

  it('reports AI_PARSE_FAILED when fewer than 10 ideas survive', async () => {
    const { complete } = scriptedComplete(() => JSON.stringify({ ideas: makeIdeas(3) }))
    const outcome = await runCapability('workflow.idea_scan', { count: 12 }, baseCtx({ complete }))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'AI_PARSE_FAILED')
  })
})

describe('capability error codes (T20)', () => {
  it('preserves coded model errors across the capability boundary', async () => {
    const coded = async () => {
      throw Object.assign(new Error('No model configured for this user'), { code: 'MODEL_NOT_CONFIGURED' })
    }
    const outcome = await runCapability('text.generate', { prompt: 'hi' }, baseCtx({ complete: coded }))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'MODEL_NOT_CONFIGURED')
  })
})
