import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import type { CarouselPalette, CarouselSlide } from '#layers/BaseDB/server/services/carousel.service'
import { buildSceneSnapshots } from '#layers/BaseTools/shared/carousel-scene/scene-snapshot'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { orThrow } from '../../utils/mcp-results'
import { carouselPaletteInput, carouselSlideInput, toServiceSlides, type CarouselPaletteInput, type CarouselSlideInput } from '../../utils/carousel-shapes'

interface CarouselUpdate {
  name?: string
  slides?: CarouselSlideInput[]
  palette?: CarouselPaletteInput
  handle?: string
}

function mergeCarouselUpdate(
  current: { name: string, slides: CarouselSlide[], palette: CarouselPalette, pattern?: string, handle?: string, scene?: Array<{ slideId: string, scene: unknown }> },
  args: CarouselUpdate,
): { name: string, slides: CarouselSlide[], palette: CarouselPaletteInput, pattern?: string, handle?: string, scene?: Array<{ slideId: string, scene: unknown }> } {
  const palette = args.palette ?? current.palette
  const slides: CarouselSlide[] = args.slides ? toServiceSlides(args.slides, palette.text) : current.slides
  return {
    name: args.name ?? current.name,
    slides,
    palette,
    pattern: current.pattern,
    handle: args.handle ?? current.handle,
    scene: args.slides ? buildSceneSnapshots(slides, palette, { w: 1080, h: 1350 }) : current.scene,
  }
}

export default defineMcpTool({
  description: 'Update a carousel deck in place (same row — use for chat iterations like "make slide 2 punchier", never create a duplicate). Only provided fields change; omitted fields keep their values. Replacing slides rebuilds the render snapshots.',
  inputSchema: {
    carouselId: z.string().describe('Carousel ID to update'),
    name: z.string().max(120).optional().describe('New deck name'),
    slides: z.array(carouselSlideInput).min(1).max(15).optional().describe('Full replacement slide list (merge client-side first: get-carousel, tweak, send back)'),
    palette: carouselPaletteInput.optional().describe('Replacement palette'),
    handle: z.string().max(120).optional().describe('New social handle'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      const existing = orThrow(await carouselService.getForUser(userId, args.carouselId), 'Carousel not found')
      const merged = mergeCarouselUpdate(existing, args)
      const result = orThrow(await carouselService.upsert(userId, args.carouselId, merged), 'Failed to update carousel')
      await logMcpCall(mcp, 'update-carousel', args.carouselId)
      return { carouselId: args.carouselId, name: result.name, slideCount: merged.slides.length }
    }
    catch (error) {
      await logMcpCall(mcp, 'update-carousel', args.carouselId, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
