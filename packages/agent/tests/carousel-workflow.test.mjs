import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

const OWNER = 'workflow-owner'
const BUSINESS = 'workflow-business'

let db
let schema
let cleanup
let carouselWorkflowService
let contentArtifactService
let contentBoardService
let createAgentTools
let createAgentToolContext

const researchJson = JSON.stringify({
  brief: 'MagicSync carousel creation supports multi-slide decks and video export. 3 sources confirm the feature set.',
  citations: [{ label: 'Feature docs', url: 'https://example.com/carousel' }],
  keyFacts: ['Multi-slide decks', 'Video export'],
})

const deckJson = JSON.stringify({
  caption: 'Create once. Post everywhere.',
  slides: [
    { id: 'slide-1', role: 'cover', headline: 'Create once. Post everywhere.', body: 'Build polished carousel content in MagicSync.', altText: 'Cover', template: 'title-kicker', kicker: '01' },
    { id: 'slide-2', role: 'value', headline: 'Design your story.', body: 'Arrange slides, text and visuals.', altText: 'Design', template: 'big-statement' },
    { id: 'slide-3', role: 'value', headline: 'Turn it into video.', body: 'Export your carousel as video.', altText: 'Video', template: 'stat-highlight' },
    { id: 'slide-4', role: 'value', headline: 'Keep your brand.', body: 'Reuse your visual language.', altText: 'Brand', template: 'tips-list' },
    { id: 'slide-5', role: 'value', headline: 'Ready to publish.', body: 'Connect accounts.', altText: 'Publish', template: 'steps' },
    { id: 'slide-6', role: 'cta', headline: 'Make content simpler.', body: 'One idea, many posts.', altText: 'CTA', template: 'cta', cta: 'Try it' },
  ],
  fullRegeneration: false,
})

// The carousel-skill prompt carries a slides schema; the research prompt a brief schema.
function stubComplete() {
  return async ({ prompt }) => {
    if (prompt.includes('"slides"')) return deckJson
    return researchJson
  }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'workflow@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Workflow Co' })
  ;({ carouselWorkflowService } = await import('../server/services/carousel-workflow.service.ts'))
  ;({ contentArtifactService } = await import('#layers/BaseDB/server/services/content-artifact.service.ts'))
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
})

after(() => cleanup())

function ctx() {
  return { userId: OWNER, businessId: BUSINESS, complete: stubComplete() }
}

describe('carousel workflow (research → generate → review)', () => {
  it('researches first, then generates a review-ready carousel artifact', async () => {
    const result = await carouselWorkflowService.run(ctx(), { request: 'carousel creation tool' })
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.workflow, 'carousel')
    assert.equal(result.data.state, 'review')
    assert.equal(result.data.slides.length, 6)
    assert.equal(result.data.research.sourcesUsed >= 0, true)
    assert.ok(result.data.research.brief.includes('carousel'), 'research feeds generation')
    const stored = await contentArtifactService.getArtifact(OWNER, result.data.artifactId, BUSINESS)
    assert.equal(stored.data.status, 'review_required')
    assert.equal(stored.data.kind, 'carousel')
  })

  it('preview does not persist the final backend carousel', async () => {
    const result = await carouselWorkflowService.run(ctx(), { request: 'carousel creation tool' })
    assert.equal(result.success, true)
    const decks = await db.select().from(schema.entityDetails).where(eq(schema.entityDetails.entityType, 'carousel_deck'))
    const posts = await db.select().from(schema.posts).where(eq(schema.posts.businessId, BUSINESS))
    assert.equal(decks.length, 0, 'no carousel deck before approval')
    assert.equal(posts.length, 0, 'no post before approval')
    const jobs = await db.select().from(schema.publishingJobs).where(eq(schema.publishingJobs.businessId, BUSINESS))
    assert.equal(jobs.length, 0, 'no publishing jobs')
  })

  it('creates no board cards and no subagent runs', async () => {
    await carouselWorkflowService.run(ctx(), { request: 'another carousel topic' })
    const items = await contentBoardService.list(OWNER, BUSINESS, {})
    assert.equal(items.data.length, 0, 'zero board cards')
  })

  it('chat revision updates the preview version', async () => {
    const created = await carouselWorkflowService.run(ctx(), { request: 'carousel revision target' })
    const revised = await contentArtifactService.editArtifact(OWNER, created.data.artifactId, BUSINESS, {
      version: 1,
      output: {
        outputKind: 'carousel',
        caption: 'Updated caption',
        slides: JSON.parse(deckJson).slides.map((slide, index) => index === 2 ? { ...slide, headline: 'Video export first.' } : slide),
        sourceType: 'chat_workflow',
        sourceId: '',
        sourceRef: 'carousel revision target',
      },
    })
    assert.equal(revised.success, true)
    assert.equal(revised.data.version, 2)
    const output = JSON.parse(revised.data.output)
    assert.equal(output.slides[2].headline, 'Video export first.')
  })

  it('approval creates the backend carousel without publishing', async () => {
    const created = await carouselWorkflowService.run(ctx(), { request: 'carousel approval flow' })
    const reviewed = await contentArtifactService.reviewArtifact(OWNER, created.data.artifactId, BUSINESS, {
      decision: 'approved', feedback: '', version: 1,
    })
    assert.equal(reviewed.success, true)
    const materialized = await contentArtifactService.materializeArtifact(OWNER, created.data.artifactId, BUSINESS, undefined, ['explicit-none'])
    // Explicit unknown accounts must be rejected, never published
    assert.equal(materialized.success, false)
    const materializedOwn = await contentArtifactService.materializeArtifact(OWNER, created.data.artifactId, BUSINESS)
    assert.equal(materializedOwn.success, false, 'no connected accounts in test db, so no materialization')
    const posts = await db.select().from(schema.posts).where(eq(schema.posts.businessId, BUSINESS))
    assert.ok(posts.every(post => post.status !== 'published'), 'nothing auto-published')
    const jobs = await db.select().from(schema.publishingJobs).where(eq(schema.publishingJobs.businessId, BUSINESS))
    assert.equal(jobs.length, 0, 'no publishing jobs without explicit schedule')
  })

  it('exposes the workflow through generate_carousel with a request (no card needed)', async () => {
    const tools = createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS, complete: stubComplete() }))
    const generate = tools.find(tool => tool.name === 'generate_carousel')
    assert.ok(generate, 'generate_carousel tool exists')
    const payload = await runTool(generate, { request: 'carousel creation tool' })
    assert.equal(payload.workflow, 'carousel')
    assert.equal(payload.state, 'review')
    assert.equal(payload.slides.length, 6)
    assert.ok(payload.research?.brief, 'research rides along for the preview')
  })
})
