import { readFile } from 'node:fs/promises'
import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { validatePublicSiteUrl } from '#layers/BaseDB/server/utils/url-allowlist'
import { downloadVideo } from '../../utils/ytdlp'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

function toolError(code: string | undefined, message: string): never {
  throw new Error(`${code ?? 'MEDIA_ERROR'}: ${message}`)
}

export function createMediaTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'download_video',
      label: 'Download a video',
      description: 'Download a video from a safe public URL into the business asset library.',
      parameters: Type.Object({
        url: Type.String({ description: 'Public http(s) video URL' }),
        itemId: Type.Optional(Type.String({ description: 'Content card id the video belongs to' })),
      }),
      execute: async (_toolCallId, params, _signal, onUpdate) => {
        const safeUrl = await validatePublicSiteUrl(params.url)
        if (!safeUrl) toolError('SSRF_BLOCKED', 'URL is not allowed')

        onUpdate?.({
          content: [{ type: 'text', text: JSON.stringify({ stage: 'downloading' }) }],
          details: { stage: 'downloading' },
        })

        let download: Awaited<ReturnType<typeof downloadVideo>> | null = null
        try {
          download = await downloadVideo(safeUrl)
          onUpdate?.({
            content: [{ type: 'text', text: JSON.stringify({ stage: 'storing' }) }],
            details: { stage: 'storing' },
          })

          const { assetService } = await import('#layers/BaseShared/server/services/asset.service')
          const buffer = await readFile(download.filePath)
          const stored = await assetService.createFromBase64(ctx.userId, {
            data: buffer.toString('base64'),
            mimeType: 'video/mp4',
            businessId: ctx.businessId,
            originalName: `${download.id}.mp4`,
          })
          if (!stored.success) toolError(stored.code, stored.error)
          return toolResult({
            assetId: stored.success ? stored.data.id : null,
            bytes: download.bytes,
            url: stored.success ? stored.data.url : null,
            itemId: params.itemId ?? null,
          })
        }
        finally {
          await download?.cleanup()
        }
      },
    }),
  ]
}
