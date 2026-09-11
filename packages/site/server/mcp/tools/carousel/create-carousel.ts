import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { carouselService } from '#layers/BaseDB/server/services/carousel.service'
import { buildSceneSnapshots } from '#layers/BaseTools/shared/carousel-scene/scene-snapshot'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { carouselPaletteInput, carouselSlideInput, toServiceSlides } from '../../utils/carousel-shapes'

export default defineMcpTool({
  description: 'Create a carousel deck from structured slides (templateKey + copy). Maps Claude-artifact HTML onto templates: pick the closest templateKey per slide and pass its fields. Slides allow 1-15; Instagram export needs 2-10. Returns the carousel id — pass it to export-carousel-images to render PNGs and draft the post.',
  inputSchema: {
    name: z.string().max(120).default('Untitled Carousel').describe('Deck name'),
    slides: z.array(carouselSlideInput).min(1).max(15).describe('Slides in order; slide 1 hooks, last slide is the CTA'),
    palette: carouselPaletteInput.default({ bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' }).describe('Deck colors + font'),
    handle: z.string().max(120).optional().describe('Social handle shown on slides, e.g. @magicsync'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)
    const carouselId = crypto.randomUUID()

    try {
      const slides = toServiceSlides(args.slides, args.palette.text)
      const scene = buildSceneSnapshots(slides, args.palette, { w: 1080, h: 1350 })
      const result = await carouselService.upsert(userId, carouselId, {
        name: args.name,
        slides,
        palette: args.palette,
        handle: args.handle,
        scene,
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create carousel')
      }
      await logMcpCall(mcp, 'create-carousel', carouselId)
      return { carouselId, name: result.data.name, slideCount: slides.length }
    }
    catch (error) {
      await logMcpCall(mcp, 'create-carousel', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
