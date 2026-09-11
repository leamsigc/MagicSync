import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { assetMock, boardMock, carouselMock, postMock } from './mocks/services'

// Site-relative utils (../../utils/*) bypass config aliases (Vite matches
// aliases on raw specifiers), so they are mocked here with test-relative
// paths resolving to the same files the tools import. Bare specifiers
// (@nuxtjs/mcp-toolkit, #layers/*) resolve through vitest.config aliases.
const mcpCtx = vi.hoisted(() => ({ ctx: null as null | Record<string, unknown> }))

vi.mock('../../../site/server/mcp/utils/mcp-context', () => ({
  requireMcp: () => {
    const mcp = mcpCtx.ctx
    if (!mcp?.valid || !mcp?.businessId) {
      throw new Error('Authentication required. Configure your MCP client with a MagicSync API key (Authorization: Bearer <key>) and try again.')
    }
    return mcp
  },
  requireScope: (mcp: Record<string, unknown>, scope: string) => {
    const granted = (mcp.mcpScope as string | undefined) ?? 'full'
    if (scope === 'full' && granted !== 'full') {
      throw new Error(`This tool requires full access, but API key "${String(mcp.name ?? mcp.keyId)}" is read-only.`)
    }
  },
  resolveUserId: async (mcp: Record<string, unknown>) => (mcp.userId as string | undefined) ?? 'user-test-1',
  resolveAccounts: async (mcp: Record<string, unknown>, platforms: string[]) => {
    const allowed = mcp.connectedPlatforms as string[] | undefined
    if (allowed?.length) {
      const denied = platforms.filter(p => !allowed.includes(p))
      if (denied.length > 0) throw new Error(`API key does not allow platform(s): ${denied.join(', ')}.`)
    }
    const userId = (mcp.userId as string | undefined) ?? 'user-test-1'
    return { accounts: platforms.map(p => ({ id: `acc-${p}`, platform: p, userId })), userId }
  },
}))

const auditCalls = vi.hoisted(() => [] as Array<{ tool: string, targetId?: string, status: string }>)

vi.mock('../../../site/server/mcp/utils/mcp-audit', () => ({
  logMcpCall: async (_mcp: unknown, tool: string, targetId?: string, status: 'success' | 'failure' = 'success') => {
    auditCalls.push({ tool, targetId, status })
  },
}))

// Task 2 — all 15 carousel/menu-board MCP tools, handler-level. Nuxt-only
// modules resolve to stand-ins via vitest.config aliases (no vi.mock needed).
// Real code under test: tool arg mapping, shared scene building, the export
// orchestrator (incl. real fabric render + real PNG writes to an isolated
// tmp dir), scope guards, audit calls.

// Tools under test (defineMcpTool is identity — real inputSchema + handler).
import createCarousel from '../../../site/server/mcp/tools/carousel/create-carousel'
import listCarousels from '../../../site/server/mcp/tools/carousel/list-carousels'
import getCarousel from '../../../site/server/mcp/tools/carousel/get-carousel'
import updateCarousel from '../../../site/server/mcp/tools/carousel/update-carousel'
import deleteCarousel from '../../../site/server/mcp/tools/carousel/delete-carousel'
import publishCarousel from '../../../site/server/mcp/tools/carousel/publish-carousel'
import unpublishCarousel from '../../../site/server/mcp/tools/carousel/unpublish-carousel'
import exportCarouselImages from '../../../site/server/mcp/tools/carousel/export-carousel-images'
import createMenuBoard from '../../../site/server/mcp/tools/menu-board/create-menu-board'
import listMenuBoards from '../../../site/server/mcp/tools/menu-board/list-menu-boards'
import getMenuBoard from '../../../site/server/mcp/tools/menu-board/get-menu-board'
import updateMenuBoard from '../../../site/server/mcp/tools/menu-board/update-menu-board'
import deleteMenuBoard from '../../../site/server/mcp/tools/menu-board/delete-menu-board'
import publishMenuBoard from '../../../site/server/mcp/tools/menu-board/publish-menu-board'
import unpublishMenuBoard from '../../../site/server/mcp/tools/menu-board/unpublish-menu-board'

const PALETTE = { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' }

const DECK = {
  id: 'car-1',
  name: 'Launch deck',
  slides: [
    { id: 'slide-0', templateKey: 'title-kicker', data: { kicker: 'DAY 1', headline: 'We ship', body: 'Swipe for the story.' }, pattern: 'dots', patternColor: '#fafaf9', patternOpacity: 0.08, bgImage: null, customHtml: '' },
    { id: 'slide-1', templateKey: 'big-statement', data: { headline: 'No fluff, ever' }, pattern: 'dots', patternColor: '#fafaf9', patternOpacity: 0.08, bgImage: null, customHtml: '' },
    { id: 'slide-2', templateKey: 'cta', data: { headline: 'Your turn', body: 'Save this.', cta: 'Follow' }, pattern: 'dots', patternColor: '#fafaf9', patternOpacity: 0.08, bgImage: null, customHtml: '' },
  ],
  palette: PALETTE,
  handle: '@magicsync',
  scene: undefined,
  isPublic: false,
  updatedAt: '2026-09-10T00:00:00.000Z',
}

const BOARD = {
  id: 'board-1',
  name: 'Lunch',
  pages: [
    { id: 'page-0', name: 'Mains', type: 'html', content: '<div>Burger 12</div>', isActive: true, order: 0 },
    { id: 'page-1', name: 'Drinks', type: 'html', content: '<div>Cola 3</div>', isActive: false, order: 1 },
  ],
  settings: { transitionTime: 10, isLocked: false, unlockPin: '0000' },
  isPublic: false,
  updatedAt: '2026-09-10T00:00:00.000Z',
}

function seedMcp(overrides: Record<string, unknown> = {}): void {
  mcpCtx.ctx = { valid: true, businessId: 'biz-1', userId: 'user-1', keyId: 'key-1', name: 'test-key', ...overrides }
}

function seedServices(): void {
  carouselMock.upsert.mockImplementation(async (_userId: string, id: string, data: Record<string, unknown>) => ({ success: true, data: { ...data, id } }))
  carouselMock.getForUser.mockResolvedValue({ success: true, data: { ...DECK } })
  carouselMock.listForUser.mockResolvedValue({ success: true, data: [{ ...DECK }] })
  carouselMock.remove.mockResolvedValue({ success: true, data: true })
  carouselMock.publish.mockResolvedValue({ success: true, data: { slug: 'car-1' } })
  carouselMock.unpublish.mockResolvedValue({ success: true, data: true })
  boardMock.upsert.mockImplementation(async (_userId: string, id: string, data: Record<string, unknown>) => ({ success: true, data: { ...data, id } }))
  boardMock.getForUser.mockResolvedValue({ success: true, data: { ...BOARD } })
  boardMock.listForUser.mockResolvedValue({ success: true, data: [{ ...BOARD }] })
  boardMock.remove.mockResolvedValue({ success: true, data: true })
  boardMock.publish.mockResolvedValue({ success: true, data: { slug: 'board-1' } })
  boardMock.unpublish.mockResolvedValue({ success: true, data: true })
  let assetCount = 0
  assetMock.create.mockImplementation(async (_userId: string, data: Record<string, unknown>) => {
    assetCount += 1
    return { success: true, data: { id: `asset-${assetCount}`, ...data } }
  })
  postMock.create.mockImplementation(async (_userId: string, data: Record<string, unknown>) => ({ success: true, data: { id: 'post-1', ...data, status: 'pending' } }))
}

const TMP_UPLOADS = './test-uploads-tmp/userFiles/user-1'

beforeEach(() => {
  vi.clearAllMocks()
  auditCalls.length = 0
  seedMcp()
  seedServices()
  rmSync('./test-uploads-tmp', { recursive: true, force: true })
  mkdirSync(TMP_UPLOADS, { recursive: true })
})

afterAll(() => {
  rmSync('./test-uploads-tmp', { recursive: true, force: true })
})

describe('carousel tools', () => {
  it('create maps slides, builds scenes, audits success', async () => {
    const out = await createCarousel.handler({
      name: 'Launch',
      slides: [
        { templateKey: 'title-kicker', headline: 'We ship', kicker: 'DAY 1', body: 'Swipe.' },
        { templateKey: 'quote', headline: 'Less', quote: 'Less is more', author: 'Mies' },
      ],
      palette: PALETTE,
      handle: '@magicsync',
    })
    expect(out.slideCount).toBe(2)
    expect(out.name).toBe('Launch')
    const [, , data] = carouselMock.upsert.mock.calls[0] as [string, string, Record<string, unknown>]
    const slides = data.slides as Array<Record<string, unknown>>
    expect(slides).toHaveLength(2)
    expect(slides[0]).toMatchObject({ id: 'slide-0', templateKey: 'title-kicker', pattern: 'dots', bgImage: null, customHtml: '' })
    expect((slides[0]!.data as Record<string, unknown>).headline).toBe('We ship')
    const scene = data.scene as Array<{ slideId: string, scene: { objects: unknown[] } }>
    expect(scene).toHaveLength(2)
    expect(scene[0]!.slideId).toBe('slide-0')
    expect(scene[0]!.scene.objects.length).toBeGreaterThan(2)
    expect(auditCalls).toContainEqual({ tool: 'create-carousel', targetId: out.carouselId, status: 'success' })
  })

  it('create applies input defaults', () => {
    const parsed = z.object(createCarousel.inputSchema).parse({ slides: [{ templateKey: 'cta', headline: 'Go' }] })
    expect(parsed.name).toBe('Untitled Carousel')
    expect(parsed.palette).toMatchObject({ bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' })
  })

  it('create audits failure and throws', async () => {
    carouselMock.upsert.mockResolvedValue({ success: false, error: 'DB down' })
    await expect(createCarousel.handler({ name: 'X', slides: [{ templateKey: 'cta', headline: 'Go' }], palette: PALETTE })).rejects.toThrow('DB down')
    expect(auditCalls).toContainEqual({ tool: 'create-carousel', targetId: undefined, status: 'failure' })
  })

  it('denies writes for read-only keys', async () => {
    seedMcp({ mcpScope: 'read' })
    await expect(createCarousel.handler({ name: 'X', slides: [{ templateKey: 'cta', headline: 'Go' }], palette: PALETTE })).rejects.toThrow('read-only')
  })

  it('lists summaries without full slides', async () => {
    const out = await listCarousels.handler({})
    expect(out.carousels).toHaveLength(1)
    expect(out.carousels[0]).toMatchObject({ id: 'car-1', name: 'Launch deck', slideCount: 3, isPublic: false })
    expect(out.carousels[0]).not.toHaveProperty('palette')
  })

  it('gets full deck with share URL when public', async () => {
    carouselMock.getForUser.mockResolvedValue({ success: true, data: { ...DECK, isPublic: true, shareSlug: 'car-1' } })
    const out = await getCarousel.handler({ carouselId: 'car-1' })
    expect(out.slides).toHaveLength(3)
    expect(out.shareUrl).toContain('/tools/carousel/shared/car-1')
  })

  it('get throws when missing', async () => {
    carouselMock.getForUser.mockResolvedValue({ success: false, error: 'Carousel not found', code: 'NOT_FOUND' })
    await expect(getCarousel.handler({ carouselId: 'nope' })).rejects.toThrow('Carousel not found')
  })

  it('update merges name-only changes, keeps slides and scene', async () => {
    const storedScene = [{ slideId: 'slide-0', scene: { marker: 1 } }]
    carouselMock.getForUser.mockResolvedValue({ success: true, data: { ...DECK, scene: storedScene } })
    const out = await updateCarousel.handler({ carouselId: 'car-1', name: 'Renamed' })
    expect(out.name).toBe('Renamed')
    const [, , data] = carouselMock.upsert.mock.calls[0] as [string, string, Record<string, unknown>]
    expect((data.slides as unknown[])).toHaveLength(3)
    expect(data.scene).toEqual(storedScene)
  })

  it('update with new slides rebuilds snapshots', async () => {
    const out = await updateCarousel.handler({
      carouselId: 'car-1',
      slides: [{ templateKey: 'quote', headline: 'Less', quote: 'Less is more', author: 'Mies' }],
    })
    expect(out.slideCount).toBe(1)
    const [, , data] = carouselMock.upsert.mock.calls[0] as [string, string, Record<string, unknown>]
    const scene = data.scene as Array<{ slideId: string, scene: { objects: unknown[] } }>
    expect(scene).toHaveLength(1)
    expect(scene[0]!.scene.objects.length).toBeGreaterThan(1)
  })

  it('deletes with audit', async () => {
    expect(await deleteCarousel.handler({ carouselId: 'car-1' })).toEqual({ carouselId: 'car-1', deleted: true })
    expect(carouselMock.remove).toHaveBeenCalledWith('user-1', 'car-1')
    expect(auditCalls).toContainEqual({ tool: 'delete-carousel', targetId: 'car-1', status: 'success' })
  })

  it('publishes with share URL, unpublishes cleanly', async () => {
    const pub = await publishCarousel.handler({ carouselId: 'car-1' })
    expect(pub.shareUrl).toContain('/tools/carousel/shared/car-1')
    expect(await unpublishCarousel.handler({ carouselId: 'car-1' })).toEqual({ carouselId: 'car-1', unpublished: true })
  })
})

describe('menu-board tools', () => {
  it('creates boards with generated page ids', async () => {
    const out = await createMenuBoard.handler({
      name: 'Lunch',
      pages: [
        { name: 'Mains', type: 'html', content: '<div>Burger</div>', isActive: true, order: 0 },
        { name: 'Drinks', type: 'html', content: '<div>Cola</div>', isActive: false, order: 1 },
      ],
      settings: { transitionTime: 12, unlockPin: '1234' },
    })
    expect(out.pageCount).toBe(2)
    const [, , data] = boardMock.upsert.mock.calls[0] as [string, string, Record<string, unknown>]
    const pages = data.pages as Array<Record<string, unknown>>
    expect(pages[0]).toMatchObject({ id: 'page-0', name: 'Mains' })
    expect(pages[1]).toMatchObject({ id: 'page-1' })
    expect(data.settings).toMatchObject({ transitionTime: 12, isLocked: false, unlockPin: '1234' })
  })

  it('lists summaries, gets full board with share URL', async () => {
    const listed = await listMenuBoards.handler({})
    expect(listed.boards).toHaveLength(1)
    expect(listed.boards[0]).toMatchObject({ id: 'board-1', pageCount: 2 })
    boardMock.getForUser.mockResolvedValue({ success: true, data: { ...BOARD, isPublic: true, shareSlug: 'board-1' } })
    const got = await getMenuBoard.handler({ boardId: 'board-1' })
    expect(got.pages).toHaveLength(2)
    expect(got.shareUrl).toContain('/tools/menu-board/shared/board-1')
  })

  it('updates merge and keep pages when omitted', async () => {
    const out = await updateMenuBoard.handler({ boardId: 'board-1', name: 'Dinner' })
    expect(out.name).toBe('Dinner')
    const [, , data] = boardMock.upsert.mock.calls[0] as [string, string, Record<string, unknown>]
    expect((data.pages as unknown[])).toHaveLength(2)
  })

  it('get throws when missing; delete and unpublish audit', async () => {
    boardMock.getForUser.mockResolvedValue({ success: false, error: 'Menu board not found', code: 'NOT_FOUND' })
    await expect(getMenuBoard.handler({ boardId: 'nope' })).rejects.toThrow('Menu board not found')
    expect(await deleteMenuBoard.handler({ boardId: 'board-1' })).toEqual({ boardId: 'board-1', deleted: true })
    const pub = await publishMenuBoard.handler({ boardId: 'board-1' })
    expect(pub.shareUrl).toContain('/tools/menu-board/shared/board-1')
    expect(await unpublishMenuBoard.handler({ boardId: 'board-1' })).toEqual({ boardId: 'board-1', unpublished: true })
    expect(auditCalls.filter(a => a.status === 'success')).toHaveLength(3)
  })
})

describe('export-carousel-images tool', () => {
  it('renders slides to assets and drafts the post', async () => {
    const parsed = z.object(exportCarouselImages.inputSchema).parse({ carouselId: 'car-1', caption: 'Launch day!' })
    expect(parsed.platforms).toEqual(['instagram'])
    const out = await exportCarouselImages.handler(parsed)
    expect(out.slideCount).toBe(3)
    expect(out.assetIds).toHaveLength(3)
    expect(out.platforms).toEqual(['instagram'])

    expect(assetMock.create).toHaveBeenCalledTimes(3)
    const [, firstAsset] = assetMock.create.mock.calls[0] as [string, Record<string, unknown>]
    expect(firstAsset).toMatchObject({ businessId: 'biz-1', mimeType: 'image/png', originalName: 'carousel-slide-1.png' })
    expect(String(firstAsset.url)).toMatch(/^\/api\/v1\/assets\/serve\//)
    expect(Number(firstAsset.size)).toBeGreaterThan(10000)
    const written = readdirSync(TMP_UPLOADS)
    expect(written).toHaveLength(3)

    expect(postMock.create).toHaveBeenCalledTimes(1)
    const [, postData] = postMock.create.mock.calls[0] as [string, Record<string, unknown>]
    expect(postData).toMatchObject({ businessId: 'biz-1', content: 'Launch day!', targetPlatforms: ['acc-instagram'], postFormat: 'post' })
    expect(postData.mediaAssets).toEqual(out.assetIds)
    const delay = new Date(postData.scheduledAt as string).getTime() - Date.now()
    expect(delay).toBeGreaterThan(23 * 3600 * 1000)
    expect(delay).toBeLessThan(25 * 3600 * 1000)
    expect(out.draftPostId).toBe('post-1')
    expect(auditCalls).toContainEqual({ tool: 'export-carousel-images', targetId: 'post-1', status: 'success' })
  })

  it('falls back to deck name when caption is blank', async () => {
    const out = await exportCarouselImages.handler({ carouselId: 'car-1', platforms: ['instagram' as never], caption: '   ' })
    const [, postData] = postMock.create.mock.calls[0] as [string, Record<string, unknown>]
    expect(postData.content).toBe('Launch deck')
    expect(out.assetIds).toHaveLength(3)
  })

  it('rejects decks outside Instagram bounds without rendering', async () => {
    carouselMock.getForUser.mockResolvedValue({ success: true, data: { ...DECK, slides: [DECK.slides[0]] } })
    await expect(exportCarouselImages.handler({ carouselId: 'car-1', platforms: ['instagram' as never] })).rejects.toThrow('2–10')
    expect(assetMock.create).not.toHaveBeenCalled()
    expect(postMock.create).not.toHaveBeenCalled()
    expect(auditCalls).toContainEqual({ tool: 'export-carousel-images', targetId: 'car-1', status: 'failure' })
  })

  it('denies disallowed platforms before touching the deck', async () => {
    seedMcp({ connectedPlatforms: ['twitter'] })
    await expect(exportCarouselImages.handler({ carouselId: 'car-1', platforms: ['instagram' as never] })).rejects.toThrow('does not allow')
    expect(carouselMock.getForUser).not.toHaveBeenCalled()
  })

  it('surfaces asset failures', async () => {
    assetMock.create.mockResolvedValue({ success: false, error: 'Disk full' })
    await expect(exportCarouselImages.handler({ carouselId: 'car-1', platforms: ['instagram' as never] })).rejects.toThrow('Disk full')
  })
})
