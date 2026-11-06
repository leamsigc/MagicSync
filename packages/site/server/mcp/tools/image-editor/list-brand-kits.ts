import { z } from 'zod'
import { brandKitService } from '#layers/BaseDB/server/services/design.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

/** Brand kits — list or view the kit an agent should apply to outputs. */
export default defineMcpTool({
  description: 'List your brand kits (colors, heading/body fonts, logo URL). Pass kit fields into render/update designs to keep output on-brand.',
  inputSchema: {
    name: z.string().max(80).optional().describe('Create mode: new kit name'),
    colors: z.array(z.string().max(32)).max(12).optional().describe('Hex colors (create mode)'),
    heading: z.string().max(64).optional().describe('Heading font family (create mode)'),
    body: z.string().max(64).optional().describe('Body font family (create mode)'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)

    try {
      if (args.name) {
        const created = await brandKitService.create(userId, {
          name: args.name,
          colors: args.colors,
          fonts: { heading: args.heading, body: args.body },
        })
        if (!created.success || !created.data) throw new Error(`Create failed: ${created.error}`)
        logMcpCall('list-brand-kits(create)', { userId })
        return { created: true, kit: { id: created.data.id, name: created.data.name, colors: created.data.colors, fonts: created.data.fonts } }
      }
      const listed = await brandKitService.list(userId)
      if (!listed.success) throw new Error(listed.error ?? 'Failed to list kits')
      logMcpCall('list-brand-kits', { userId, count: listed.data?.length ?? 0 })
      return {
        count: listed.data?.length ?? 0,
        kits: (listed.data ?? []).map(kit => ({ id: kit.id, name: kit.name, colors: kit.colors, fonts: kit.fonts, logoUrl: kit.logoUrl || null })),
      }
    } catch (error) {
      log.error({ message: 'list-brand-kits failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Brand kit operation failed')
    }
  },
})
