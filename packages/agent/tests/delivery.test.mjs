import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// T12/T13 — board batch quick actions + delivery tools (approval gates).
const OWNER = 'delivery-owner'
const BUSINESS = 'delivery-business'

let db
let schema
let cleanup
let contentBoardService
let contentArtifactService
let agentWorkflowService
let createAgentTools
let createAgentToolContext
let tools

function findTool(name) {
  const tool = tools.find(entry => entry.name === name)
  assert.ok(tool, `tool ${name} exists`)
  return tool
}

async function makeApprovedCard() {
  const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Delivery card', platforms: ['twitter'] })
  const itemId = created.data.id
  for (const state of ['researching', 'research_ready', 'drafting', 'review_required']) {
    await contentBoardService.move(OWNER, BUSINESS, itemId, state, { actorKind: 'agent' })
  }
  const submitted = await contentArtifactService.submitArtifact(OWNER, {
    businessId: BUSINESS,
    kind: 'social_post',
    outputKind: 'social_post_draft',
    output: {
      outputKind: 'social_post_draft',
      caption: 'Ship it.',
      platformVariants: { twitter: { caption: 'Ship it.', hashtags: [] } },
      slideCopy: [],
      cta: '',
      claims: [],
      sources: [],
    },
  })
  await contentArtifactService.reviewArtifact(OWNER, submitted.data.id, BUSINESS, { decision: 'approved', feedback: '', version: 1 })
  await db.update(schema.contentItems).set({ artifactId: submitted.data.id }).where(eq(schema.contentItems.id, itemId))
  await contentBoardService.move(OWNER, BUSINESS, itemId, 'approved', { actorKind: 'user' })
  return { itemId, artifactId: submitted.data.id }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'delivery@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Delivery Co' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ contentArtifactService } = await import('#layers/BaseDB/server/services/content-artifact.service.ts'))
  ;({ agentWorkflowService } = await import('../server/services/agent-workflow.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  tools = createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS }))
})

after(() => cleanup())

describe('topic batch validation (T12)', () => {
  it('rejects empty topics without touching the database', async () => {
    const runsBefore = await db.select().from(schema.agentRuns)
    const result = await agentWorkflowService.startTopicBatch({
      userId: OWNER,
      businessId: BUSINESS,
      kind: 'days',
      days: 7,
      platforms: ['twitter'],
      topic: '   ',
      event: {},
    })
    assert.equal(result.success, false)
    assert.equal(result.code, 'TOPIC_REQUIRED')
    const runsAfter = await db.select().from(schema.agentRuns)
    assert.equal(runsAfter.length, runsBefore.length)
  })

  it('clamps idea counts per kind', async () => {
    const { topicBatchCount } = await import('../server/services/topic-batch.pipeline.ts')
    assert.equal(topicBatchCount('days', 7), 7)
    assert.equal(topicBatchCount('days', 99), 31)
    assert.equal(topicBatchCount('days', 0), 1)
    assert.equal(topicBatchCount('carousel', 7), 3)
    assert.equal(topicBatchCount('reel', 7), 3)
    assert.equal(topicBatchCount('repurpose', 7), 3)
  })

  it('derives grounded ideas from a brief as the last resort', async () => {
    const { deriveIdeasFromBrief } = await import('../server/content-intelligence/generate.ts')
    const cards = deriveIdeasFromBrief({
      brief: 'Early-bird pricing beats expectations. Launch day brings long queues every year.',
      topic: 'March launch',
      platforms: ['twitter'],
      count: 2,
      sourceUrl: 'https://example.com/launch',
    })
    assert.equal(cards.length, 2)
    assert.ok(cards[0].title.length <= 90)
    assert.deepEqual(cards[0].platforms, ['twitter'])
    assert.equal(cards[0].sourceRef, 'https://example.com/launch')
    assert.ok(cards[0].brief.includes('March launch'))
    assert.deepEqual(deriveIdeasFromBrief({ brief: 'Too short', topic: 'x', platforms: [], count: 3 }), [])
  })

  it('composes trend scans grounded in research with platform rules', async () => {
    const { composeTopicScanText } = await import('../server/services/topic-batch.pipeline.ts')
    const text = composeTopicScanText({
      topic: 'March launch',
      platforms: ['twitter'],
      count: 7,
      kind: 'days',
      brief: 'Evidence: launch date March 1st (source).',
    })
    assert.ok(text.includes('March launch'))
    assert.ok(text.includes('exactly 7'))
    assert.ok(text.includes('280 chars'), 'twitter virality rules reach the model')
    assert.ok(text.includes('Evidence: launch date March 1st'))
    const blog = composeTopicScanText({
      topic: 'March launch',
      platforms: ['wordpress'],
      count: 3,
      kind: 'days',
      brief: 'Evidence.',
    })
    assert.ok(blog.includes('300-600 words'), 'wordpress long-form rules reach the model')
  })
})

describe('delivery tools (T13)', () => {
  it('blocks create_post for a card without an artifact', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'No artifact' })
    await assert.rejects(
      findTool('create_post').execute('call-1', { itemId: created.data.id }, undefined, undefined, undefined),
      /ARTIFACT_REQUIRED/,
    )
  })

  it('blocks publish without an active publishing connection', async () => {
    const { itemId } = await makeApprovedCard()
    await assert.rejects(
      findTool('publish').execute('call-2', { itemId }, undefined, undefined, undefined),
      /PUBLISH_CONNECTION_REQUIRED/,
    )
  })

  it('materializes an approved artifact into a draft post', async () => {
    const { itemId } = await makeApprovedCard()
    const [account] = await db.insert(schema.socialMediaAccounts).values({
      id: crypto.randomUUID(),
      userId: OWNER,
      businessId: BUSINESS,
      platform: 'twitter',
      accountId: `acct-${crypto.randomUUID()}`,
      accountName: 'Delivery Account',
      accessToken: 'test-token',
    }).returning()

    const result = await findTool('create_post').execute('call-3', { itemId }, undefined, undefined, undefined)
    const payload = JSON.parse(result.content[0].text)
    assert.ok(payload.postId)
    assert.equal(payload.card.state, 'ready')

    const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, payload.postId))
    assert.equal(post.businessId, BUSINESS)
    assert.ok(post.targetPlatforms.includes(account.id) || post.targetPlatforms.includes('twitter'))
  })
})
