import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initTestDb } from './setup.mjs'

// Pi content-intelligence plugin: validation, research reuse, generation,
// platform adaptation, and output validation. No network:
// research/complete/business are injected (DB stub still needed for
// module-level service singletons).

let cleanup
let createContentIntelligence

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  ;({ createContentIntelligence } = await import('../server/content-intelligence/index.ts'))
})

after(() => cleanup())

const BUSINESS = {
  name: 'Acme Roofing',
  description: 'Family roofing company in Austin',
  industry: 'Roofing',
  location: 'Austin, TX',
}

function ideasJson(ideas) {
  return JSON.stringify({ ideas })
}

function testIdeas() {
  return [
    { title: '5 Summer Roofing Problems Homeowners Miss', brief: 'Checklist before storm season.', platforms: ['facebook'] },
    { title: 'How to Spot Hail Damage From the Ground', brief: 'Granule loss and dented vents.', platforms: ['instagram'] },
  ]
}

function makePlugin(overrides = {}) {
  const calls = { research: 0, complete: 0, business: 0 }
  const logs = []
  const plugin = createContentIntelligence({
    research: async () => {
      calls.research += 1
      return {
        success: true,
        data: { brief: 'Test brief: summer storms damage shingles. Metal roofs last longer.', citations: [], sourcesUsed: 0, usedAgent: false },
      }
    },
    complete: async () => {
      calls.complete += 1
      return ideasJson(overrides.ideas ?? testIdeas())
    },
    loadBusiness: async () => {
      calls.business += 1
      return overrides.business === undefined ? BUSINESS : overrides.business
    },
    ...overrides.deps,
  })
  const log = { info: (message, fields) => { logs.push({ message, ...fields }) } }
  return { plugin, calls, logs, log }
}

function baseInput(overrides = {}) {
  return {
    userId: 'u1',
    businessId: 'b1',
    topic: 'summer roofing tips',
    quantity: 2,
    platforms: ['facebook', 'instagram'],
    run: {},
    log: { info: () => {} },
    ...overrides,
  }
}

describe('generateContentIdeas input validation', () => {
  it('rejects empty topics', async () => {
    const { plugin } = makePlugin()
    const result = await plugin.generateContentIdeas(baseInput({ topic: '   ' }))
    assert.equal(result.success, false)
    assert.equal(result.code, 'VALIDATION_ERROR')
  })

  it('rejects zero, negative, and over-limit quantities', async () => {
    const { plugin } = makePlugin()
    for (const quantity of [0, -3, 32]) {
      const result = await plugin.generateContentIdeas(baseInput({ quantity }))
      assert.equal(result.success, false, `quantity ${quantity} accepted`)
      assert.equal(result.code, 'VALIDATION_ERROR')
    }
  })

  it('rejects unsupported platforms and missing project', async () => {
    const { plugin } = makePlugin()
    const badPlatform = await plugin.generateContentIdeas(baseInput({ platforms: ['myspace'] }))
    assert.equal(badPlatform.success, false)
    const missingProject = await plugin.generateContentIdeas(baseInput({ businessId: '' }))
    assert.equal(missingProject.success, false)
  })
})

describe('generateContentIdeas generation', () => {
  it('returns the requested quantity with platform execution notes', async () => {
    const { plugin } = makePlugin()
    const result = await plugin.generateContentIdeas(baseInput())
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.ideas.length, 2)
    assert.equal(result.data.metadata.requestedQuantity, 2)
    assert.equal(result.data.metadata.generatedQuantity, 2)
    assert.equal(result.data.metadata.tier, 'llm')
    assert.ok(result.data.ideas[0].platformDetails !== undefined)
  })

  it('keeps valid ideas when one entry is malformed', async () => {
    const { plugin } = makePlugin({
      ideas: [
        { title: 'Good Idea One', brief: 'Solid angle.', platforms: ['twitter'] },
        { title: '', brief: 'Missing title.', platforms: ['twitter'] },
        { title: 'Good Idea Two', brief: 'Another angle.', platforms: [] },
        { title: 'Good Idea Three', brief: 'Third angle.', platforms: ['twitter'] },
        { title: 'Good Idea Four', brief: 'Fourth angle.', platforms: ['twitter'] },
      ],
    })
    const result = await plugin.generateContentIdeas(baseInput({ quantity: 5 }))
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.ideas.length, 4)
    assert.equal(result.data.metadata.tier, 'llm')
    assert.ok(result.data.ideas.every(idea => idea.title.length > 0))
  })

  it('derives no cards from a sources-only brief', async () => {
    const { deriveIdeasFromBrief } = await import('../server/content-intelligence/generate.ts')
    assert.deepEqual(deriveIdeasFromBrief({
      brief: 'Sources:\n- Launch post (https://example.com/a)\n- Recap (https://example.com/b)',
      topic: 'March launch',
      platforms: ['twitter'],
      count: 3,
    }), [])
  })

  it('defaults empty idea platforms to the requested ones and dedupes repeats', async () => {
    const { plugin } = makePlugin({
      ideas: [
        { title: 'Same Title Here', brief: 'First angle.', platforms: [] },
        { title: 'same title here!', brief: 'Repeated angle.', platforms: [] },
        { title: 'Another Angle Entirely', brief: 'Fresh.', platforms: ['twitter'] },
      ],
    })
    const result = await plugin.generateContentIdeas(baseInput({ quantity: 3 }))
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.ideas.length, 2)
    assert.deepEqual(result.data.ideas[0].platforms, ['facebook', 'instagram'])
  })

  it('reuses precomputed research without calling the research provider', async () => {
    const { plugin, calls } = makePlugin()
    const result = await plugin.generateContentIdeas(baseInput({
      options: {
        research: {
          summary: 'Precomputed brief about metal roofs.',
          sources: [{ label: 'Docs', url: 'https://example.com/docs' }],
        },
      },
    }))
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(calls.research, 0)
    assert.equal(result.data.metadata.research.reused, true)
    assert.equal(result.data.research.summary, 'Precomputed brief about metal roofs.')
  })

  it('degrades to topic-only mode when business context is unavailable', async () => {
    const { plugin } = makePlugin({ business: null })
    const result = await plugin.generateContentIdeas(baseInput())
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.metadata.businessGrounded, false)
    assert.ok(result.data.ideas.length > 0)
  })

  it('repairs invalid output once, then falls back to brief-derived ideas', async () => {
    const seen = []
    const { plugin } = makePlugin({
      deps: {
        research: async () => ({
          success: true,
          data: { brief: 'First verifiable sentence here. Second verifiable sentence here.', citations: [], sourcesUsed: 0, usedAgent: false },
        }),
        complete: async (input) => {
          seen.push(input.prompt.slice(0, 60))
          return 'not json at all'
        },
        loadBusiness: async () => BUSINESS,
      },
    })
    const result = await plugin.generateContentIdeas(baseInput())
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(seen.length, 2, 'one repair retry before fallback')
    assert.equal(result.data.metadata.tier, 'brief-derived')
    assert.equal(result.data.ideas.length, 2)
  })
})
