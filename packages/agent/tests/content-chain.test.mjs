import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

// T07 — content chain: research -> write -> humanize -> checks -> review.
// Provider calls are injected through `complete`; nothing hits the network.
const OWNER = 'chain-owner'
const BUSINESS = 'chain-business'

const RESEARCH_JSON = JSON.stringify({
  brief: 'Onboarding research brief',
  citations: [{ label: 'Source A', url: 'https://example.com/a' }],
  keyFacts: ['Teams lose time on manual setup'],
})
const DRAFT_JSON = JSON.stringify({
  caption: 'How do you get three-step onboarding with 40% less effort? Link in bio. #onboarding',
  platformVariants: { instagram: 'How do you get three-step onboarding with 40% less effort? #onboarding' },
  slideCopy: [],
  cta: 'Link in bio',
  claims: ['three-step onboarding'],
  sources: [{ label: 'Source A' }],
})
const HUMANIZED_JSON = JSON.stringify({
  caption: 'How do you get three-step onboarding with 40% less effort? Link in bio. #onboarding',
  platformVariants: {},
  cta: 'Link in bio',
})

let db
let schema
let cleanup
let contentBoardService
let contentChainService
let agentWorkflowService

function stubComplete({ prompt }) {
  if (prompt.includes('Build a brief on the topic')) return Promise.resolve(RESEARCH_JSON)
  if (prompt.includes('Write one social post')) return Promise.resolve(DRAFT_JSON)
  if (prompt.includes('Rewrite the caption so it sounds natural')) return Promise.resolve(HUMANIZED_JSON)
  return Promise.resolve('{}')
}

async function makeCard(title = 'onboarding', platforms = ['instagram']) {
  const created = await contentBoardService.create(OWNER, BUSINESS, { title, platforms })
  assert.equal(created.success, true)
  return created.data
}

function chainInput(itemId, complete = stubComplete) {
  return { userId: OWNER, businessId: BUSINESS, itemId, complete }
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'chain@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Chain Co' })
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ contentChainService } = await import('../server/services/content-chain.service.ts'))
  ;({ agentWorkflowService } = await import('../server/services/agent-workflow.service.ts'))
})

after(() => cleanup())

describe('content chain (T07)', () => {
  it('produces a review_required artifact with checks and no side effects', async () => {
    const card = await makeCard()
    const result = await agentWorkflowService.runContentChain(chainInput(card.id))

    assert.equal(result.success, true, result.error ?? '')
    assert.equal(result.data.item.state, 'review_required')
    assert.equal(result.data.item.postId, null)
    assert.equal(result.data.item.scheduledAt, null)
    assert.equal(result.data.claimsPreserved, true)
    assert.equal(result.data.checks.length, 3)

    const [artifact] = await db.select().from(schema.contentArtifacts).where(eq(schema.contentArtifacts.id, result.data.artifactId))
    assert.equal(artifact.status, 'review_required')
    assert.equal(artifact.businessId, BUSINESS)

    const checks = await db.select().from(schema.contentChecks).where(eq(schema.contentChecks.itemId, card.id))
    assert.deepEqual(checks.map(check => check.kind).sort(), ['geo', 'links', 'seo'])
    const seo = checks.find(check => check.kind === 'seo')
    assert.equal(seo.status, 'pass')

    const runs = await db.select().from(schema.contentRuns).where(eq(schema.contentRuns.itemId, card.id))
    assert.deepEqual(runs.map(run => run.step), ['research_topic', 'write_post', 'humanize', 'checks', 'review'])
    assert.ok(runs.every(run => run.status === 'completed'))
  })

  it('reruns drafting after changes are requested without repeating research', async () => {
    const card = await makeCard()
    const first = await agentWorkflowService.runContentChain(chainInput(card.id))
    assert.equal(first.success, true, first.error ?? '')

    const requested = await contentBoardService.move(OWNER, BUSINESS, card.id, 'drafting', { actorKind: 'user' })
    assert.equal(requested.success, true)

    const second = await agentWorkflowService.runContentChain(chainInput(card.id))
    assert.equal(second.success, true, second.error ?? '')
    assert.equal(second.data.item.state, 'review_required')
    assert.notEqual(second.data.artifactId, first.data.artifactId)

    const runs = await db.select().from(schema.contentRuns).where(eq(schema.contentRuns.itemId, card.id))
    const researchRuns = runs.filter(run => run.step === 'research_topic')
    assert.equal(researchRuns.length, 1, 'research is not repeated on rerun')
    assert.ok(runs.filter(run => run.step === 'write_post').length === 2)
  })

  it('refuses to revise a card with no draft', async () => {
    const card = await makeCard()
    const result = await contentChainService.reviseDraft(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete },
      { itemId: card.id },
    )
    assert.equal(result.success, false)
    assert.equal(result.code, 'ARTIFACT_REQUIRED')
  })

  it('revises a draft in place, bumps the version, and re-runs checks', async () => {
    const card = await makeCard()
    const first = await agentWorkflowService.runContentChain(chainInput(card.id))
    assert.equal(first.success, true, first.error ?? '')

    const revised = await contentChainService.reviseDraft(
      { userId: OWNER, businessId: BUSINESS, complete: stubComplete },
      { itemId: card.id, feedback: 'make the hook punchier' },
    )
    assert.equal(revised.success, true, revised.error ?? '')
    assert.equal(revised.data.artifactId, first.data.artifactId)
    assert.equal(revised.data.item.state, 'review_required')

    const [artifact] = await db.select().from(schema.contentArtifacts).where(eq(schema.contentArtifacts.id, revised.data.artifactId))
    assert.equal(artifact.version, 2)
    assert.equal(artifact.status, 'review_required')

    const checks = await db.select().from(schema.contentChecks).where(eq(schema.contentChecks.itemId, card.id))
    // Re-scoring refreshes one row per kind; `content_checks` carries no runId
    // or version, so a revise leaves three rows describing the new draft.
    assert.deepEqual(checks.map(check => check.kind).sort(), ['geo', 'links', 'seo'])

    const runs = await db.select().from(schema.contentRuns).where(eq(schema.contentRuns.itemId, card.id))
    assert.ok(runs.some(run => run.step === 'revise' && run.status === 'completed'))
  })

  it('restricts a revise to the selected platforms', async () => {
    const card = await makeCard('launch', ['instagram', 'tiktok'])
    const first = await agentWorkflowService.runContentChain(chainInput(card.id))
    assert.equal(first.success, true, first.error ?? '')

    const scopedComplete = ({ prompt }) => {
      if (prompt.includes('Only revise these platform variants')) {
        return Promise.resolve(JSON.stringify({
          caption: 'Scoped revised caption',
          platformVariants: { instagram: 'HACKED into instagram', tiktok: 'Fresh tiktok line #fyp' },
          cta: '',
          claims: [],
          sources: [],
        }))
      }
      return stubComplete({ prompt })
    }
    const revised = await contentChainService.reviseDraft(
      { userId: OWNER, businessId: BUSINESS, complete: scopedComplete },
      { itemId: card.id, feedback: 'tiktok only', onlyPlatforms: ['tiktok'] },
    )
    assert.equal(revised.success, true, revised.error ?? '')
    const [artifact] = await db.select().from(schema.contentArtifacts).where(eq(schema.contentArtifacts.id, revised.data.artifactId))
    const output = JSON.parse(artifact.output)
    assert.equal(output.platformVariants.tiktok.caption, 'Fresh tiktok line #fyp')
    assert.notEqual(output.platformVariants.instagram.caption, 'HACKED into instagram')
  })

  it('recovers the caption when the writer reply is cut off mid-JSON', async () => {
    // Reproduces the production failure: the model hit its token budget inside
    // slideCopy, so the envelope is truncated but the caption value is intact.
    const truncated = '{"caption": "Stop Juggling. Start Scheduling.\\n\\nThe AI chat that gets things done.", "platformVariants": {"WordPress": "Stop Juggling. Start Scheduling."}, "slideCopy": ["Stop context-switching", "One'
    const draft = await contentChainService.writePost(
      { userId: OWNER, businessId: BUSINESS, complete: async () => truncated },
      { brief: 'brief', platforms: ['wordpress'] },
    )

    assert.equal(draft.success, true, draft.error ?? '')
    assert.equal(draft.data.caption, 'Stop Juggling. Start Scheduling.\n\nThe AI chat that gets things done.')
    assert.ok(!draft.data.caption.includes('"caption"'), 'the raw JSON envelope never becomes the caption')
    assert.deepEqual(draft.data.slideCopy, [])
  })

  it('keeps a plain markdown reply as the caption', async () => {
    const draft = await contentChainService.writePost(
      { userId: OWNER, businessId: BUSINESS, complete: async () => '# Heading\n\nBody copy.' },
      { brief: 'brief', platforms: [] },
    )

    assert.equal(draft.success, true, draft.error ?? '')
    assert.equal(draft.data.caption, '# Heading\n\nBody copy.')
  })

  it('reports NO_CHANGES instead of bumping the version for identical output', async () => {
    const card = await makeCard('echo', [])
    const first = await agentWorkflowService.runContentChain(chainInput(card.id))
    assert.equal(first.success, true, first.error ?? '')

    const echoComplete = ({ prompt }) => {
      if (prompt.includes('Apply the feedback precisely')) {
        return Promise.resolve(JSON.stringify({
          caption: 'How do you get three-step onboarding with 40% less effort? Link in bio. #onboarding',
          platformVariants: {},
          cta: 'Link in bio',
          claims: ['three-step onboarding'],
          sources: [{ label: 'Source A' }],
        }))
      }
      return stubComplete({ prompt })
    }
    const revised = await contentChainService.reviseDraft(
      { userId: OWNER, businessId: BUSINESS, complete: echoComplete },
      { itemId: card.id, feedback: 'echo' },
    )
    assert.equal(revised.success, false)
    assert.equal(revised.code, 'NO_CHANGES')
    const [artifact] = await db.select().from(schema.contentArtifacts).where(eq(schema.contentArtifacts.id, first.data.artifactId))
    assert.equal(artifact.version, 1)
  })
})
