import { z } from 'zod'
import { renderSceneToPng } from '../../../utils/fabric-scene-render'
import type { FabricObjectJson } from '../../../../shared/carousel-scene/scene'

/**
 * Render a fabric scene to PNG (Task 1.5) — the server half of the MCP
 * export flow. Accepts the same scene JSON the beta stage paints; responds
 * with raw `image/png` bytes plus render counters as headers.
 */
const renderSchema = z.object({
  scene: z.object({
    width: z.number().int().min(10).max(4000),
    height: z.number().int().min(10).max(4000),
    objects: z.array(z.record(z.string(), z.unknown())).max(60),
  }).passthrough(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const log = useLogger(event)

  const body = await readValidatedBody(event, renderSchema.parse)
  log.set({ userId: user.id, objects: body.scene.objects.length })

  try {
    const result = await renderSceneToPng({
      width: body.scene.width,
      height: body.scene.height,
      objects: body.scene.objects as FabricObjectJson[],
    })
    setResponseHeader(event, 'Content-Type', 'image/png')
    setResponseHeader(event, 'X-Render-Rendered', String(result.rendered))
    setResponseHeader(event, 'X-Render-Skipped', String(result.skipped))
    setResponseHeader(event, 'X-Render-Fonts', result.fontsRequested.join(','))
    return result.png
  } catch (error) {
    log.error({ content: 'Scene render failed', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Failed to render scene' })
  }
})
