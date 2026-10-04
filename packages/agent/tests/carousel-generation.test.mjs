import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

const OWNER = 'carousel-owner'
const BUSINESS = 'carousel-business'

let db
let schema
let cleanup
let carouselGenerationService
let contentBoardService
let contentArtifactService
let createAgentTools
let createAgentToolContext

const deckJson = JSON.stringify({
  caption: 'Launch lessons',
  slides: [
    { id: 'slide-1', role: 'cover', headline: 'We launched in 7 days', body: 'Here is what actually mattered.', altText: 'Cover slide', template: 'title-kicker', kicker: 'LAUNCH' },
    { id: 'slide-2', role: 'value', headline: 'Ship before ready', body: 'We cut scope and shipped anyway.', altText: 'Value slide', template: 'big-statement' },
    { id: 'slide-3', role: 'cta', headline: 'Start yours today', body: 'Pick the smallest slice.', altText: 'CTA slide', template: 'cta', cta: 'Read the story' },
  ],
  fullRegeneration: false,
})

function stubComplete() {
  return async ({ prompt }) => {
    if (prompt.includes('LAUNCH')) return deckJson
    if (prompt.includes('Shorten slide 2')) {
      const deck = JSON.parse(deckJson)
      deck.slides[1].body = 'Shorter.'
      return JSON.stringify(deck)
    }
    return deckJson
  }
}

async function makeApprovedCard(title = 'Launch story') {
  const created = await contentBoardService.create(OWNER, BUSINESS, { title, brief: 'All about the launch.' })
  for (const state of ['drafting', 'review_required']) {
    await contentBoardService.move(OWNER, BUSINESS, created.data.id, state, { actorKind: 'agent' })
  }
  const artifact = await contentArtifactService.submitArtifact(OWNER, {
    businessId: BUSINESS, kind: 'social_post', outputKind: 'social_post_draft',
    output: { outputKind: 'social_post_draft', caption: 'Story.', platformVariants: {}, slideCopy: [], cta: '', claims: [], sources: [] },
  })
  await contentArtifactService.reviewArtifact(OWNER, artifact.data.id, BUSINESS, { decision: 'approved', feedback: '', version: 1 })
  await db.update(schema.contentItems).set({ artifactId: artifact.data.id }).where(eq(schema.contentItems.id, created.data.id))
  // Stay at review_required — the delivery tooling performs the final scheduled transition.
  return created.data
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'carousel@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Carousel Co' })
  ;({ carouselGenerationService } = await import('../server/services/carousel-generation.service.ts'))
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ contentArtifactService } = await import('#layers/BaseDB/server/services/content-artifact.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
})

after(() => cleanup())

describe('carousel generation service', () => {
  it('generates a carousel artifact from an approved card', async () => {
    const card = await makeApprovedCard()
    const result = await carouselGenerationService.generate(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete() },
      { sourceId: card.id, instructions: 'Make a deck' },
    )
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.slides.length, 3)
    assert.equal(result.data.version, 1)
    const stored = await contentArtifactService.getArtifact(OWNER, result.data.artifactId, BUSINESS)
    assert.equal(stored.data.kind, 'carousel')
  })

  it('rejects unapproved sources', async () => {
    const card = await contentBoardService.create(OWNER, BUSINESS, { title: 'Idea only' })
    const result = await carouselGenerationService.generate(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete() },
      { sourceId: card.data.id, instructions: '' },
    )
    assert.equal(result.success, false)
    assert.equal(result.code, 'SOURCE_NOT_APPROVED')
  })

  it('rejects slides without headlines and creates versions on revise', async () => {
    const card = await makeApprovedCard('Revise me')
    const bad = await carouselGenerationService.generate(
      { userId: OWNER, businessId: BUSINESS, complete: async () => '{"slides":[]}' },
      { sourceId: card.id, instructions: '' },
    )
    assert.equal(bad.success, false)
    assert.equal(bad.code, 'CAROUSEL_INVALID')
  })

  it('revises a targeted slide into a new version, preserving other slides', async () => {
    const card = await makeApprovedCard('Targeted revise')
    const generated = await carouselGenerationService.generate(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete() },
      { sourceId: card.id, instructions: 'deck' },
    )
    assert.equal(generated.success, true, generated.error ?? '')
    const revised = await carouselGenerationService.revise(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete() },
      { artifactId: generated.data.artifactId, instructions: 'Shorten slide 2', slideIds: ['slide-2'] },
    )
    assert.equal(revised.success, true, revised.error ?? '')
    assert.equal(revised.data.version, 2)
    const slide2 = revised.data.slides.find(slide => slide.id === 'slide-2')
    assert.equal(slide2.body, 'Shorter.')
    const slide1 = revised.data.slides.find(slide => slide.id === 'slide-1')
    assert.equal(slide1.body, 'Here is what actually mattered.')
    const history = await contentArtifactService.getArtifact(OWNER, generated.data.artifactId, BUSINESS)
    assert.equal(history.data.version, 2)
    assert.equal(history.data.revisions.length, 1)
    assert.equal(history.data.revisions[0].version, 1)
  })

  it('ignores unrequested model edits and preserves the caption', async () => {
    const card = await makeApprovedCard('Preserve unselected slides')
    const ctx = { userId: OWNER, businessId: BUSINESS, complete: stubComplete() }
    const generated = await carouselGenerationService.generate(ctx, { sourceId: card.id, instructions: 'deck' })
    const changed = JSON.parse(deckJson)
    changed.caption = 'Unrequested caption'
    changed.slides[0].headline = 'Unrequested replacement'
    changed.slides[1].body = 'Shorter.'
    const revised = await carouselGenerationService.revise(
      { ...ctx, complete: async () => JSON.stringify(changed) },
      { artifactId: generated.data.artifactId, instructions: 'Shorten slide 2', slideIds: ['slide-2'] },
    )
    assert.equal(revised.success, true, revised.error)
    assert.deepEqual(revised.data.slides[0], generated.data.slides[0])
    assert.deepEqual(revised.data.slides[2], generated.data.slides[2])
    assert.equal(revised.data.caption, generated.data.caption)
    assert.equal(revised.data.slides[1].body, 'Shorter.')
    const saved = await contentArtifactService.getArtifact(OWNER, generated.data.artifactId, BUSINESS)
    const output = JSON.parse(saved.data.output)
    assert.equal(output.caption, generated.data.caption)
    assert.deepEqual(output.slides, revised.data.slides)
    assert.equal(output.fullRegeneration, false)
  })

  it('accepts one targeted slide and rejects unknown targets without a model call', async () => {
    const card = await makeApprovedCard('Single slide patch')
    const ctx = { userId: OWNER, businessId: BUSINESS, complete: stubComplete() }
    const generated = await carouselGenerationService.generate(ctx, { sourceId: card.id, instructions: 'deck' })
    const patch = { slides: [{ ...JSON.parse(deckJson).slides[1], body: 'Only this slide.' }] }
    const revised = await carouselGenerationService.revise(
      { ...ctx, complete: async ({ prompt }) => {
        assert.ok(prompt.includes('Ship before ready'))
        return JSON.stringify(patch)
      } },
      { artifactId: generated.data.artifactId, instructions: 'Shorten', slideIds: ['slide-2'] },
    )
    assert.equal(revised.success, true, revised.error)
    assert.equal(revised.data.slides.length, 3)
    assert.equal(revised.data.slides[1].role, 'value')
    assert.equal(revised.data.slides[1].body, 'Only this slide.')
    const invalid = await carouselGenerationService.revise(
      { ...ctx, complete: async () => { assert.fail('Unknown targets must not call the model') } },
      { artifactId: generated.data.artifactId, instructions: 'Shorten', slideIds: ['missing'] },
    )
    assert.equal(invalid.success, false)
    assert.equal(invalid.code, 'VALIDATION_ERROR')
  })

  it('rejects a model response missing the selected slide without creating a version', async () => {
    const card = await makeApprovedCard('Missing patch')
    const ctx = { userId: OWNER, businessId: BUSINESS, complete: stubComplete() }
    const generated = await carouselGenerationService.generate(ctx, { sourceId: card.id, instructions: 'deck' })
    const missing = { slides: [JSON.parse(deckJson).slides[0]] }
    const revised = await carouselGenerationService.revise(
      { ...ctx, complete: async () => JSON.stringify(missing) },
      { artifactId: generated.data.artifactId, instructions: 'Shorten', slideIds: ['slide-2'] },
    )
    assert.equal(revised.success, false)
    assert.equal(revised.code, 'CAROUSEL_INVALID')
    const saved = await contentArtifactService.getArtifact(OWNER, generated.data.artifactId, BUSINESS)
    assert.equal(saved.data.version, 1)
  })

  it('rejects a revision when another edit wins during model generation', async () => {
    const card = await makeApprovedCard('Concurrent revise')
    const ctx = { userId: OWNER, businessId: BUSINESS, complete: stubComplete() }
    const generated = await carouselGenerationService.generate(ctx, { sourceId: card.id, instructions: 'deck' })
    const revised = await carouselGenerationService.revise(
      { ...ctx, complete: async () => {
        const winner = await contentArtifactService.editArtifact(OWNER, generated.data.artifactId, BUSINESS, {
          version: 1, output: { outputKind: 'carousel', ...JSON.parse(deckJson), caption: 'Winning edit' },
        })
        assert.equal(winner.success, true, winner.error)
        return deckJson
      } },
      { artifactId: generated.data.artifactId, instructions: 'Revise', slideIds: [] },
    )
    assert.equal(revised.success, false)
    assert.equal(revised.code, 'VERSION_CONFLICT')
    const saved = await contentArtifactService.getArtifact(OWNER, generated.data.artifactId, BUSINESS)
    assert.equal(saved.data.version, 2)
    assert.equal(JSON.parse(saved.data.output).caption, 'Winning edit')
    assert.equal(saved.data.revisions.length, 1)
  })

  it('creates sequential revision versions', async () => {
    const card = await makeApprovedCard('Stale revise')
    const generated = await carouselGenerationService.generate(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete() },
      { sourceId: card.id, instructions: 'deck' },
    )
    const racing = await carouselGenerationService.revise(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete() },
      { artifactId: generated.data.artifactId, instructions: 'deck', slideIds: [] },
    )
    assert.equal(racing.success, true)
    const stale = await carouselGenerationService.revise(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete() },
      { artifactId: generated.data.artifactId, instructions: 'another', slideIds: [] },
    )
    assert.equal(stale.success, true)
    assert.equal(stale.data.version, 3)
  })

  it('exposes generate_carousel and revise_carousel through the tool layer', async () => {
    const tools = createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS, complete: stubComplete() }))
    const generate = tools.find(tool => tool.name === 'generate_carousel')
    const revise = tools.find(tool => tool.name === 'revise_carousel')
    assert.ok(generate, 'generate_carousel tool exists')
    assert.ok(revise, 'revise_carousel tool exists')
    const card = await makeApprovedCard('Tool layer deck')
    const payload = await runTool(generate, { sourceId: card.id, instructions: 'deck' })
    assert.equal(payload.version, 1)
    assert.equal(payload.slides.length, 3)
    const revisedPayload = await runTool(revise, { artifactId: payload.artifactId, instructions: 'Shorten slide 2', slideIds: ['slide-2'] })
    assert.equal(revisedPayload.version, 2)
  })
})

describe('carousel model-output robustness (small-model JSON)', () => {
  let extractJsonObject
  let normalizeCarousel
  let completeCarouselSlides

  before(async () => {
    ;({ extractJsonObject } = await import('../server/utils/run-config.ts'))
    ;({ normalizeCarousel, completeCarouselSlides } = await import('../server/services/carousel-generation.service.ts'))
  })

  const deck = {
    caption: 'Launch lessons',
    slides: [
      { id: 'slide-1', headline: 'We launched in 7 days', body: 'Here is what actually mattered.' },
      { id: 'slide-2', headline: 'Ship before ready', body: 'We cut scope and shipped anyway.' },
    ],
  }

  function slidesOf(raw) {
    return normalizeCarousel(extractJsonObject(raw) ?? {}).slides
  }

  it('parses fenced JSON', () => {
    assert.equal(slidesOf('```json\n' + JSON.stringify(deck) + '\n```').length, 2)
  })

  it('ignores prose braces around the payload', () => {
    assert.equal(slidesOf('I think {this} is great.\n' + JSON.stringify(deck) + '\nHope that {helps}!').length, 2)
  })

  it('tolerates trailing commas', () => {
    const loose = '{"caption":"Hi","slides":[{"headline":"Hook here now","body":"Body text here.",},{"headline":"Second value prop","body":"More detail here.",}],}'
    assert.equal(slidesOf(loose).length, 2)
  })

  it('accepts title/text key variants', () => {
    const alt = { caption: 'Hi', slides: [{ title: 'Hook here now', text: 'Body one.' }, { title: 'Second prop', text: 'Body two.' }] }
    const slides = slidesOf(JSON.stringify(alt))
    assert.equal(slides.length, 2)
    assert.equal(slides[0].headline, 'Hook here now')
    assert.equal(slides[0].body, 'Body one.')
  })

  it('returns null for truncated output', () => {
    assert.equal(extractJsonObject('{"caption":"Hi","slides":[{"headline":"Hook'), null)
  })

  it('retries once with a repair nudge after an unusable first attempt', async () => {
    let calls = 0
    const complete = async ({ prompt }) => {
      calls += 1
      if (calls === 1) {
        assert.ok(!prompt.includes('strict JSON only'))
        return 'Sure! Here is your carousel {enjoy}'
      }
      assert.ok(prompt.includes('strict JSON only'))
      return JSON.stringify(deck)
    }
    const result = await completeCarouselSlides(complete, { prompt: 'Make a deck', maxTokens: 3000 })
    assert.equal(result.slides.length, 2)
    assert.equal(calls, 2)
  })

  it('does not retry when the first attempt already parses', async () => {
    let calls = 0
    const complete = async () => {
      calls += 1
      return JSON.stringify(deck)
    }
    const result = await completeCarouselSlides(complete, { prompt: 'Make a deck' })
    assert.equal(result.slides.length, 2)
    assert.equal(calls, 1)
  })
})
