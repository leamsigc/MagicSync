import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// A card whose deliverable is a carousel (`content_items.format = 'carousel'`)
// must generate slides, not a social-post draft. Provider calls are injected
// through `complete`; nothing hits the network.
const OWNER = 'carousel-card-owner'
const BUSINESS = 'carousel-card-business'

const researchJson = JSON.stringify({
  brief: 'MagicSync ships AI drafting, self-hosting and multi-platform scheduling.',
  citations: [{ label: 'Feature docs', url: 'https://example.com/carousel' }],
  keyFacts: ['AI drafting', 'Self-hosted'],
})

const deckJson = JSON.stringify({
  caption: 'Stop juggling. Start scheduling.',
  slides: [
    { id: 'slide-1', role: 'cover', headline: 'Stop juggling.', body: 'One conversation.', altText: 'Cover', template: 'title-kicker', kicker: '01' },
    { id: 'slide-2', role: 'value', headline: 'Your AI.', body: 'Use the provider you trust.', altText: 'AI', template: 'big-statement' },
    { id: 'slide-3', role: 'value', headline: 'Your data.', body: 'Self-hosted when you want it.', altText: 'Privacy', template: 'stat-highlight' },
    { id: 'slide-4', role: 'cta', headline: 'Reclaim your time.', body: 'Try MagicSync.', altText: 'CTA', template: 'cta', cta: 'Try it' },
  ],
  fullRegeneration: false,
})

/** The carousel prompt carries a slides schema; the research prompt a brief. */
async function stubComplete({ prompt }) {
  if (prompt.includes('"slides"')) return deckJson
  return researchJson
}

let db
let schema
let cleanup
let contentBoardService
let agentWorkflowService
let carouselSlideCount

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'carousel-card@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Carousel Co' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ agentWorkflowService, carouselSlideCount } = await import('../server/services/agent-workflow.service.ts'))
})

after(() => cleanup())

describe('carousel-format content cards', () => {
  it('reads the slide count from the brief inside the 2-10 window', () => {
    assert.equal(carouselSlideCount('A 6-slide Instagram carousel'), 6)
    assert.equal(carouselSlideCount('a 1 slide idea'), 2)
    assert.equal(carouselSlideCount('24-slide deck'), 10)
    assert.equal(carouselSlideCount('carousel with no count'), 6)
    assert.equal(carouselSlideCount(null), 6)
  })

  it('defaults a new card to the social-post format', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'plain post' })
    assert.equal(created.success, true, created.error ?? '')
    assert.equal(created.data.format, 'social_post')
  })

  it('generates a carousel artifact and parks the card in review', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, {
      title: 'New Features Carousel: AI + Privacy + Speed',
      brief: 'A 3-slide Instagram carousel about AI, privacy and speed.',
      platforms: ['instagram'],
      format: 'carousel',
    })
    assert.equal(created.success, true, created.error ?? '')

    const result = await agentWorkflowService.runCarouselChain({
      userId: OWNER,
      businessId: BUSINESS,
      itemId: created.data.id,
      complete: stubComplete,
    })

    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.item.state, 'review_required')
    assert.equal(result.data.item.artifactId, result.data.artifactId)
    assert.equal(result.data.slideCount, 3, 'brief slide count trims the generated deck')

    const [artifact] = await db.select().from(schema.contentArtifacts).where(eq(schema.contentArtifacts.id, result.data.artifactId))
    assert.equal(artifact.kind, 'carousel')
    assert.equal(artifact.outputKind, 'carousel')
    assert.equal(artifact.status, 'review_required')
    const output = JSON.parse(artifact.output)
    assert.equal(output.outputKind, 'carousel')
    assert.equal(output.slides.length, 3)
    assert.equal(output.caption, 'Stop juggling. Start scheduling.')

    const runs = await db.select().from(schema.contentRuns).where(eq(schema.contentRuns.itemId, created.data.id))
    assert.deepEqual(runs.map(run => run.step), ['generate_carousel'])
    assert.ok(runs.every(run => run.status === 'completed'))
  })

  it('carries the requested format through board_add_cards', async () => {
    const added = await contentBoardService.addCards(OWNER, BUSINESS, [
      { title: 'Deck idea', format: 'carousel' },
      { title: 'Plain idea' },
    ], { sourceType: 'trend', actorKind: 'agent', actorUserId: OWNER })
    assert.equal(added.success, true, added.error ?? '')
    assert.deepEqual(added.data.map(card => card.format), ['carousel', 'social_post'])
  })
})
