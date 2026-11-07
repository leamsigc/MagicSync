import { test, expect } from '@playwright/test'
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createActiveBusiness, createTestAccount, createTestAssets, createTestInstagramAccount, createTestUser, loginWith, waitForHydration, type TestUser } from './helpers/e2e-utils'
import { captureRouteAction } from './helpers/route-screenshots'

/**
 * Business access: an invited owner has creator parity (except delete) and an
 * invited member can read the business's content but cannot change the
 * business, team, API keys, or playbook.
 */

function db() {
  const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url))
  const env = readFileSync(envPath, 'utf8')
  const read = (key: string) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))![1]!.trim()
  return createClient({ url: read('NUXT_TURSO_DATABASE_URL'), authToken: read('NUXT_TURSO_AUTH_TOKEN') })
}

function cookie(user: TestUser) {
  return { [user.sessionCookie.name]: user.sessionCookie.value }
}

async function seedMember(organizationId: string, user: TestUser, role: 'owner' | 'member') {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const now = Math.floor(Date.now() / 1000)
  await db().execute({
    sql: 'INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [`e2e-access-member-${stamp}`, organizationId, user.id, role, now],
  })
}

test('business access — invited owner parity and member read-only', async ({ page, playwright }) => {
  test.setTimeout(300000)

  const creatorRequest = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
  const creator = await createTestUser(creatorRequest)
  const business = await createActiveBusiness(creatorRequest, creator, 'Access E2E')
  const account = await createTestAccount(creator.id, business.id)
  const instagram = await createTestInstagramAccount(creator.id, business.id)
  const assets = await createTestAssets(creator.id, business.id, 1)
  const content = `Access check post ${Date.now()}`

  const created = await creatorRequest.post('/api/v1/posts', {
    cookies: cookie(creator),
    data: {
      businessId: business.id,
      content,
      targetPlatforms: [account.id],
      mediaAssets: assets.ids,
      status: 'draft',
    },
  })
  if (!created.ok()) {
    throw new Error(`post create failed (${created.status()}): ${await created.text()}`)
  }
  const creatorPostId = (await created.json()).data.id as string

  const memberRequest = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: { origin: 'http://localhost:3000' },
  })
  const member = await createTestUser(memberRequest)

  const invite = await creatorRequest.post(`/api/v1/business/${business.id}/invite`, {
    cookies: cookie(creator),
    data: { emails: [member.email], role: 'member' },
  })
  expect(invite.ok()).toBeTruthy()

  const orgRows = await db().execute({
    sql: 'SELECT organization_id FROM member WHERE user_id = ? LIMIT 1',
    args: [creator.id],
  })
  const organizationId = String(orgRows.rows[0]!.organization_id)
  await seedMember(organizationId, member, 'member')

  // ── Member: reads the business and its posts ──────────────────────────
  const memberBusiness = await memberRequest.get(`/api/v1/business/${business.id}`)
  expect(memberBusiness.status()).toBe(200)
  expect((await memberBusiness.json()).role).toBe('member')

  const memberPosts = await memberRequest.get(`/api/v1/posts?businessId=${business.id}&limit=100`)
  expect(memberPosts.status()).toBe(200)
  const postsBody = await memberPosts.json()
  expect(postsBody.data.some((post: { content: string }) => post.content === content)).toBeTruthy()

  // Post attachments are shared with the business.
  const memberAssets = await memberRequest.get(`/api/v1/assets/search?businessId=${business.id}&assetIds=${assets.ids[0]}`)
  expect(memberAssets.status()).toBe(200)
  expect((await memberAssets.json()).data.some((asset: { id: string }) => asset.id === assets.ids[0])).toBeTruthy()

  const memberAsset = await memberRequest.get(`/api/v1/assets/${assets.ids[0]}`)
  expect(memberAsset.status()).toBe(200)

  // Legacy asset with no businessId, referenced by a business post, is still
  // visible to members through the post fallback.
  const legacyAssetId = `e2e-legacy-asset-${Date.now()}`
  const legacyAssetNow = Math.floor(Date.now() / 1000)
  await db().execute({
    sql: 'INSERT INTO assets (id, user_id, business_id, filename, original_name, mime_type, size, url, is_public, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0, ?)',
    args: [
      legacyAssetId,
      creator.id,
      `${legacyAssetId}.jpg`,
      'Legacy asset',
      'image/jpeg',
      1000,
      'https://example.com/legacy.jpg',
      legacyAssetNow,
    ],
  })
  const legacyPost = await creatorRequest.post('/api/v1/posts', {
    cookies: cookie(creator),
    data: {
      businessId: business.id,
      content: `Legacy media post ${Date.now()}`,
      targetPlatforms: [account.id],
      mediaAssets: [legacyAssetId],
      status: 'draft',
    },
  })
  expect(legacyPost.ok()).toBeTruthy()

  const memberLegacyAssets = await memberRequest.get(`/api/v1/assets/search?businessId=${business.id}&assetIds=${legacyAssetId}`)
  expect(memberLegacyAssets.status()).toBe(200)
  expect((await memberLegacyAssets.json()).data.some((asset: { id: string }) => asset.id === legacyAssetId)).toBeTruthy()

  const memberLegacyAsset = await memberRequest.get(`/api/v1/assets/${legacyAssetId}`)
  expect(memberLegacyAsset.status()).toBe(200)

  // The auto-reply account picker reads the business's shared Instagram account.
  const memberAccounts = await memberRequest.get(`/api/v1/social-accounts?businessId=${business.id}`)
  expect(memberAccounts.status()).toBe(200)
  expect((await memberAccounts.json()).some((item: { id: string }) => item.id === instagram.id)).toBeTruthy()

  await loginWith(page, member)
  await page.goto('/app/posts')
  await waitForHydration(page)
  await expect(page.getByText(content).first()).toBeVisible({ timeout: 30000 })
  await captureRouteAction(page, { route: '/app/posts', action: 'member-posts', fullPage: false })

  // Member can create content.
  const memberPost = await memberRequest.post('/api/v1/posts', {
    data: {
      businessId: business.id,
      content: `Member post ${Date.now()}`,
      targetPlatforms: [account.id],
      status: 'draft',
    },
  })
  expect(memberPost.ok()).toBeTruthy()

  // A member may edit a post created by the business creator.
  const memberPostUpdate = await memberRequest.put(`/api/v1/posts/${creatorPostId}`, {
    data: { content: `${content} (edited by member)` },
  })
  expect(memberPostUpdate.status()).toBe(200)

  // ── Member: admin surfaces are read-only ──────────────────────────────
  const memberKeys = await memberRequest.get(`/api/v1/api-keys?businessId=${business.id}`)
  expect(memberKeys.status()).toBe(200)

  // Auto-reply campaigns are shared with the business.
  const campaignCreate = await creatorRequest.post('/api/v1/auto-reply/campaigns', {
    cookies: cookie(creator),
    data: {
      name: 'Shared campaign',
      businessId: business.id,
      socialAccountId: instagram.id,
      keywords: ['LINK'],
      dmTemplate: 'Here is your link',
    },
  })
  expect(campaignCreate.ok()).toBeTruthy()
  const campaignId = (await campaignCreate.json()).data.id as string

  // A legacy campaign keyed by the member and missing businessId is still
  // visible because it targets one of the business's accounts.
  const legacyCampaignId = `legacy${Date.now()}`
  const legacyNow = Math.floor(Date.now() / 1000)
  await db().execute({
    sql: 'INSERT INTO entity_details (id, entity_id, entity_type, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [
      `e2e-legacy-campaign-${legacyCampaignId}`,
      `${member.id}::${legacyCampaignId}`,
      'autoreply_campaign',
      JSON.stringify({
        name: 'Legacy shared campaign',
        socialAccountId: instagram.id,
        enabled: true,
        keywords: ['LINK'],
        dmTemplate: 'Legacy link',
        linkIds: [],
        externalPostIds: [],
        matchMode: 'whole',
        followGate: false,
      }),
      legacyNow,
      legacyNow,
    ],
  })

  const memberCampaigns = await memberRequest.get(`/api/v1/auto-reply/campaigns?businessId=${business.id}`)
  expect(memberCampaigns.status()).toBe(200)
  const memberCampaignList = (await memberCampaigns.json()).data as Array<{ id: string }>
  expect(memberCampaignList.some((c) => c.id === campaignId)).toBeTruthy()
  expect(memberCampaignList.some((c) => c.id === legacyCampaignId)).toBeTruthy()

  const memberCampaignUpdate = await memberRequest.put(`/api/v1/auto-reply/campaigns/${campaignId}`, {
    data: { name: 'Shared campaign renamed' },
  })
  expect(memberCampaignUpdate.status()).toBe(200)

  const memberCampaignCreate = await memberRequest.post('/api/v1/auto-reply/campaigns', {
    data: {
      name: 'Member campaign',
      businessId: business.id,
      socialAccountId: instagram.id,
      keywords: ['INFO'],
      dmTemplate: 'Member link',
    },
  })
  expect(memberCampaignCreate.ok()).toBeTruthy()

  // The auto-reply page shows the shared campaigns and the shared Instagram
  // account in the create modal for a member.
  await page.goto('/app/auto-reply')
  await waitForHydration(page)
  await expect(page.getByText('Shared campaign').first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByText('Legacy shared campaign').first()).toBeVisible()
  await captureRouteAction(page, { route: '/app/auto-reply', action: 'member-shared-campaigns', fullPage: false })

  await page.getByRole('button', { name: 'New campaign' }).click()
  await expect(page.getByText('E2E Instagram').first()).toBeVisible({ timeout: 15000 })
  await captureRouteAction(page, { route: '/app/auto-reply', action: 'member-account-picker', fullPage: false })
  await page.keyboard.press('Escape')

  // Templates are shared with the business (Email/Images/Chat/Variables).
  const templateCreate = await creatorRequest.post('/api/v1/templates', {
    cookies: cookie(creator),
    data: {
      businessId: business.id,
      type: 'EMAIL',
      title: 'Shared email template',
      content: 'Hello {{name}}',
    },
  })
  if (!templateCreate.ok()) {
    throw new Error(`template create failed (${templateCreate.status()}): ${await templateCreate.text()}`)
  }
  const templateId = (await templateCreate.json()).data.id as string

  const memberTemplates = await memberRequest.get(`/api/v1/templates?businessId=${business.id}&type=EMAIL&limit=100`)
  expect(memberTemplates.status()).toBe(200)
  expect((await memberTemplates.json()).data.some((t: { id: string }) => t.id === templateId)).toBeTruthy()

  const memberTemplateUpdate = await memberRequest.put(`/api/v1/templates/${templateId}`, {
    data: { title: 'Shared email template renamed' },
  })
  expect(memberTemplateUpdate.status()).toBe(200)

  // Brand kits are shared with the business.
  const kitCreate = await creatorRequest.post('/api/v1/image-editor/brand-kits', {
    cookies: cookie(creator),
    data: { action: 'create', businessId: business.id, name: 'Shared kit' },
  })
  expect(kitCreate.ok()).toBeTruthy()

  const memberKits = await memberRequest.post('/api/v1/image-editor/brand-kits', {
    data: { action: 'list', businessId: business.id },
  })
  expect(memberKits.ok()).toBeTruthy()
  expect((await memberKits.json()).kits.some((kit: { name: string }) => kit.name === 'Shared kit')).toBeTruthy()

  const memberInvite = await memberRequest.post(`/api/v1/business/${business.id}/invite`, {
    data: { emails: ['nope@example.com'], role: 'member' },
  })
  expect(memberInvite.status()).toBe(403)

  const memberUpdate = await memberRequest.put(`/api/v1/business/${business.id}`, {
    data: { name: 'Hacked' },
  })
  expect(memberUpdate.status()).toBe(403)

  const memberKeyCreate = await memberRequest.post('/api/v1/api-keys/create', {
    data: { businessId: business.id, name: 'nope' },
  })
  expect(memberKeyCreate.status()).toBe(403)

  await page.goto(`/app/business/${business.id}/content/edit`)
  await waitForHydration(page)
  await expect(page.getByRole('button', { name: /Save/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Invite member/i })).toHaveCount(0)
  await captureRouteAction(page, { route: '/app/business/:id/content/edit', action: 'member-readonly', fullPage: false })

  await page.goto('/app/keys')
  await waitForHydration(page)
  await captureRouteAction(page, { route: '/app/keys', action: 'member-readonly', fullPage: false })

  await page.goto('/app/integrations')
  await waitForHydration(page)
  await captureRouteAction(page, { route: '/app/integrations', action: 'member-readonly', fullPage: false })

  // ── Invited owner: creator parity, except delete ──────────────────────
  // Promote the same teammate instead of creating a third account (the auth
  // endpoint is rate-limited and the role is read from the member row).
  await db().execute({
    sql: "UPDATE member SET role = 'owner' WHERE organization_id = ? AND user_id = ?",
    args: [organizationId, member.id],
  })

  const ownerUpdate = await memberRequest.put(`/api/v1/business/${business.id}`, {
    data: { name: 'Access E2E renamed' },
  })
  expect(ownerUpdate.status()).toBe(200)

  const ownerInvite = await memberRequest.post(`/api/v1/business/${business.id}/invite`, {
    data: { emails: [`owner-invite-${Date.now()}@example.com`], role: 'member' },
  })
  expect(ownerInvite.status()).toBe(200)

  const ownerKey = await memberRequest.post('/api/v1/api-keys/create', {
    data: { businessId: business.id, name: 'owner key' },
  })
  expect(ownerKey.status()).toBe(200)

  const ownerDelete = await memberRequest.delete(`/api/v1/business/${business.id}`)
  expect(ownerDelete.status()).toBe(403)
})
