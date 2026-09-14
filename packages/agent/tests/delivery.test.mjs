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

describe('board batch quick actions (T12)', () => {
  it('creates N idea cards and never publishes them', async () => {
    const result = await agentWorkflowService.runBoardBatch({
      userId: OWNER,
      businessId: BUSINESS,
      kind: 'days',
      days: 4,
      platforms: ['twitter'],
      topic: 'March plan',
    })
    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.length, 4)
    assert.ok(result.data.every(card => card.state === 'idea'))
    assert.ok(result.data.every(card => card.scheduledAt === null && card.postId === null))

    const runs = await db.select().from(schema.contentRuns).where(eq(schema.contentRuns.step, 'batch:days'))
    assert.equal(runs.length, 4)
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
