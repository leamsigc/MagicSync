import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import type { CarouselPalette, CarouselSlideData } from '#layers/BaseDB/server/services/carousel.service'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { postService } from '#layers/BaseDB/server/services/post.service'
import type { PostCreateBase } from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { resolveSlideLayers } from '../../shared/carousel-scene/scene-snapshot'
import { slideToFabricScene } from '../../shared/carousel-scene/scene'
import { renderSceneToPng } from './fabric-scene-render'
import { orThrow } from './service-result'

/**
 * Carousel → images → draft post pipeline (Task 2.2 engine).
 *
 * Renders every slide server-side (fabric), stores each PNG as a media
 * library asset, then creates a placeholder post (scheduled 24h out) the
 * agent finalizes via update-post (caption + schedule). Drafts never publish
 * on their own: creation alone does not trigger the scheduler.
 */

const FILE_STORAGE_MOUNT = process.env.NUXT_FILE_STORAGE_MOUNT || './upload/files'

export interface ExportDraftRequest {
  userId: string
  businessId: string
  carouselId: string
  accountIds: string[]
  caption?: string
}

export interface ExportDraftResult {
  assetIds: string[]
  draftPostId: string
  slideCount: number
}

interface ExportableDeck {
  id: string
  name: string
  slides: Array<{ id: string, templateKey: string, data: CarouselSlideData, layers?: unknown[] }>
  palette: CarouselPalette
}

async function renderSlideAsset(
  deck: ExportableDeck,
  index: number,
  userId: string,
  businessId: string,
  dir: string,
): Promise<ServiceResponse<string>> {
  try {
    const slide = deck.slides[index]
    if (!slide) return { success: false, error: `Slide ${index + 1} not found` }
    const layers = resolveSlideLayers(
      { id: slide.id, templateKey: slide.templateKey, data: slide.data, layers: slide.layers },
      deck.palette,
      { w: 1080, h: 1350 },
      index,
      deck.slides.length,
    )
    const scene = slideToFabricScene(layers, { width: 1080, height: 1350, palette: deck.palette })
    const rendered = await renderSceneToPng({ width: 1080, height: 1350, objects: scene.objects })
    const filename = `${crypto.randomUUID()}.png`
    await writeFile(join(dir, filename), rendered.png)
    const asset = await assetService.create(userId, {
      businessId,
      filename: filename.replace(/\.png$/, ''),
      originalName: `carousel-slide-${index + 1}.png`,
      mimeType: 'image/png',
      size: rendered.png.length,
      url: `/api/v1/assets/serve/${filename}`,
      metadata: { width: 1080, height: 1350, carouselId: deck.id },
    })
    if (!asset.success || !asset.data) {
      return { success: false, error: asset.error ?? `Failed to save slide ${index + 1} image` }
    }
    return { success: true, data: asset.data.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : `Failed to render slide ${index + 1}` }
  }
}

export async function exportCarouselToDraft(request: ExportDraftRequest): Promise<ServiceResponse<ExportDraftResult>> {
  try {
    const dir = join(process.cwd(), FILE_STORAGE_MOUNT, 'userFiles', request.userId)
    await mkdir(dir, { recursive: true })
    const loaded = orThrow(await loadExportableDeck(request.userId, request.carouselId), 'Carousel not found')
    const rendered = orThrow(await renderAllSlides(loaded, request.userId, request.businessId, dir), 'Failed to render slides')
    const drafted = orThrow(await createDraftPost(loaded, request, rendered), 'Failed to create draft post')
    return { success: true, data: { assetIds: rendered, draftPostId: drafted, slideCount: loaded.slides.length } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Carousel export failed' }
  }
}

async function loadExportableDeck(userId: string, carouselId: string): Promise<ServiceResponse<ExportableDeck>> {
  const owned = await carouselService.getForUser(userId, carouselId)
  if (owned.error || !owned.data) {
    return { success: false, error: owned.error ?? 'Carousel not found', code: 'NOT_FOUND' }
  }
  if (owned.data.slides.length < 2 || owned.data.slides.length > 10) {
    return { success: false, error: `Instagram carousels need 2–10 images, but this deck has ${owned.data.slides.length} slide(s). Edit the deck first.` }
  }
  return { success: true, data: owned.data }
}

async function renderAllSlides(
  deck: ExportableDeck,
  userId: string,
  businessId: string,
  dir: string,
): Promise<ServiceResponse<string[]>> {
  const assetIds: string[] = []
  for (let index = 0; index < deck.slides.length; index++) {
    const rendered = await renderSlideAsset(deck, index, userId, businessId, dir)
    if (!rendered.success || !rendered.data) {
      return { success: false, error: rendered.error ?? `Failed to render slide ${index + 1}` }
    }
    assetIds.push(rendered.data)
  }
  return { success: true, data: assetIds }
}

async function createDraftPost(
  deck: { name: string },
  request: ExportDraftRequest,
  assetIds: string[],
): Promise<ServiceResponse<string>> {
  const post = await postService.create(request.userId, {
    businessId: request.businessId,
    content: request.caption?.trim() ? request.caption : deck.name,
    targetPlatforms: request.accountIds,
    mediaAssets: assetIds,
    scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
    status: 'draft' as PostCreateBase['status'],
    comment: [],
    postFormat: 'post',
  })
  if (!post.success || !post.data) {
    return { success: false, error: post.error ?? 'Failed to create draft post' }
  }
  return { success: true, data: post.data.id }
}
