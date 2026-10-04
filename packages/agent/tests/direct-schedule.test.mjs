import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { initTestDb, insertUser, insertBusiness } from './setup.mjs'
import { runTool } from './flue-tool.mjs'

const OWNER = 'direct-owner'
const BUSINESS = 'direct-business'

let db
let schema
let cleanup
let directScheduleService
let resolvePlatformScope
let parseTimeframe
let buildSlots
let createAgentTools
let createAgentToolContext
let tools

function findTool(name) {
  const tool = tools.find(entry => entry.name === name)
  assert.ok(tool, `tool ${name} exists`)
  return tool
}

async function insertAccount(platform) {
  const id = crypto.randomUUID()
  await db.insert(schema.socialMediaAccounts).values({
    id,
    userId: OWNER,
    businessId: BUSINESS,
    platform,
    accountId: `acct-${platform}-${crypto.randomUUID()}`,
    accountName: `${platform} account`,
    accessToken: 'test-token',
  })
  return id
}

before(async () => {
  const init = await initTestDb()
  db = init.db
  schema = init.schema
  cleanup = init.cleanup
  await insertUser(db, { id: OWNER, email: 'direct@test.local' })
  await insertBusiness(db, { id: BUSINESS, userId: OWNER, name: 'Direct Co' })
  ;({ directScheduleService, resolvePlatformScope, parseTimeframe, buildSlots } = await import('#layers/BaseDB/server/services/direct-schedule.service.ts'))
  ;({ createAgentTools } = await import('../server/agent/tools/index.ts'))
  ;({ createAgentToolContext } = await import('../server/agent/tool-context.ts'))
  tools = createAgentTools(createAgentToolContext({ userId: OWNER, businessId: BUSINESS }))
})

after(() => cleanup())

describe('direct scheduling seam (Unit 6)', () => {
  it('maps x/ig/fb aliases to canonical platforms', async () => {
    const scope = resolvePlatformScope(['x', 'ig', 'fb'])
    assert.deepEqual(scope.resolved, ['twitter', 'instagram', 'facebook'])
    assert.deepEqual(scope.rejected, [])
  })

  it('rejects unknown names as unsupported', async () => {
    const scope = resolvePlatformScope(['whatsapp', 'facebook groups'])
    assert.deepEqual(scope.resolved, [])
    assert.deepEqual(scope.rejected, ['whatsapp', 'facebook groups'])
  })

  it('builds 7 daily slots through next week in UTC', async () => {
    const window = parseTimeframe('through next week', undefined, new Date('2026-03-02T10:00:00.000Z'))
    assert.equal(window.kind, 'window')
    assert.equal(window.maxPosts, 7)
    assert.equal(window.timezone, 'UTC')
    const slots = buildSlots(window)
    assert.equal(slots.length, 7)
    for (const slot of slots) assert.ok(slot.endsWith('Z'))
    const first = Date.parse(slots[0])
    const second = Date.parse(slots[1])
    assert.equal(second - first, 86_400_000)
    const last = Date.parse(slots[6])
    assert.equal(last - first, 6 * 86_400_000)
    const end = new Date(window.endIso)
    assert.equal(end.getUTCDay(), 0)
  })

  it('rejects unconnected platforms with a connect url', async () => {
    const result = await directScheduleService.scheduleDirect(OWNER, BUSINESS, {
      brief: 'Ship the launch update.',
      platforms: ['twitter'],
      timeframe: 'now',
    })
    assert.equal(result.success, true)
    assert.deepEqual(result.data.items, [])
    assert.equal(result.data.rejected.length, 1)
    assert.equal(result.data.rejected[0].platform, 'twitter')
    assert.equal(result.data.rejected[0].code, 'SOCIAL_NOT_CONNECTED')
    assert.equal(result.data.rejected[0].connectUrl, `/app/business/${BUSINESS}/accounts`)
  })

  it('schedules one post per connected platform via the tool', async () => {
    const twitterId = await insertAccount('twitter')
    const instagramId = await insertAccount('instagram')
    const output = await runTool(findTool('schedule_direct_posts'), {
      brief: 'Ship the launch update.',
      platforms: ['x', 'ig', 'whatsapp'],
      timeframe: 'now',
    })
    assert.equal(output.items.length, 2)
    const byPlatform = Object.fromEntries(output.items.map(item => [item.platform, item]))
    assert.equal(byPlatform.twitter.accountId, twitterId)
    assert.equal(byPlatform.instagram.accountId, instagramId)
    for (const item of output.items) {
      assert.ok(item.postId)
      assert.ok(item.scheduledAt.endsWith('Z'))
    }
    assert.equal(output.rejected.length, 1)
    assert.equal(output.rejected[0].platform, 'whatsapp')
    assert.equal(output.rejected[0].code, 'PLATFORM_NOT_SUPPORTED')
    const rows = await db.select().from(schema.posts).where(eq(schema.posts.businessId, BUSINESS))
    assert.equal(rows.length, 2)
  })
})
