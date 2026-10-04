import { readFile } from 'node:fs/promises'
import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { validatePublicSiteUrl } from '#layers/BaseDB/server/utils/url-allowlist'
import { downloadVideo } from '../../utils/ytdlp'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'MEDIA_ERROR')

/** Persist the downloaded file in the business asset library. */
async function storeDownload(ctx: AgentToolContext, download: { filePath: string, bytes: number, id: string }) {
  const { assetService } = await import('#layers/BaseShared/server/services/asset.service')
  const buffer = await readFile(download.filePath)
  const stored = await assetService.createFromBase64(ctx.userId, {
    data: buffer.toString('base64'),
    mimeType: 'video/mp4',
    businessId: ctx.businessId,
    originalName: `${download.id}.mp4`,
  })
  if (!stored.success) toolError(stored.code, stored.error)
  return {
    assetId: stored.success ? stored.data.id : null,
    bytes: download.bytes,
    url: stored.success ? stored.data.url : null,
  }
}

/**
 * `download_video` for one run. The pi `onUpdate` progress callback becomes
 * Flue's `toolCtx.log` — progress lines are streamed into the conversation as
 * `log` events and never reach the model, so the two stages stay invisible to
 * the prompt.
 */
export function createMediaTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'download_video',
      description: 'Download a video from a safe public URL into the business asset library.',
      input: v.object({
        url: v.pipe(v.string(), v.description('Public http(s) video URL')),
        itemId: v.optional(v.pipe(v.string(), v.description('Content card id the video belongs to'))),
      }),
      run: async (toolCtx) => {
        const { url, itemId } = toolCtx.data
        // validatePublicSiteUrl returns an error string when the URL is
        // rejected and null when it passes.
        const rejection = await validatePublicSiteUrl(url)
        if (rejection) toolError('SSRF_BLOCKED', 'URL is not allowed')

        toolCtx.log.info(JSON.stringify({ stage: 'downloading' }))

        let download: Awaited<ReturnType<typeof downloadVideo>> | null = null
        try {
          download = await downloadVideo(url.trim())
          toolCtx.log.info(JSON.stringify({ stage: 'storing' }))
          const stored = await storeDownload(ctx, download)
          return toolResult({ ...stored, itemId: itemId ?? null })
        }
        finally {
          await download?.cleanup()
        }
      },
    }),
  ]
}
