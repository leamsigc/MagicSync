import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'

const OWNER = 'content-api-owner'
const OUTSIDER = 'content-api-outsider'
const BUSINESS = 'content-api-business'
const OUTSIDER_BUSINESS = 'content-api-outsider-business'
/** Same owner, no connections at all — the "never connected this provider" case. */
const UNCONNECTED_BUSINESS = 'content-api-unconnected-business'
let cleanup
let runCapability
let db
let schema
let contentBoardService
let contentArtifactService
let publishingService
let postService
let socialMediaAccountService

before(async () => {
  const init = await initTestDb()
  cleanup = init.cleanup
  db = init.db
  schema = init.schema
  await insertUser(init.db, { id: OWNER, email: 'content-api@test.local' })
  await insertUser(init.db, { id: OUTSIDER, email: 'content-api-outsider@test.local' })
  await insertBusiness(init.db, { id: BUSINESS, userId: OWNER, name: 'Content API Co' })
  await insertBusiness(init.db, { id: OUTSIDER_BUSINESS, userId: OUTSIDER, name: 'Someone Else Co' })
  await insertBusiness(init.db, { id: UNCONNECTED_BUSINESS, userId: OWNER, name: 'Unconnected Co' })
  const index = await import('../server/capabilities/index.ts')
  runCapability = index.runCapability
  ;({ contentBoardService } = await import('#layers/BaseDB/server/services/content-board.service.ts'))
  ;({ contentArtifactService } = await import('#layers/BaseDB/server/services/content-artifact.service.ts'))
  ;({ publishingService } = await import('#layers/BaseDB/server/services/publishing.service.ts'))
  ;({ postService } = await import('#layers/BaseDB/server/services/post.service.ts'))
  ;({ socialMediaAccountService } = await import('#layers/BaseDB/server/services/social-media-account.service.ts'))
})

after(() => cleanup())

function storedOutput(artifact) {
  return JSON.parse(artifact.output)
}

/** The scan's own title key, so a card is matched the way the capability matched it. */
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function baseContext(complete = async () => '') {
  return {
    userId: OWNER,
    businessId: BUSINESS,
    complete,
    systemContext: 'Use the business voice.',
  }
}

const ARTICLE = '## Why roofs fail\n\nShingles curl, then cracks.\n\n## What to check\n\nLook at the flashing first.'
const REPAIRED_ARTICLE = '## Why roofs fail\n\nShingles curl, then crack.\n\n## What to check\n\nLook at the flashing first, then the gutter seam.\n\n## Roof maintenance and how often\n\nCheck it twice a year.'

/** A body per target, grounded per the playbook: long-form vs social. */
const VARIANT_BODIES = {
  wordpress: '## Roof maintenance\n\nA keyword-first guide for roof maintenance, with a meta description at the end.',
  facebook: 'Your roof fails quietly.\n\nCurl, then crack.\n\nWant it checked? Comment below.',
}

const VARIANT_REPLY = {
  variants: {
    wordpress: { body: VARIANT_BODIES.wordpress, keywords: ['roof maintenance'], notes: 'SEO version' },
    facebook: { body: VARIANT_BODIES.facebook, keywords: ['#roof'], notes: 'Reaction version' },
  },
}

/** The short social caption `writePost` stored for facebook. */
const SOCIAL_CAPTION = 'Protect your roof before the next storm.'

/**
 * One stub for every model call in the chain: the caption draft, the long-form
 * article, the per-platform bodies, the research brief, and the repair all read
 * the same keys. `overrides` replaces the whole reply for the calls that need
 * a different shape.
 */
function chainComplete(overrides = {}) {
  return async (input) => {
    const prompt = String(input.prompt ?? '')
    if (prompt.includes('markdown body only')) {
      return `\`\`\`markdown\n# Roof maintenance\n\n${ARTICLE}\n\`\`\``
    }
    if (prompt.includes('"variants"')) return JSON.stringify(VARIANT_REPLY)
    if (prompt.includes('"summary"')) return JSON.stringify({ article: REPAIRED_ARTICLE, summary: 'Added the keyword section.' })
    return JSON.stringify({
      caption: 'Protect your roof before the next storm.',
      platformVariants: { facebook: 'Protect your roof before the next storm.' },
      slideCopy: [],
      cta: 'Book an inspection.',
      claims: ['Preventive care saves money.'],
      sources: [],
      brief: 'Regular roof maintenance prevents expensive repairs.',
      citations: [{ label: 'Roof guide', url: 'https://example.com/roof' }],
      ...overrides,
    })
  }
}

function scanComplete(ideas) {
  return async () => JSON.stringify({
    brief: 'Regular roof maintenance prevents expensive repairs.',
    citations: [{ label: 'Roof guide', url: 'https://example.com/roof' }],
    ideas,
  })
}

const SCAN_IDEAS = [
  { title: 'Roof Maintenance Checklist', brief: 'What to inspect before storm season.', platforms: ['facebook'] },
  { title: 'Spotting Hail Damage Early', brief: 'Granule loss and dented vents.', platforms: ['facebook'] },
]

/** Scan ideas whose titles no other suite in this file claims. */
const PLANNING_IDEAS = [
  { title: 'Planned Gutter Schedule', brief: 'When to clear the gutters each season.', platforms: ['facebook'] },
  { title: 'Planned Flashing Inspection', brief: 'What to look at on the roof edge.', platforms: ['facebook'] },
]

async function plannedCard(title) {
  const listed = await contentBoardService.list(OWNER, BUSINESS, { search: title })
  assert.equal(listed.success, true, listed.error ?? '')
  const [card] = listed.data.filter(item => normalizeTitle(item.title) === normalizeTitle(title))
  assert.ok(card, `no card titled "${title}"`)
  return card
}

async function artifactOf(artifactId) {
  const artifact = await contentArtifactService.getArtifact(OWNER, artifactId, BUSINESS)
  assert.equal(artifact.success, true, artifact.error ?? '')
  return artifact.data
}

async function socialAccountsOf(businessId = BUSINESS) {
  const rows = await db.select().from(schema.socialMediaAccounts).where(eq(schema.socialMediaAccounts.businessId, businessId))
  return rows.map(row => ({ ...row }))
}

async function platformPostsOf(postId) {
  return db.select().from(schema.platformPosts).where(eq(schema.platformPosts.postId, postId))
}

async function approveArtifact(artifactId) {
  return contentArtifactService.reviewArtifact(OWNER, artifactId, BUSINESS, {
    decision: 'approved',
    feedback: '',
    version: 1,
  })
}

async function makeConnection(provider = 'wordpress') {
  const config = provider === 'wordpress'
    ? { siteUrl: 'https://blog.test', username: 'editor' }
    : { repo: 'acme/docs', branch: 'main', dir: 'posts' }
  const created = await publishingService.createConnection(OWNER, {
    businessId: BUSINESS,
    provider,
    name: 'Docs',
    config,
    secret: 'test-secret',
  })
  assert.equal(created.success, true, created.error ?? '')
  return created.data
}

let facebookAccount
async function connectedFacebookPage() {
  facebookAccount ??= await socialMediaAccountService.createAccount({
    userId: OWNER,
    businessId: BUSINESS,
    platform: 'facebook',
    accountId: 'fb-page-1',
    accountName: 'Content API Co',
    accessToken: 'test-access-token',
  })
  return facebookAccount
}

/** A card walked to `published` the way the board does: write → approve → scheduled → published. */
async function publishedCard(title = 'Already published') {
  const written = await runCapability('content.write', {
    idea: { title, brief: 'A card the board published and now wants to revise.' },
    platforms: ['facebook'],
  }, baseContext(chainComplete()))
  assert.equal(written.ok, true, written.error ?? '')
  await approveArtifact(written.output.artifactId)
  const scheduled = await contentBoardService.move(OWNER, BUSINESS, written.output.itemId, 'scheduled', {
    actorKind: 'user',
    actorUserId: OWNER,
  })
  assert.equal(scheduled.success, true, scheduled.error ?? '')
  const published = await contentBoardService.move(OWNER, BUSINESS, written.output.itemId, 'published', {
    actorKind: 'user',
    actorUserId: OWNER,
  })
  assert.equal(published.success, true, published.error ?? '')
  return written.output
}

async function jobFor(jobId) {
  const [job] = await db.select().from(schema.publishingJobs).where(eq(schema.publishingJobs.id, jobId))
  return job
}

async function itemState(itemId) {
  const item = await contentBoardService.get(OWNER, BUSINESS, itemId)
  assert.equal(item.success, true, item.error ?? '')
  return item.data.state
}

describe('simple content API capabilities', () => {
  it('registers scan, write, publish, and check under one content namespace', async () => {
    const { capabilityRegistry } = await import('../server/capabilities/registry.ts')
    for (const id of ['content.scan', 'content.write', 'content.publish', 'content.check']) {
      assert.equal(capabilityRegistry.has(id), true, `${id} is registered`)
    }
  })

  it('scans a topic into ideas with a stable id and the sources behind them', async () => {
    const outcome = await runCapability('content.scan', { topic: 'roof maintenance' }, baseContext(scanComplete(SCAN_IDEAS)))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.deepEqual(outcome.output.ideas.map(idea => idea.id), [
      'roof maintenance checklist',
      'spotting hail damage early',
    ])
    assert.equal(outcome.output.ideas[0].title, 'Roof Maintenance Checklist')
    assert.deepEqual(outcome.output.ideas[0].platforms, ['facebook'])
    assert.equal(outcome.output.sources[0].url, 'https://example.com/roof')
  })

  it('scans the business itself when no topic is given', async () => {
    const outcome = await runCapability('content.scan', {}, baseContext(scanComplete(SCAN_IDEAS)))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.ideas.length, 2)
  })

  it('clamps the requested idea count to ten', async () => {
    const prompts = []
    const outcome = await runCapability('content.scan', { count: 24 }, baseContext(async (input) => {
      prompts.push(input.prompt)
      return JSON.stringify({ brief: 'Roof maintenance prevents expensive repairs over time.' })
    }))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.ok(prompts.some(prompt => prompt.includes('exactly 10')), 'the requested quantity is clamped')
  })

  it('writes a brief into a review-ready article and artifact', async () => {
    const outcome = await runCapability('content.write', {
      title: 'Roof maintenance',
      brief: 'Preventive roof care saves money and avoids emergency repairs.',
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.ok(outcome.output.itemId)
    assert.ok(outcome.output.artifactId)
    assert.equal(outcome.output.checks.length, 3)
    assert.equal(outcome.output.article, ARTICLE)

    const item = await contentBoardService.get(OWNER, BUSINESS, outcome.output.itemId)
    assert.equal(item.data.state, 'review_required')
    assert.equal(item.data.artifactId, outcome.output.artifactId)

    const artifact = await contentArtifactService.getArtifact(OWNER, outcome.output.artifactId, BUSINESS)
    assert.equal(storedOutput(artifact.data).article, ARTICLE)
    assert.equal(storedOutput(artifact.data).caption, 'Protect your roof before the next storm.')
  })

  it('drafts straight from a scanned idea', async () => {
    const outcome = await runCapability('content.write', {
      idea: { id: 'roof maintenance checklist', title: 'Roof Maintenance Checklist', brief: 'What to inspect before storm season.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.ok(outcome.output.article.includes('## Why roofs fail'))
    const item = await contentBoardService.get(OWNER, BUSINESS, outcome.output.itemId)
    assert.equal(item.data.title, 'Roof Maintenance Checklist')
  })

  it('drafts from an idea that carries no brief', async () => {
    const outcome = await runCapability('content.write', {
      idea: { id: 'roof maintenance checklist', title: 'Roof Maintenance Checklist', brief: '' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.article, ARTICLE)
  })

  it('reuses the same content item when an itemId is passed back', async () => {
    const first = await runCapability('content.write', {
      idea: { title: 'Re-draft me', brief: 'A second pass at the same angle.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(first.ok, true, first.error ?? '')

    const second = await runCapability('content.write', {
      idea: { title: 'Re-draft me', brief: 'A second pass at the same angle.' },
      platforms: ['facebook'],
      itemId: first.output.itemId,
    }, baseContext(chainComplete()))
    assert.equal(second.ok, true, second.error ?? '')
    assert.equal(second.output.itemId, first.output.itemId)

    const items = await contentBoardService.list(OWNER, BUSINESS)
    assert.equal(items.data.filter(item => item.title === 'Re-draft me').length, 1)
  })

  it('validates artifacts written before the article field existed', async () => {
    const { validateArtifactOutput } = await import('#layers/BaseDB/db/content/contracts.ts')
    const legacy = {
      outputKind: 'social_post_draft',
      caption: 'Written before articles existed.',
      platformVariants: { facebook: { caption: 'Written before articles existed.', hashtags: [] } },
      slideCopy: [],
      cta: 'Book an inspection.',
      claims: [{ text: 'Preventive care saves money.', evidence: [] }],
      sources: ['Roof guide'],
    }
    assert.deepEqual(validateArtifactOutput('social_post_draft', legacy), { ok: true })
  })

  it('defaults variants and keyword to empty, so a pre-D07 artifact still validates', async () => {
    const { validateArtifactOutput, SocialPostDraftSchema } = await import('#layers/BaseDB/db/content/contracts.ts')
    const preD07 = {
      outputKind: 'social_post_draft',
      caption: 'Written before variants existed.',
      article: '## A body that predates the variants map.',
      platformVariants: { facebook: { caption: 'Written before variants existed.', hashtags: [] } },
      slideCopy: [],
      cta: '',
      claims: [],
      sources: [],
    }
    assert.deepEqual(validateArtifactOutput('social_post_draft', preD07), { ok: true })
    const parsed = SocialPostDraftSchema.parse(preD07)
    assert.deepEqual(parsed.variants, {})
    assert.equal(parsed.keyword, '')
  })

  it('uses check as the extensible operation boundary', async () => {
    const seo = await runCapability('content.check', {
      operation: 'seo-audit',
      content: '# Roof care\n\nShort copy with https://example.com/roof',
      platforms: ['facebook'],
    }, baseContext())
    assert.equal(seo.ok, true)
    assert.equal(seo.output.operation, 'seo-audit')
    assert.equal(seo.output.result.headingCount, 1)
    assert.ok(seo.output.result.issues.includes('content_short'))

    const rewrite = await runCapability('content.check', {
      operation: 'rewrite',
      content: 'Original copy.',
      platforms: ['linkedin'],
    }, baseContext(async () => JSON.stringify({ result: 'Improved copy.' })))
    assert.equal(rewrite.ok, true)
    assert.equal(rewrite.output.result, 'Improved copy.')
  })

  it('rejects publish until a content item has an artifact', async () => {
    const item = await contentBoardService.create(OWNER, BUSINESS, { title: 'Unwritten item' })
    const outcome = await runCapability('content.publish', {
      itemId: item.data.id,
      confirm: true,
    }, baseContext())
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'ARTIFACT_REQUIRED')
  })
})

describe('publishing confirms once', () => {
  async function draftedItem() {
    const written = await runCapability('content.write', {
      idea: { title: 'Publishable', brief: 'A draft ready for the delivery step.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    const approved = await approveArtifact(written.output.artifactId)
    assert.equal(approved.data.artifact.status, 'approved')
    return written.output
  }

  it('does nothing at all without an explicit confirmation', async () => {
    const written = await draftedItem()
    const outcome = await runCapability('content.publish', { itemId: written.itemId }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'CONFIRMATION_REQUIRED')

    const item = await contentBoardService.get(OWNER, BUSINESS, written.itemId)
    assert.equal(item.data.state, 'review_required')
    const artifact = await contentArtifactService.getArtifact(OWNER, written.artifactId, BUSINESS)
    assert.equal(artifact.data.postId, null)
  })

  it('creates the job, publishes the article, and moves the item when confirmed', async () => {
    await makeConnection()
    await connectedFacebookPage()
    const written = await draftedItem()

    const outcome = await runCapability('content.publish', {
      itemId: written.itemId,
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.ok(outcome.output.jobId)
    assert.ok(outcome.output.postId)
    assert.equal(outcome.output.artifactId, written.artifactId)

    const item = await contentBoardService.get(OWNER, BUSINESS, written.itemId)
    assert.equal(item.data.state, 'published')

    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.content, ARTICLE)
  })
})

/**
 * The board drags cards between columns. `content.move` forwards the drop and
 * nothing else — the board service is the transition authority, and its coded
 * refusal is what the UI toasts.
 */
describe('content.move is a thin, honest drag adapter', () => {
  it('registers the capability', async () => {
    const { capabilityRegistry } = await import('../server/capabilities/registry.ts')
    assert.equal(capabilityRegistry.has('content.move'), true)
  })

  it('moves a drafted card to review_required and reports the new state', async () => {
    const written = await runCapability('content.write', {
      idea: { title: 'Drag me to Approved', brief: 'Plain forward drag.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')

    const moved = await runCapability('content.move', {
      itemId: written.output.itemId,
      to: 'review_required',
    }, baseContext(chainComplete()))
    assert.equal(moved.ok, true, moved.error ?? '')
    assert.equal(moved.output.itemId, written.output.itemId)
    assert.equal(moved.output.state, 'review_required')
    assert.equal(await itemState(written.output.itemId), 'review_required')
  })

  it('refuses an illegal transition with INVALID_TRANSITION and leaves the state alone', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Never approved' })
    const moved = await runCapability('content.move', {
      itemId: created.data.id,
      to: 'published',
    }, baseContext(chainComplete()))
    assert.equal(moved.ok, false)
    assert.equal(moved.code, 'INVALID_TRANSITION')
    assert.equal(await itemState(created.data.id), 'idea')
  })

  it('refuses published -> scheduled, which the state machine never allows', async () => {
    const published = await publishedCard('Scheduled again?')
    const moved = await runCapability('content.move', {
      itemId: published.itemId,
      to: 'scheduled',
    }, baseContext(chainComplete()))
    assert.equal(moved.ok, false)
    assert.equal(moved.code, 'INVALID_TRANSITION')
    assert.equal(await itemState(published.itemId), 'published')
  })

  it('carries a drafting card backwards to idea', async () => {
    const written = await runCapability('content.write', {
      idea: { title: 'Back to Planned', brief: 'A draft the owner changed their mind about.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')

    const moved = await runCapability('content.move', { itemId: written.output.itemId, to: 'idea' }, baseContext(chainComplete()))
    assert.equal(moved.ok, true, moved.error ?? '')
    assert.equal(moved.output.state, 'idea')

    const item = await contentBoardService.get(OWNER, BUSINESS, written.output.itemId)
    assert.equal(item.data.state, 'idea')
    assert.equal(item.data.artifactId, written.output.artifactId, 'the artifact stays attached')
  })

  it('carries a published card back to review_required for a revision', async () => {
    const published = await publishedCard('Needs a revision')
    const moved = await runCapability('content.move', {
      itemId: published.itemId,
      to: 'review_required',
    }, baseContext(chainComplete()))
    assert.equal(moved.ok, true, moved.error ?? '')
    assert.equal(moved.output.state, 'review_required')
    assert.equal(await itemState(published.itemId), 'review_required')
  })
})

describe('content.write stopAt', () => {
  it('leaves the card in drafting when asked, with the article persisted', async () => {
    const outcome = await runCapability('content.write', {
      idea: { title: 'Still writing', brief: 'The owner wants to read the draft first.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.article, ARTICLE)
    assert.equal(await itemState(outcome.output.itemId), 'drafting')

    const artifact = await contentArtifactService.getArtifact(OWNER, outcome.output.artifactId, BUSINESS)
    assert.equal(storedOutput(artifact.data).article, ARTICLE)
    assert.equal(storedOutput(artifact.data).caption, 'Protect your roof before the next storm.')
  })

  it('still ends in review_required by default', async () => {
    const outcome = await runCapability('content.write', {
      idea: { title: 'Straight to review', brief: 'The default four-step flow.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(await itemState(outcome.output.itemId), 'review_required')

    const artifact = await contentArtifactService.getArtifact(OWNER, outcome.output.artifactId, BUSINESS)
    assert.equal(storedOutput(artifact.data).article, ARTICLE)
  })

  it('still writes the artifact when a drafting card is re-drafted', async () => {
    const first = await runCapability('content.write', {
      idea: { title: 'Re-drafted in place', brief: 'A second pass with stopAt.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(first.ok, true, first.error ?? '')

    const second = await runCapability('content.write', {
      idea: { title: 'Re-drafted in place', brief: 'A second pass with stopAt.' },
      platforms: ['facebook'],
      itemId: first.output.itemId,
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(second.ok, true, second.error ?? '')
    assert.equal(second.output.itemId, first.output.itemId)
    assert.equal(await itemState(first.output.itemId), 'drafting')

    const items = await contentBoardService.list(OWNER, BUSINESS)
    assert.equal(items.data.filter(item => item.title === 'Re-drafted in place').length, 1)
  })
})

describe('publishing picks the connection it was given', () => {
  async function approvedDraft(title) {
    const written = await runCapability('content.write', {
      idea: { title, brief: 'A draft ready for a chosen delivery connection.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    await approveArtifact(written.output.artifactId)
    await connectedFacebookPage()
    return written.output
  }

  it('delivers through the connectionId the caller chose', async () => {
    const first = await makeConnection('wordpress')
    const second = await makeConnection('wordpress')
    const written = await approvedDraft('Chosen connection')

    const outcome = await runCapability('content.publish', {
      itemId: written.itemId,
      provider: 'wordpress',
      connectionId: second.id,
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.notEqual(first.id, second.id)

    const job = await jobFor(outcome.output.jobId)
    assert.equal(job.connectionId, second.id)
    assert.equal(job.businessId, BUSINESS)
    assert.equal(await itemState(written.itemId), 'published')
  })

  it('refuses another tenant’s connection with no side effect', async () => {
    const foreign = await publishingService.createConnection(OUTSIDER, {
      businessId: OUTSIDER_BUSINESS,
      provider: 'wordpress',
      name: 'Their blog',
      config: { siteUrl: 'https://theirs.test', username: 'theirs' },
      secret: 'test-secret',
    })
    assert.equal(foreign.success, true, foreign.error ?? '')
    const written = await approvedDraft('Someone else’s connection')

    const outcome = await runCapability('content.publish', {
      itemId: written.itemId,
      provider: 'wordpress',
      connectionId: foreign.data.id,
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'PUBLISH_CONNECTION_REQUIRED')

    assert.equal(await itemState(written.itemId), 'review_required')
    const artifact = await contentArtifactService.getArtifact(OWNER, written.artifactId, BUSINESS)
    assert.equal(artifact.data.postId, null)
    const jobs = await db.select().from(schema.publishingJobs).where(eq(schema.publishingJobs.artifactId, written.artifactId))
    assert.equal(jobs.length, 0, 'no delivery job was created')
  })

  it('refuses a connection whose provider does not match the request', async () => {
    const repo = await makeConnection('github')
    const written = await approvedDraft('Wrong provider')

    const outcome = await runCapability('content.publish', {
      itemId: written.itemId,
      provider: 'wordpress',
      connectionId: repo.id,
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'PUBLISH_CONNECTION_MISMATCH')

    assert.equal(await itemState(written.itemId), 'review_required')
    const artifact = await contentArtifactService.getArtifact(OWNER, written.artifactId, BUSINESS)
    assert.equal(artifact.data.postId, null)
  })

  it('refuses an inactive connection', async () => {
    const paused = await makeConnection('wordpress')
    await publishingService.updateConnection(paused.id, OWNER, { isActive: false })
    const written = await approvedDraft('Paused connection')

    const outcome = await runCapability('content.publish', {
      itemId: written.itemId,
      provider: 'wordpress',
      connectionId: paused.id,
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'PUBLISH_CONNECTION_MISMATCH')
    assert.equal(await itemState(written.itemId), 'review_required')
  })

  it('falls back to the provider’s active connection when no connectionId is sent', async () => {
    await makeConnection('wordpress')
    const written = await approvedDraft('Fallback connection')

    const outcome = await runCapability('content.publish', {
      itemId: written.itemId,
      provider: 'wordpress',
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')

    // Which active connection wins is the service's business; the point is that
    // an explicit connectionId-less publish still resolves one for this business.
    const job = await jobFor(outcome.output.jobId)
    const [connection] = await db.select().from(schema.publishConnections).where(eq(schema.publishConnections.id, job.connectionId))
    assert.equal(connection.businessId, BUSINESS)
    assert.equal(connection.provider, 'wordpress')
    assert.equal(connection.isActive, true)
    assert.equal(await itemState(written.itemId), 'published')
  })

  it('reports PUBLISH_CONNECTION_REQUIRED for a provider the business never connected', async () => {
    const written = await runCapability('content.write', {
      idea: { title: 'GitHub only elsewhere', brief: 'This business has no GitHub connection at all.' },
      platforms: ['facebook'],
    }, { ...baseContext(chainComplete()), businessId: UNCONNECTED_BUSINESS })
    assert.equal(written.ok, true, written.error ?? '')

    const outcome = await runCapability('content.publish', {
      itemId: written.output.itemId,
      provider: 'github',
      confirm: true,
    }, { ...baseContext(chainComplete()), businessId: UNCONNECTED_BUSINESS })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'PUBLISH_CONNECTION_REQUIRED')

    const item = await contentBoardService.get(OWNER, UNCONNECTED_BUSINESS, written.output.itemId)
    assert.equal(item.data.state, 'review_required')
  })
})

/**
 * D03 — a brief is prose. A model that answers with a JSON envelope must have
 * it parsed, and an envelope that carries no prose must be dropped rather than
 * rendered raw on a card.
 */
describe('brief sanitisation', () => {
  it('takes the prose out of a JSON envelope', async () => {
    const { sanitizeBrief } = await import('../server/content-intelligence/index.ts')
    assert.equal(sanitizeBrief('{"brief": "Real prose."}'), 'Real prose.')
    assert.equal(sanitizeBrief('```json\n{"summary":"Real prose."}\n```'), 'Real prose.')
  })

  it('collapses whitespace and leaves plain prose alone', async () => {
    const { sanitizeBrief } = await import('../server/content-intelligence/index.ts')
    assert.equal(sanitizeBrief('  Real   prose.  '), 'Real prose.')
    assert.equal(sanitizeBrief('First line.\n\nSecond   line.'), 'First line. Second line.')
  })

  it('drops an envelope with no prose field instead of rendering the JSON', async () => {
    const { sanitizeBrief } = await import('../server/content-intelligence/index.ts')
    assert.equal(sanitizeBrief('{"a":1}'), '')
    assert.equal(sanitizeBrief('{"citations": [], "briefs": []}'), '')
    assert.equal(sanitizeBrief('{not even json'), '')
    assert.equal(sanitizeBrief(''), '')
  })

  it('never leaves a card brief matching /[{[]/', async () => {
    const { sanitizeBrief } = await import('../server/content-intelligence/index.ts')
    const hostile = [
      '{"brief": "Real prose."}',
      '```json\n{"summary":"Real prose."}\n```',
      '  Real   prose.  ',
      '{"a":1}',
      '{"keywords": ["roof", "gutter"]}',
      '["roof", "gutter"]',
      '{oops',
    ]
    for (const raw of hostile) {
      const brief = sanitizeBrief(raw)
      assert.doesNotMatch(brief, /[{[]/, `survived: ${raw} -> ${brief}`)
    }
  })

  it('sanitises the scan research brief and every idea brief that reaches a card', async () => {
    const outcome = await runCapability('content.scan', { topic: 'sanitised scan topic' }, baseContext(scanComplete([
      { title: 'Envelope idea', brief: '{"summary":"Real idea prose."}', platforms: ['facebook'] },
    ])))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.ideas[0].brief, 'Real idea prose.')

    const card = await plannedCard('Envelope idea')
    assert.equal(card.brief, 'Real idea prose.')
    assert.equal(card.state, 'idea', 'the scan lands the idea in Planned')
  })

  it('parses a research brief the model answered with a JSON envelope', async () => {
    const outcome = await runCapability('content.scan', { topic: 'envelope research topic' }, baseContext(async () => JSON.stringify({
      brief: '{"summary": "Real research prose."}',
      citations: [{ label: 'Roof guide', url: 'https://example.com/roof' }],
      ideas: [{ title: 'Prose from an envelope', brief: 'Grounded prose.', platforms: ['facebook'] }],
    })))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    const card = await plannedCard('Prose from an envelope')
    assert.doesNotMatch(card.brief, /[{[]/, 'the card brief is prose, never an envelope')
  })
})

/** D01 — the scan is a modal whose results are added to Planned automatically. */
describe('content.scan plans a card per idea and dedupes on rescan', () => {
  const SCAN_TOPIC = 'unique scan topic for the planning tests'

  it('returns the card id for every idea it planned', async () => {
    const outcome = await runCapability('content.scan', { topic: SCAN_TOPIC }, baseContext(scanComplete(PLANNING_IDEAS)))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.ideas.length, 2)
    for (const idea of outcome.output.ideas) {
      assert.ok(idea.itemId, `${idea.title} has no itemId`)
    }

    const card = await plannedCard('Planned Gutter Schedule')
    assert.equal(card.state, 'idea')
    assert.equal(card.createdBy, 'agent')
    assert.equal(card.brief, 'When to clear the gutters each season.')
    assert.deepEqual(card.platforms, ['facebook'])
  })

  it('reuses the same card when the scan repeats', async () => {
    const first = await runCapability('content.scan', { topic: SCAN_TOPIC }, baseContext(scanComplete(PLANNING_IDEAS)))
    const second = await runCapability('content.scan', { topic: SCAN_TOPIC }, baseContext(scanComplete(PLANNING_IDEAS)))
    assert.equal(first.ok, true, first.error ?? '')
    assert.equal(second.ok, true, second.error ?? '')
    assert.deepEqual(
      second.output.ideas.map(idea => idea.itemId),
      first.output.ideas.map(idea => idea.itemId),
      'a rescan returns the same card ids',
    )

    const listed = await contentBoardService.list(OWNER, BUSINESS, { search: 'Planned Gutter Schedule' })
    const matching = listed.data.filter(item => normalizeTitle(item.title) === normalizeTitle('Planned Gutter Schedule'))
    assert.equal(matching.length, 1, `no duplicate card, found ${matching.length}`)
  })

  it('creates distinct cards for distinct ideas in one scan', async () => {
    const outcome = await runCapability('content.scan', { topic: 'gutter cleaning' }, baseContext(scanComplete([
      { title: 'Downspout Sizing', brief: 'Why the downspout matters.', platforms: ['facebook'] },
      { title: 'Gutter Guard Choices', brief: 'Which guard suits which roof.', platforms: ['facebook'] },
    ])))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(new Set(outcome.output.ideas.map(idea => idea.itemId)).size, 2)
  })
})

/** D02 / D04 — the card's three-dot menu and the editable brief header. */
describe('content.update edits only what it is given', () => {
  async function draftedCard(title) {
    const written = await runCapability('content.write', {
      idea: { title, brief: 'A draft the owner is about to edit.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    return written
  }

  it('registers the capability', async () => {
    const { capabilityRegistry } = await import('../server/capabilities/registry.ts')
    for (const id of ['content.update', 'content.delete', 'content.fix', 'content.social.publish']) {
      assert.equal(capabilityRegistry.has(id), true, `${id} is not registered`)
    }
  })

  it('applies a partial update and leaves the untouched fields alone', async () => {
    const written = await draftedCard('Edit the brief')
    const outcome = await runCapability('content.update', {
      itemId: written.output.itemId,
      brief: 'The owner rewrote the brief.',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.itemId, written.output.itemId)
    assert.equal(outcome.output.item.brief, 'The owner rewrote the brief.')
    assert.equal(outcome.output.item.title, 'Edit the brief', 'the title was not sent, so it survives')
    assert.deepEqual(outcome.output.item.platforms, ['facebook'])
    assert.equal(outcome.output.item.artifactId, written.output.artifactId)
    assert.equal(outcome.output.state, 'drafting')
  })

  it('edits title, platforms and priority together', async () => {
    const written = await draftedCard('Edit the meta')
    const outcome = await runCapability('content.update', {
      itemId: written.output.itemId,
      title: 'Edited title',
      platforms: ['wordpress', 'linkedin'],
      priority: 7,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.item.title, 'Edited title')
    assert.deepEqual(outcome.output.item.platforms, ['wordpress', 'linkedin'])
    assert.equal(outcome.output.item.priority, 7)
  })

  it('sanitises an edited brief too, but never drops what the owner typed', async () => {
    const written = await draftedCard('Edit with JSON')
    const outcome = await runCapability('content.update', {
      itemId: written.output.itemId,
      brief: '{"summary": "Real prose now."}',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.item.brief, 'Real prose now.')

    const kept = await runCapability('content.update', {
      itemId: written.output.itemId,
      brief: '  Compare {this} and [that]  ',
    }, baseContext(chainComplete()))
    assert.equal(kept.ok, true, kept.error ?? '')
    assert.equal(kept.output.item.brief, 'Compare {this} and [that]', 'an owner-typed brace is never discarded')
  })

  it('writes one platform body into the variants map and keeps the rest', async () => {
    const written = await runCapability('content.write', {
      idea: { title: 'Variant editing', brief: 'A draft whose variant the owner rewrites.' },
      platforms: ['wordpress', 'facebook'],
      keyword: 'roof maintenance',
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')

    const outcome = await runCapability('content.update', {
      itemId: written.output.itemId,
      keyword: 'roof inspection',
      variant: { platform: 'facebook', body: 'Owner-written Facebook body.' },
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')

    const stored = storedOutput(await artifactOf(written.output.artifactId))
    assert.equal(stored.variants.facebook.body, 'Owner-written Facebook body.')
    assert.equal(stored.variants.wordpress.body, VARIANT_BODIES.wordpress, 'the other platform survives')
    assert.equal(stored.keyword, 'roof inspection')
    assert.equal(stored.article, ARTICLE, 'the shared article is untouched')
  })

  it('refuses another business’s card with NOT_FOUND', async () => {
    const written = await draftedCard('Foreign card')
    const outcome = await runCapability('content.update', { itemId: written.output.itemId, title: 'Hijacked' }, {
      ...baseContext(chainComplete()),
      businessId: OUTSIDER_BUSINESS,
    })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'NOT_FOUND')

    const card = await contentBoardService.get(OWNER, BUSINESS, written.output.itemId)
    assert.equal(card.data.title, 'Foreign card', 'the card is untouched')
  })
})

describe('content.delete removes the card and its artifact', () => {
  it('deletes a drafted card, its artifact and its checks', async () => {
    const written = await runCapability('content.write', {
      idea: { title: 'Delete me', brief: 'A card the owner no longer wants.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')

    const outcome = await runCapability('content.delete', { itemId: written.output.itemId }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.deepEqual(outcome.output, { itemId: written.output.itemId, deleted: true })

    const card = await contentBoardService.get(OWNER, BUSINESS, written.output.itemId)
    assert.equal(card.success, false)
    assert.equal(card.code, 'NOT_FOUND')
    const artifact = await contentArtifactService.getArtifact(OWNER, written.output.artifactId, BUSINESS)
    assert.equal(artifact.success, false, 'the dependent artifact is gone')
  })

  it('deletes a Planned card that has no artifact', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Planned and unwanted' })
    const outcome = await runCapability('content.delete', { itemId: created.data.id }, baseContext())
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal((await contentBoardService.get(OWNER, BUSINESS, created.data.id)).success, false)
  })

  it('refuses a delivered card and deletes nothing', async () => {
    await makeConnection()
    await connectedFacebookPage()
    const written = await runCapability('content.write', {
      idea: { title: 'Published and delivered', brief: 'A card whose artifact is already out.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    await approveArtifact(written.output.artifactId)
    const published = await runCapability('content.publish', { itemId: written.output.itemId, confirm: true }, baseContext(chainComplete()))
    assert.equal(published.ok, true, published.error ?? '')

    const outcome = await runCapability('content.delete', { itemId: written.output.itemId }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'ACTION_NOT_SUPPORTED')

    const card = await contentBoardService.get(OWNER, BUSINESS, written.output.itemId)
    assert.equal(card.success, true, 'the card survives a refused delete')
    const artifact = await contentArtifactService.getArtifact(OWNER, written.output.artifactId, BUSINESS)
    assert.equal(artifact.success, true, 'the artifact survives too')
  })

  it('refuses another business’s card with NOT_FOUND', async () => {
    const written = await runCapability('content.write', {
      idea: { title: 'Not yours to delete', brief: 'A card belonging to another business.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')

    const outcome = await runCapability('content.delete', { itemId: written.output.itemId }, {
      ...baseContext(chainComplete()),
      businessId: OUTSIDER_BUSINESS,
    })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'NOT_FOUND')
    assert.equal((await contentBoardService.get(OWNER, BUSINESS, written.output.itemId)).success, true)
  })
})

/** D06 — repair on demand, grounded in the failing checks, the brief and the keyword. */
describe('content.fix repairs the failing checks and nothing else', () => {
  async function drafted(title) {
    const written = await runCapability('content.write', {
      idea: { title, brief: 'A draft the owner wants the agent to repair.' },
      platforms: ['facebook'],
      keyword: 'roof maintenance',
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    return written
  }

  it('repairs the body, bumps the version and re-runs the checks', async () => {
    const written = await drafted('Repair the article')
    const before = await artifactOf(written.output.artifactId)

    const outcome = await runCapability('content.fix', {
      itemId: written.output.itemId,
      checks: [{ kind: 'seo', status: 'warn', score: 55, findings: { topicMissing: 'roof maintenance' } }],
      keyword: 'roof maintenance',
      topic: 'Repair the article',
      instructions: 'Work the keyword in.',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.changed, true)
    assert.equal(outcome.output.article, REPAIRED_ARTICLE)
    assert.equal(outcome.output.artifactId, written.output.artifactId)

    const after = await artifactOf(written.output.artifactId)
    assert.equal(after.version, before.version + 1, 'the artifact version was bumped')
    assert.equal(storedOutput(after).article, REPAIRED_ARTICLE)
    assert.equal(storedOutput(after).caption, 'Protect your roof before the next storm.', 'the caption is untouched')

    // Re-scoring refreshes the row per (itemId, kind) rather than appending —
// `content_checks` has no runId or version column, so it cannot hold history.
// The three kinds are therefore re-written in place, and a repair leaves three
// rows that describe the repaired article, not six.
const checks = await contentBoardService.listChecks(OWNER, BUSINESS, written.output.itemId)
    assert.deepEqual(
      checks.data.map(check => check.kind).sort(),
      ['geo', 'links', 'seo'],
      'the repaired article carries one fresh check per kind',
    )
  })

  it('is a no-op on a passing check set', async () => {
    const written = await drafted('Nothing to fix')
    const before = await artifactOf(written.output.artifactId)

    const outcome = await runCapability('content.fix', {
      itemId: written.output.itemId,
      checks: [{ kind: 'seo', status: 'pass', score: 95 }],
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.changed, false)
    assert.equal(outcome.output.article, ARTICLE)

    const after = await artifactOf(written.output.artifactId)
    assert.equal(after.version, before.version, 'nothing was written')
    assert.equal(storedOutput(after).article, ARTICLE)
  })

  it('reports ARTIFACT_REQUIRED when the card has no article', async () => {
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Never drafted' })
    const outcome = await runCapability('content.fix', { itemId: created.data.id }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'ARTIFACT_REQUIRED')
  })

  it('refuses another business’s card with NOT_FOUND', async () => {
    const written = await drafted('Foreign repair')
    const outcome = await runCapability('content.fix', {
      itemId: written.output.itemId,
      checks: [{ kind: 'seo', status: 'fail' }],
    }, { ...baseContext(chainComplete()), businessId: OUTSIDER_BUSINESS })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'NOT_FOUND')
  })
})

/** D07 — one article, one body per target, grounded per the playbook. */
describe('content.write writes a body per selected platform', () => {
  it('stores a variant per platform with its own grounding', async () => {
    const outcome = await runCapability('content.write', {
      idea: { title: 'Multi-platform body', brief: 'One article, several bodies.' },
      platforms: ['wordpress', 'facebook'],
      keyword: 'roof maintenance',
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')

    const stored = storedOutput(await artifactOf(outcome.output.artifactId))
    assert.deepEqual(Object.keys(stored.variants).sort(), ['facebook', 'wordpress'])
    assert.equal(stored.variants.wordpress.body, VARIANT_BODIES.wordpress)
    assert.deepEqual(stored.variants.wordpress.keywords, ['roof maintenance'])
    assert.equal(stored.variants.facebook.body, VARIANT_BODIES.facebook)
    assert.equal(stored.keyword, 'roof maintenance')
    assert.equal(stored.article, ARTICLE, 'the shared article is still the long-form body')
  })

  it('writes a single default variant, mirrored from the article, when no platform is picked', async () => {
    const outcome = await runCapability('content.write', {
      idea: { title: 'No platform chosen', brief: 'One body for everyone.' },
      platforms: [],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')

    const stored = storedOutput(await artifactOf(outcome.output.artifactId))
    assert.deepEqual(Object.keys(stored.variants), ['default'])
    assert.equal(stored.variants.default.body, stored.article)
  })

  it('publishes the variant matching the provider, not the shared article', async () => {
    await makeConnection()
    await connectedFacebookPage()
    const written = await runCapability('content.write', {
      idea: { title: 'Publish the wordpress body', brief: 'The long-form target gets its own body.' },
      platforms: ['wordpress', 'facebook'],
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    await approveArtifact(written.output.artifactId)

    const outcome = await runCapability('content.publish', {
      itemId: written.output.itemId,
      provider: 'wordpress',
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.variant, 'wordpress')

    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.content, VARIANT_BODIES.wordpress)
  })

  it('falls back to the shared article when the provider has no variant', async () => {
    await makeConnection()
    await connectedFacebookPage()
    const written = await runCapability('content.write', {
      idea: { title: 'No wordpress variant', brief: 'Written with no platform selected.' },
      platforms: [],
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    await approveArtifact(written.output.artifactId)

    const outcome = await runCapability('content.publish', {
      itemId: written.output.itemId,
      provider: 'wordpress',
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.variant, 'article')

    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.content, ARTICLE)
  })
})

/** D08 — social posts are drafted on demand and published as a separate action. */
describe('content.social.publish is a separate delivery action', () => {
  let drafted

  before(async () => {
    drafted = await runCapability('content.write', {
      idea: { title: 'Social on demand', brief: 'A card whose social body is published separately.' },
      platforms: ['facebook'],
      keyword: 'roof maintenance',
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(drafted.ok, true, drafted.error ?? '')
  })

  it('creates a post on the owner’s connected account from the card’s own social body', async () => {
    const account = await connectedFacebookPage()

    const outcome = await runCapability('content.social.publish', {
      itemId: drafted.output.itemId,
      accountId: account.id,
      platform: 'facebook',
      hashtags: ['roofcare'],
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.accountId, account.id)
    assert.ok(outcome.output.postId)

    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.content, `${SOCIAL_CAPTION}\n\n#roofcare`)
    assert.deepEqual(JSON.parse(post.data.targetPlatforms), [account.id], 'the post targets the one account the owner chose')
  })

  it('falls back to the platform body when the card has no short caption', async () => {
    const account = await connectedFacebookPage()
    const written = await runCapability('content.write', {
      idea: { title: 'Variant only card', brief: 'A card whose only social body is the platform variant.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(async (input) => {
      if (String(input.prompt ?? '').includes('markdown body only')) {
        return `\`\`\`markdown\n# Roof maintenance\n\n${ARTICLE}\n\`\`\``
      }
      if (String(input.prompt ?? '').includes('"variants"')) return JSON.stringify(VARIANT_REPLY)
      return JSON.stringify({ caption: '', platformVariants: {}, slideCopy: [], cta: '', claims: [], sources: [] })
    }))
    assert.equal(written.ok, true, written.error ?? '')

    const outcome = await runCapability('content.social.publish', {
      itemId: written.output.itemId,
      accountId: account.id,
      platform: 'facebook',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.content, VARIANT_BODIES.facebook)
  })

  it('accepts an explicit body over the stored one', async () => {
    const account = await connectedFacebookPage()
    const outcome = await runCapability('content.social.publish', {
      itemId: drafted.output.itemId,
      accountId: account.id,
      platform: 'facebook',
      text: 'A body the owner typed.',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.content, 'A body the owner typed.')
  })

  it('schedules for a later date when asked', async () => {
    const account = await connectedFacebookPage()
    const outcome = await runCapability('content.social.publish', {
      itemId: drafted.output.itemId,
      accountId: account.id,
      platform: 'facebook',
      text: 'Scheduled for later.',
      mode: 'schedule',
      scheduleAt: '2031-04-01T09:00:00.000Z',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.scheduledAt.toISOString(), '2031-04-01T09:00:00.000Z')
  })

  it('refuses to schedule without a date', async () => {
    const account = await connectedFacebookPage()
    const outcome = await runCapability('content.social.publish', {
      itemId: drafted.output.itemId,
      accountId: account.id,
      platform: 'facebook',
      text: 'Never scheduled.',
      mode: 'schedule',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'SCHEDULE_TIME_REQUIRED')
  })

  it('refuses another business’s account with no side effect', async () => {
    const foreign = await socialMediaAccountService.createAccount({
      userId: OUTSIDER,
      businessId: OUTSIDER_BUSINESS,
      platform: 'facebook',
      accountId: 'fb-foreign-1',
      accountName: 'Someone Else Co',
      accessToken: 'foreign-token',
    })
    const postsBefore = await db.select().from(schema.posts)

    const outcome = await runCapability('content.social.publish', {
      itemId: drafted.output.itemId,
      accountId: foreign.id,
      platform: 'facebook',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'ACCOUNT_NOT_FOUND')

    const postsAfter = await db.select().from(schema.posts)
    assert.equal(postsAfter.length, postsBefore.length, 'no post row was created')
  })

  it('refuses a disconnected account with no side effect', async () => {
    const paused = await socialMediaAccountService.createAccount({
      userId: OWNER,
      businessId: BUSINESS,
      platform: 'bluesky',
      accountId: 'bsky-paused-1',
      accountName: 'Paused Co',
      accessToken: 'paused-token',
    })
    await socialMediaAccountService.deactivateAccount(paused.id, OWNER)
    const postsBefore = await db.select().from(schema.posts)

    const outcome = await runCapability('content.social.publish', {
      itemId: drafted.output.itemId,
      accountId: paused.id,
      platform: 'bluesky',
      text: 'Should never go out.',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'ACCOUNT_INACTIVE')
    assert.equal((await db.select().from(schema.posts)).length, postsBefore.length, 'no post row was created')
  })

  it('refuses an account that is on another platform', async () => {
    const account = await connectedFacebookPage()
    const outcome = await runCapability('content.social.publish', {
      itemId: drafted.output.itemId,
      accountId: account.id,
      platform: 'linkedin',
      text: 'Wrong platform.',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'ACCOUNT_PLATFORM_MISMATCH')
  })

  it('reports CONTENT_REQUIRED when the card has nothing to send', async () => {
    const account = await connectedFacebookPage()
    const created = await contentBoardService.create(OWNER, BUSINESS, { title: 'Empty card' })
    const outcome = await runCapability('content.social.publish', {
      itemId: created.data.id,
      accountId: account.id,
      platform: 'facebook',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'CONTENT_REQUIRED')
  })
})

describe('content.check types its social-post result', () => {
  it('returns one platform-tagged post per drafted entry', async () => {
    const outcome = await runCapability('content.check', {
      operation: 'social-post',
      content: 'Preventive roof care saves money.',
      platforms: ['facebook'],
    }, baseContext(async () => JSON.stringify({
      result: {
        posts: [
          { platform: 'facebook', text: 'Your roof fails quietly. Want it checked?', hashtags: ['#roof'] },
          { platform: 'linkedin', text: 'Preventive roof care saves money on every repair bill.' },
        ],
      },
    })))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.equal(outcome.output.result.posts.length, 2)
    assert.deepEqual(outcome.output.result.posts[0], {
      platform: 'facebook',
      text: 'Your roof fails quietly. Want it checked?',
      hashtags: ['#roof'],
    })
    assert.deepEqual(outcome.output.result.posts[1].hashtags, [], 'hashtags are read from the text when the model omits them')
  })

  it('returns an empty list rather than raw model text when nothing parses', async () => {
    const outcome = await runCapability('content.check', {
      operation: 'social-post',
      content: 'Preventive roof care saves money.',
      platforms: ['facebook'],
    }, baseContext(async () => 'I am afraid I cannot do that.'))
    assert.equal(outcome.ok, true, outcome.error ?? '')
    assert.deepEqual(outcome.output.result, { posts: [] })
  })
})

/** D10 — the two publishes never touch each other's state. */
describe('the article publish and the social publish stay separate', () => {
  it('article publish touches no social account and sends no social post', async () => {
    await makeConnection()
    await connectedFacebookPage()
    const accountsBefore = await socialAccountsOf()

    const written = await runCapability('content.write', {
      idea: { title: 'Article only', brief: 'The owner only wanted the article out.' },
      platforms: ['facebook'],
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    await approveArtifact(written.output.artifactId)

    const outcome = await runCapability('content.publish', {
      itemId: written.output.itemId,
      provider: 'wordpress',
      confirm: true,
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')

    assert.deepEqual(await socialAccountsOf(), accountsBefore, 'no social account row changed')

    const job = await jobFor(outcome.output.jobId)
    assert.equal(job.status, 'queued', 'delivery is a publishing job, not a social send')

    const post = await postService.findById(outcome.output.postId, OWNER)
    assert.equal(post.data.content, ARTICLE, 'the article body is the delivery body')
    assert.equal((await platformPostsOf(outcome.output.postId)).every(row => row.status === 'pending'), true,
      'no platform post was sent to a social account')
  })

  it('social publish leaves the article artifact and the item state alone', async () => {
    const account = await connectedFacebookPage()
    const written = await runCapability('content.write', {
      idea: { title: 'Social only', brief: 'The owner only wanted the social post out.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    assert.equal(written.ok, true, written.error ?? '')
    const artifactBefore = await artifactOf(written.output.artifactId)

    const outcome = await runCapability('content.social.publish', {
      itemId: written.output.itemId,
      accountId: account.id,
      platform: 'facebook',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, outcome.error ?? '')

    const artifactAfter = await artifactOf(written.output.artifactId)
    assert.equal(artifactAfter.version, artifactBefore.version, 'the artifact was not edited')
    assert.equal(storedOutput(artifactAfter).article, ARTICLE)
    assert.equal(await itemState(written.output.itemId), 'drafting', 'the card did not move')

    const jobs = await db.select().from(schema.publishingJobs).where(eq(schema.publishingJobs.artifactId, written.output.artifactId))
    assert.equal(jobs.length, 0, 'no publishing job was created')
  })

  it('the social publish never asks for the article publish’s confirmation', async () => {
    const account = await connectedFacebookPage()
    const written = await runCapability('content.write', {
      idea: { title: 'No confirm flag', brief: 'Social publishing is its own action.' },
      platforms: ['facebook'],
      stopAt: 'drafting',
    }, baseContext(chainComplete()))
    const outcome = await runCapability('content.social.publish', {
      itemId: written.output.itemId,
      accountId: account.id,
      platform: 'facebook',
    }, baseContext(chainComplete()))
    assert.equal(outcome.ok, true, 'no confirm: true was sent and none was needed')
    assert.ok(outcome.output.postId)
  })
})
